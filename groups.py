"""
groups.py - Group Comparison endpoint for StatCourt (exact-totals version).

Wire into main.py with two lines (once):
    from groups import router as groups_router
    app.include_router(groups_router)

Rules:
  * everything is built from exact season TOTALS (t_* columns), never from rounded per-game numbers
  * percentages = summed makes / summed attempts, NEVER an average of percentages
  * no single "group strength score" - numbers side by side, no winner
"""
import sqlite3
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()
DB_PATH = "wnba.db"
MIN_PER_SIDE, MAX_PER_SIDE = 2, 5
STATS = ("pts", "reb", "ast", "stl", "blk", "tov")


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


class Line(BaseModel):
    pts: Optional[float] = None
    reb: Optional[float] = None
    ast: Optional[float] = None
    stl: Optional[float] = None
    blk: Optional[float] = None
    tov: Optional[float] = None


class PlayerLine(BaseModel):
    player_id: int
    name: str
    games: int
    seasons: int
    per_game: Line
    fg_pct: Optional[float]
    fg3_pct: Optional[float]
    ft_pct: Optional[float]
    share_of_group_pts: Optional[float]


class GroupTotals(BaseModel):
    players: int
    games: int                      # player-games: sum of every player's games played
    season_totals: Line             # exact sums
    per_player_game: Line           # season_totals / games: the average line of one player-game in this group
    combined_per_game: Line         # sum of each player's own per-game average (hypothetical "all play together")
    fg: int
    fga: int
    fg3: Optional[int]
    fg3a: Optional[int]
    ft: int
    fta: int
    fg_pct: Optional[float]
    fg3_pct: Optional[float]
    ft_pct: Optional[float]
    efg_pct: Optional[float]        # derived: (fg + 0.5*fg3) / fga
    ts_pct: Optional[float]         # derived: pts / (2 * (fga + 0.44 * fta))
    uneven_games: bool              # True when one player's games are far below another's


class GroupSide(BaseModel):
    totals: GroupTotals
    players: list[PlayerLine]
    excluded: list[str]


class GroupComparison(BaseModel):
    league: str
    mode: str
    season_year: Optional[int]
    a: GroupSide
    b: GroupSide


def _ids(raw: str, label: str) -> list[int]:
    try:
        ids = [int(x) for x in raw.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, f"{label}: player ids must be integers, comma separated")
    if len(set(ids)) != len(ids):
        raise HTTPException(400, f"{label}: the same player is listed twice")
    if not (MIN_PER_SIDE <= len(ids) <= MAX_PER_SIDE):
        raise HTTPException(400, f"{label}: choose {MIN_PER_SIDE}-{MAX_PER_SIDE} players")
    return ids


def _ratio(num, den):
    return round(num / den, 3) if den else None


def _r1(x):
    return round(x, 1) if x is not None else None


def _side(conn, ids, mode, year, team=None):
    leagues, lines, excluded = set(), [], []
    S = {k: 0.0 for k in STATS}                        # exact totals
    C = {k: 0.0 for k in STATS}                        # sum of per-game averages
    missing = set()                                    # stats not tracked for at least one player here
    T = {k: 0 for k in ("fg", "fga", "fg3", "fg3a", "ft", "fta")}
    games, any3, per_pts, gp_list = 0, False, {}, []

    for pid in ids:
        p = conn.execute("SELECT id, name, league FROM players WHERE id=?", (pid,)).fetchone()
        if p is None:
            raise HTTPException(404, f"Player {pid} not found")
        leagues.add(p["league"])
        table = "player_season_stints" if team else "player_season_stats"
        q = f"SELECT * FROM {table} WHERE player_id=? AND games_played>0 AND t_fga IS NOT NULL"
        args = [pid]
        if team:
            q += " AND team_abbreviation=?"
            args.append(team)
        if mode == "season":
            q += " AND season_year=?"
            args.append(year)
        rows = conn.execute(q, args).fetchall()
        if not rows:
            q2 = f"SELECT COUNT(*) FROM {table} WHERE player_id=? AND games_played>0"
            a2 = [pid]
            if team:
                q2 += " AND team_abbreviation=?"
                a2.append(team)
            if mode == "season":
                q2 += " AND season_year=?"
                a2.append(year)
            has_any = conn.execute(q2, a2).fetchone()[0] > 0
            what = f"{year} season" if mode == "season" else "career"
            excluded.append(f"{p['name']}: exact totals not available for this {what}" if has_any
                            else f"{p['name']}: no {what} data")
            continue

        gp = sum(r["games_played"] for r in rows)
        # a stat missing (NULL) in ANY of the rows was not tracked in that era -> unavailable, not zero
        tot = {k: (None if any(r["t_" + k] is None for r in rows) else sum(r["t_" + k] for r in rows))
               for k in STATS}
        mk = {k: sum(r["t_" + k] or 0 for r in rows) for k in T}
        has3 = any(r["t_fg3a"] is not None for r in rows)

        games += gp
        gp_list.append(gp)
        for k in STATS:
            if tot[k] is None:
                missing.add(k)
                continue
            S[k] += tot[k]
            C[k] += tot[k] / gp
        for k in T:
            T[k] += int(mk[k])
        any3 = any3 or has3
        per_pts[pid] = tot["pts"]   # pts is required for a row to exist, so never None
        lines.append(PlayerLine(
            player_id=pid, name=p["name"], games=gp, seasons=len(rows),
            per_game=Line(**{k: (_r1(tot[k] / gp) if tot[k] is not None else None) for k in STATS}),
            fg_pct=_ratio(mk["fg"], mk["fga"]),
            fg3_pct=_ratio(mk["fg3"], mk["fg3a"]) if has3 else None,
            ft_pct=_ratio(mk["ft"], mk["fta"]),
            share_of_group_pts=None,
        ))

    for ln in lines:
        ln.share_of_group_pts = round(per_pts[ln.player_id] / S["pts"] * 100, 1) if S["pts"] else None

    n = len(lines)
    totals = GroupTotals(
        players=n, games=games,
        season_totals=Line(**{k: (None if k in missing else int(S[k])) for k in STATS}),
        per_player_game=Line(**{k: (None if k in missing else _r1(S[k] / games)) for k in STATS}) if games else Line(),
        combined_per_game=Line(**{k: (None if k in missing else _r1(C[k])) for k in STATS}),
        fg=T["fg"], fga=T["fga"],
        fg3=T["fg3"] if any3 else None, fg3a=T["fg3a"] if any3 else None,
        ft=T["ft"], fta=T["fta"],
        fg_pct=_ratio(T["fg"], T["fga"]),
        fg3_pct=_ratio(T["fg3"], T["fg3a"]) if any3 else None,
        ft_pct=_ratio(T["ft"], T["fta"]),
        efg_pct=_ratio(T["fg"] + 0.5 * (T["fg3"] if any3 else 0), T["fga"]),
        ts_pct=_ratio(S["pts"], 2 * (T["fga"] + 0.44 * T["fta"])),
        uneven_games=bool(gp_list) and min(gp_list) < 0.6 * max(gp_list),
    )
    return GroupSide(totals=totals, players=lines, excluded=excluded), leagues


@router.get("/compare-groups", response_model=GroupComparison)
def compare_groups(
    a: str = Query(..., description="comma-separated player ids, side A (2-5)"),
    b: str = Query(..., description="comma-separated player ids, side B (2-5)"),
    mode: str = Query("season", pattern="^(season|career)$"),
    year: Optional[int] = Query(None, ge=1946, le=2100),
):
    ids_a, ids_b = _ids(a, "a"), _ids(b, "b")
    if set(ids_a) & set(ids_b):
        raise HTTPException(400, "A player can't be on both sides")
    if mode == "season" and year is None:
        raise HTTPException(400, "year is required when mode=season")

    conn = _conn()
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(player_season_stats)")}
        if "t_fga" not in cols:
            raise HTTPException(503, "Season totals haven't been loaded into this database yet")
        side_a, la = _side(conn, ids_a, mode, year)
        side_b, lb = _side(conn, ids_b, mode, year)
    finally:
        conn.close()
    leagues = la | lb
    if len(leagues) != 1:
        raise HTTPException(400, "All players must be from the same league (WNBA or NBA)")
    if side_a.totals.players == 0 or side_b.totals.players == 0:
        raise HTTPException(404, "One side has no players with data for that selection")
    return GroupComparison(league=leagues.pop(), mode=mode,
                           season_year=year if mode == "season" else None, a=side_a, b=side_b)