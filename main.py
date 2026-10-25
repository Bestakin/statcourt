"""
main.py — StatCourt API (multi-league: WNBA + NBA)

Reads only from local SQLite (wnba.db). Never calls basketball-reference
live. Run the appropriate seed script(s) to populate the DB.
"""

import sqlite3
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="StatCourt API")

app.add_middleware(
    CORSMiddleware,
      allow_origins=[
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://statcourt-1.onrender.com",
      "https://statcourt-site.onrender.com",
      "https://getstatcourt.com",
      "https://www.getstatcourt.com",
  ],
    allow_origin_regex=r"http://(192\.168|10\.0)\.\d+\.\d+:\d+|https://.*\.onrender\.com",
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "wnba.db"

VALID_LEAGUES = ["WNBA", "NBA"]
LEAGUE_PATTERN = "^(WNBA|NBA)$"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ---------- Response models ----------

class PlayerSummary(BaseModel):
    id: int
    name: str
    league: str
    draft_year: Optional[int]
    last_active_year: Optional[int]
    position: Optional[str]
    team_abbreviation: Optional[str]


class SeasonStats(BaseModel):
    season_year: int
    team_abbreviation: Optional[str] = None
    games_played: Optional[int] = None
    minutes: Optional[float] = None
    pts: Optional[float] = None
    reb: Optional[float] = None
    ast: Optional[float] = None
    stl: Optional[float] = None
    blk: Optional[float] = None
    tov: Optional[float] = None
    fg_pct: Optional[float] = None
    fg3_pct: Optional[float] = None
    ft_pct: Optional[float] = None
    per: Optional[float] = None
    ts_pct: Optional[float] = None
    usg_pct: Optional[float] = None
    win_shares: Optional[float] = None


class BestSeasonHighlight(BaseModel):
    stat: str
    label: str
    season_year: int
    value: float


class CareerAverages(BaseModel):
    player: PlayerSummary
    seasons_played: int
    games_played: int
    ppg: Optional[float]
    rpg: Optional[float]
    apg: Optional[float]
    spg: Optional[float]
    bpg: Optional[float]
    fg_pct: Optional[float]
    fg3_pct: Optional[float]
    ft_pct: Optional[float]
    highlights: list[BestSeasonHighlight]


class StatRank(BaseModel):
    player_id: int
    season_year: int
    stat: str
    value: Optional[float]
    rank: Optional[int]
    pool_size: int


class PlayerYearComparison(BaseModel):
    player: PlayerSummary
    season_year: int
    status: str
    stats: Optional[SeasonStats] = None


class CategoryScore(BaseModel):
    category: str
    player_1_score: float
    player_2_score: float


class CompositeComparison(BaseModel):
    categories: list[CategoryScore]
    overall_player_1: float
    overall_player_2: float
    winner: Optional[int]


class SimilarPlayer(BaseModel):
    player: PlayerSummary
    similarity_pct: float
    ppg: Optional[float]
    rpg: Optional[float]
    apg: Optional[float]


class SimilarPlayersResponse(BaseModel):
    target_player_id: int
    min_career_games: int
    pool_size: int
    results: list[SimilarPlayer]


class CompareResponse(BaseModel):
    season_year: int
    player_1: PlayerYearComparison
    player_2: PlayerYearComparison
    composite: Optional[CompositeComparison] = None


# ---------- Helpers ----------

def _player_summary(p: sqlite3.Row) -> PlayerSummary:
    return PlayerSummary(
        id=p["id"], name=p["name"], league=p["league"],
        draft_year=p["draft_year"], last_active_year=p["last_active_year"],
        position=p["position"], team_abbreviation=p["team_abbreviation"],
    )


def fetch_player(conn, player_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM players WHERE id = ?", (player_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Player {player_id} not found")
    return row


def fetch_season_stats(conn, player_id: int, season_year: int) -> Optional[sqlite3.Row]:
    return conn.execute(
        """SELECT * FROM player_season_stats
           WHERE player_id = ? AND season_year = ?""",
        (player_id, season_year),
    ).fetchone()


def build_year_comparison(conn, player_id: int, season_year: int) -> PlayerYearComparison:
    p = fetch_player(conn, player_id)
    player_summary = _player_summary(p)

    draft_year = p["draft_year"]
    last_active_year = p["last_active_year"]

    if draft_year is not None and season_year < draft_year:
        status = "not_yet_drafted"
    elif last_active_year is not None and season_year > last_active_year:
        status = "retired"
    else:
        status = "active"

    stats = None
    if status == "active":
        s = fetch_season_stats(conn, player_id, season_year)
        if s is not None:
            stats = SeasonStats(
                season_year=season_year, team_abbreviation=s["team_abbreviation"],
                games_played=s["games_played"], minutes=s["minutes"],
                pts=s["pts"], reb=s["reb"], ast=s["ast"], stl=s["stl"],
                blk=s["blk"], tov=s["tov"], fg_pct=s["fg_pct"],
                fg3_pct=s["fg3_pct"], ft_pct=s["ft_pct"],
                per=s["per"], ts_pct=s["ts_pct"], usg_pct=s["usg_pct"],
                win_shares=s["win_shares"],
            )
        else:
            status = "no_data"

    return PlayerYearComparison(
        player=player_summary, season_year=season_year,
        status=status, stats=stats,
    )


def _share(a: Optional[float], b: Optional[float]) -> Optional[tuple]:
    if a is None or b is None:
        return None
    total = a + b
    if total == 0:
        return (50.0, 50.0)
    return (a / total * 100, b / total * 100)


def compute_composite(s1: SeasonStats, s2: SeasonStats) -> CompositeComparison:
    categories_def = {
        "Offense": [("pts", s1.pts, s2.pts), ("ast", s1.ast, s2.ast), ("ts_pct", s1.ts_pct, s2.ts_pct)],
        "Defense": [("reb", s1.reb, s2.reb), ("stl", s1.stl, s2.stl), ("blk", s1.blk, s2.blk)],
        "Efficiency": [("per", s1.per, s2.per), ("win_shares", s1.win_shares, s2.win_shares),
                        ("ts_pct", s1.ts_pct, s2.ts_pct)],
    }

    categories = []
    for cat_name, stat_pairs in categories_def.items():
        shares = [_share(a, b) for _, a, b in stat_pairs]
        shares = [sh for sh in shares if sh is not None]
        if not shares:
            continue
        p1_avg = sum(sh[0] for sh in shares) / len(shares)
        p2_avg = sum(sh[1] for sh in shares) / len(shares)
        categories.append(CategoryScore(category=cat_name, player_1_score=round(p1_avg, 1),
                                          player_2_score=round(p2_avg, 1)))

    if not categories:
        return CompositeComparison(categories=[], overall_player_1=50.0, overall_player_2=50.0, winner=None)

    overall_1 = sum(c.player_1_score for c in categories) / len(categories)
    overall_2 = sum(c.player_2_score for c in categories) / len(categories)
    winner = 1 if overall_1 > overall_2 else (2 if overall_2 > overall_1 else None)

    return CompositeComparison(
        categories=categories,
        overall_player_1=round(overall_1, 1),
        overall_player_2=round(overall_2, 1),
        winner=winner,
    )


# ---------- Routes ----------

@app.get("/leagues", response_model=list[str])
def list_leagues():
    """Which leagues have data. Frontend uses this to render the league toggle."""
    conn = get_conn()
    rows = conn.execute("SELECT DISTINCT league FROM players ORDER BY league").fetchall()
    conn.close()
    return [r["league"] for r in rows]


@app.get("/players", response_model=list[PlayerSummary])
def list_players(
    search: Optional[str] = Query(None, min_length=1),
    league: str = Query("WNBA", pattern=LEAGUE_PATTERN),
):
    conn = get_conn()
    if search:
        rows = conn.execute(
            "SELECT * FROM players WHERE league = ? AND name LIKE ? ORDER BY name",
            (league, f"%{search}%"),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM players WHERE league = ? ORDER BY name", (league,)
        ).fetchall()
    conn.close()
    return [_player_summary(r) for r in rows]


@app.get("/players/{player_id}", response_model=PlayerSummary)
def get_player(player_id: int):
    conn = get_conn()
    p = fetch_player(conn, player_id)
    conn.close()
    return _player_summary(p)


@app.get("/players/{player_id}/stats", response_model=list[SeasonStats])
def player_career_stats(player_id: int):
    conn = get_conn()
    fetch_player(conn, player_id)
    rows = conn.execute(
        """SELECT * FROM player_season_stats
           WHERE player_id = ? ORDER BY season_year""",
        (player_id,),
    ).fetchall()
    conn.close()
    return [
        SeasonStats(
            season_year=r["season_year"], team_abbreviation=r["team_abbreviation"],
            games_played=r["games_played"],
            minutes=r["minutes"], pts=r["pts"], reb=r["reb"], ast=r["ast"],
            stl=r["stl"], blk=r["blk"], tov=r["tov"], fg_pct=r["fg_pct"],
            fg3_pct=r["fg3_pct"], ft_pct=r["ft_pct"],
            per=r["per"], ts_pct=r["ts_pct"], usg_pct=r["usg_pct"],
            win_shares=r["win_shares"],
        )
        for r in rows
    ]


@app.get("/compare", response_model=CompareResponse)
def compare_players(
    player_1_id: int = Query(..., alias="p1"),
    player_2_id: int = Query(..., alias="p2"),
    # Range widened from WNBA-only (1997+) to cover NBA's much longer
    # history too. Actual validity is enforced by whether data exists for
    # that player/year, not by this bound - this just blocks absurd input.
    season_year: int = Query(..., alias="year", ge=1900, le=2100),
):
    """
    Compare two players for a single season. Note: p1/p2 can technically
    belong to different leagues - nothing here blocks that. The frontend
    is expected to scope player search to one league at a time, so a
    cross-league comparison shouldn't normally happen, but the API itself
    doesn't enforce it (the composite/share-based scoring is mechanically
    league-agnostic, even though comparing across eras/leagues isn't
    analytically meaningful).
    """
    conn = get_conn()
    p1 = build_year_comparison(conn, player_1_id, season_year)
    p2 = build_year_comparison(conn, player_2_id, season_year)
    conn.close()

    composite = None
    if p1.status == "active" and p2.status == "active" and p1.stats and p2.stats:
        composite = compute_composite(p1.stats, p2.stats)

    return CompareResponse(season_year=season_year, player_1=p1, player_2=p2, composite=composite)


@app.get("/players/{player_id}/career", response_model=CareerAverages)
def player_career_averages(player_id: int):
    conn = get_conn()
    p = fetch_player(conn, player_id)
    rows = conn.execute(
        """SELECT * FROM player_season_stats
           WHERE player_id = ? AND games_played IS NOT NULL AND games_played > 0
           ORDER BY season_year""",
        (player_id,),
    ).fetchall()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail="No season stats found for this player")

    total_gp = sum(r["games_played"] for r in rows)

    def weighted_avg(field):
        total = sum((r[field] or 0) * r["games_played"] for r in rows)
        return round(total / total_gp, 1) if total_gp else None

    def best_season(field, label, stat_key):
        candidates = [r for r in rows if r[field] is not None]
        if not candidates:
            return None
        best = max(candidates, key=lambda r: r[field])
        return BestSeasonHighlight(stat=stat_key, label=label,
                                     season_year=best["season_year"], value=best[field])

    highlights = [h for h in [
        best_season("pts", "Best Scoring Season", "pts"),
        best_season("reb", "Best Rebounding Season", "reb"),
        best_season("ast", "Best Playmaking Season", "ast"),
        best_season("win_shares", "Best Win Shares Season", "win_shares"),
    ] if h is not None]

    return CareerAverages(
        player=_player_summary(p),
        seasons_played=len(rows),
        games_played=total_gp,
        ppg=weighted_avg("pts"), rpg=weighted_avg("reb"), apg=weighted_avg("ast"),
        spg=weighted_avg("stl"), bpg=weighted_avg("blk"),
        fg_pct=weighted_avg("fg_pct"), fg3_pct=weighted_avg("fg3_pct"), ft_pct=weighted_avg("ft_pct"),
        highlights=highlights,
    )


@app.get("/rank", response_model=StatRank)
def stat_rank(
    player_id: int = Query(...),
    season_year: int = Query(..., ge=1900, le=2100),
    stat: str = Query(..., pattern="^(pts|reb|ast|stl|blk|win_shares|per|ts_pct)$"),
    min_games: int = Query(10, ge=0),
    league: str = Query("WNBA", pattern=LEAGUE_PATTERN),
):
    """
    Rank a player against everyone else IN THE SAME LEAGUE who played that
    season. Without the league filter here, a season_year like 2024 would
    pool NBA and WNBA players together, which is meaningless.
    """
    conn = get_conn()
    rows = conn.execute(
        f"""SELECT s.player_id, s.{stat} as value
            FROM player_season_stats s JOIN players p ON p.id = s.player_id
            WHERE p.league = ? AND s.season_year = ? AND s.games_played >= ? AND s.{stat} IS NOT NULL
            ORDER BY value DESC""",
        (league, season_year, min_games),
    ).fetchall()
    conn.close()

    pool_size = len(rows)
    player_value = None
    rank = None
    for i, r in enumerate(rows):
        if r["player_id"] == player_id:
            rank = i + 1
            player_value = r["value"]
            break

    return StatRank(player_id=player_id, season_year=season_year, stat=stat,
                     value=player_value, rank=rank, pool_size=pool_size)


# ---------- Similar players (cosine similarity) ----------

SIMILARITY_FEATURES = ["pts", "reb", "ast", "stl", "blk", "fg_pct", "ft_pct",
                        "per", "ts_pct", "usg_pct", "win_shares"]


def _build_feature_vectors(conn, min_games: int, league: str) -> dict:
    """
    Builds one career-average feature vector per eligible player WITHIN
    THE GIVEN LEAGUE ONLY. This is the critical fix for multi-league
    support: without the league filter, an NBA player could get compared
    against WNBA players and vice versa, which produces a "similarity"
    score that doesn't mean anything given how different the two leagues
    are physically and statistically.
    """
    rows = conn.execute(
        """SELECT s.player_id, s.games_played, s.pts, s.reb, s.ast, s.stl, s.blk,
                  s.fg_pct, s.ft_pct, s.per, s.ts_pct, s.usg_pct, s.win_shares
           FROM player_season_stats s JOIN players p ON p.id = s.player_id
           WHERE p.league = ? AND s.games_played IS NOT NULL AND s.games_played > 0""",
        (league,),
    ).fetchall()

    totals = {}
    for r in rows:
        pid = r["player_id"]
        gp = r["games_played"]
        bucket = totals.setdefault(pid, {f: 0.0 for f in SIMILARITY_FEATURES})
        bucket["gp"] = bucket.get("gp", 0) + gp
        for f in SIMILARITY_FEATURES:
            val = r[f]
            if val is not None:
                bucket[f] += val * gp

    vectors = {}
    for pid, bucket in totals.items():
        total_gp = bucket["gp"]
        if total_gp < min_games:
            continue
        vectors[pid] = {f: bucket[f] / total_gp for f in SIMILARITY_FEATURES}
    return vectors


def _standardize(vectors: dict) -> dict:
    if not vectors:
        return {}
    means, stdevs = {}, {}
    n = len(vectors)
    for f in SIMILARITY_FEATURES:
        values = [v[f] for v in vectors.values()]
        mean = sum(values) / n
        variance = sum((x - mean) ** 2 for x in values) / n
        means[f] = mean
        stdevs[f] = variance ** 0.5

    standardized = {}
    for pid, vec in vectors.items():
        standardized[pid] = {
            f: (vec[f] - means[f]) / stdevs[f] if stdevs[f] > 0 else 0.0
            for f in SIMILARITY_FEATURES
        }
    return standardized


def _cosine_similarity(a: dict, b: dict) -> float:
    dot = sum(a[f] * b[f] for f in SIMILARITY_FEATURES)
    norm_a = sum(a[f] ** 2 for f in SIMILARITY_FEATURES) ** 0.5
    norm_b = sum(b[f] ** 2 for f in SIMILARITY_FEATURES) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


@app.get("/players/{player_id}/similar", response_model=SimilarPlayersResponse)
def similar_players(
    player_id: int,
    limit: int = Query(5, ge=1, le=20),
    min_games: int = Query(50, ge=0),
):
    """
    Finds the most statistically similar players by career profile,
    WITHIN THE TARGET PLAYER'S OWN LEAGUE. The league isn't a query param
    here on purpose - it's derived from the target player's own row, so
    there's no way to accidentally request a mismatched pool.
    """
    conn = get_conn()
    target = fetch_player(conn, player_id)
    league = target["league"]

    raw_vectors = _build_feature_vectors(conn, min_games, league)
    if player_id not in raw_vectors:
        conn.close()
        raise HTTPException(
            status_code=404,
            detail=f"Player {player_id} doesn't have {min_games}+ career games, "
                    "not enough sample size for a reliable similarity comparison."
        )

    standardized = _standardize(raw_vectors)
    target_vec = standardized[player_id]

    scored = []
    for pid, vec in standardized.items():
        if pid == player_id:
            continue
        cos_sim = _cosine_similarity(target_vec, vec)
        similarity_pct = max(0.0, min(1.0, (cos_sim + 1) / 2)) * 100
        scored.append((pid, similarity_pct))

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:limit]

    results = []
    for pid, pct in top:
        p = fetch_player(conn, pid)
        vec = raw_vectors[pid]
        results.append(SimilarPlayer(
            player=_player_summary(p),
            similarity_pct=round(pct, 1),
            ppg=round(vec["pts"], 1), rpg=round(vec["reb"], 1), apg=round(vec["ast"], 1),
        ))

    conn.close()
    return SimilarPlayersResponse(
        target_player_id=player_id, min_career_games=min_games,
        pool_size=len(raw_vectors), results=results,
    )


# ---------- Draft Class Explorer ----------

class DraftClassPlayer(BaseModel):
    player: PlayerSummary
    career_games: int
    career_ppg: Optional[float]


class DraftClassResponse(BaseModel):
    draft_year: int
    count: int
    players: list[DraftClassPlayer]


@app.get("/draft-years", response_model=list[int])
def list_draft_years(league: str = Query("WNBA", pattern=LEAGUE_PATTERN)):
    conn = get_conn()
    rows = conn.execute(
        "SELECT DISTINCT draft_year FROM players WHERE league = ? AND draft_year IS NOT NULL ORDER BY draft_year DESC",
        (league,),
    ).fetchall()
    conn.close()
    return [r["draft_year"] for r in rows]


@app.get("/draft-classes/{draft_year}", response_model=DraftClassResponse)
def draft_class(draft_year: int, league: str = Query("WNBA", pattern=LEAGUE_PATTERN)):
    conn = get_conn()
    players = conn.execute(
        "SELECT * FROM players WHERE draft_year = ? AND league = ? ORDER BY name",
        (draft_year, league),
    ).fetchall()

    results = []
    for p in players:
        season_rows = conn.execute(
            """SELECT games_played, pts FROM player_season_stats
               WHERE player_id = ? AND games_played IS NOT NULL AND games_played > 0""",
            (p["id"],),
        ).fetchall()
        total_gp = sum(r["games_played"] for r in season_rows)
        weighted_pts = sum((r["pts"] or 0) * r["games_played"] for r in season_rows)
        career_ppg = round(weighted_pts / total_gp, 1) if total_gp else None

        results.append(DraftClassPlayer(
            player=_player_summary(p),
            career_games=total_gp, career_ppg=career_ppg,
        ))

    conn.close()
    results.sort(key=lambda r: r.career_games, reverse=True)
    return DraftClassResponse(draft_year=draft_year, count=len(results), players=results)


# ---------- Season Finder ----------

class SeasonFinderResult(BaseModel):
    player: PlayerSummary
    season_year: int
    team_abbreviation: Optional[str]
    games_played: Optional[int]
    pts: Optional[float]
    reb: Optional[float]
    ast: Optional[float]
    stl: Optional[float]
    blk: Optional[float]
    ts_pct: Optional[float]
    per: Optional[float]
    win_shares: Optional[float]


class SeasonFinderResponse(BaseModel):
    count: int
    results: list[SeasonFinderResult]


@app.get("/season-finder", response_model=SeasonFinderResponse)
def season_finder(
    min_pts: Optional[float] = None,
    min_reb: Optional[float] = None,
    min_ast: Optional[float] = None,
    min_ts_pct: Optional[float] = Query(None, description="Fraction 0-1, e.g. 0.6 for 60%"),
    min_per: Optional[float] = None,
    min_win_shares: Optional[float] = None,
    position: Optional[str] = None,
    team: Optional[str] = None,
    draft_year: Optional[int] = None,
    season_year: Optional[int] = None,
    league: str = Query("WNBA", pattern=LEAGUE_PATTERN),
    min_games: int = Query(10, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    conditions = ["p.league = ?", "s.games_played >= ?"]
    params = [league, min_games]

    filters = [
        (min_pts, "s.pts >= ?"), (min_reb, "s.reb >= ?"), (min_ast, "s.ast >= ?"),
        (min_ts_pct, "s.ts_pct >= ?"), (min_per, "s.per >= ?"), (min_win_shares, "s.win_shares >= ?"),
        (season_year, "s.season_year = ?"), (team, "s.team_abbreviation = ?"),
        (position, "p.position = ?"), (draft_year, "p.draft_year = ?"),
    ]
    for value, clause in filters:
        if value is not None:
            conditions.append(clause)
            params.append(value)

    where_clause = " AND ".join(conditions)
    params.append(limit)

    conn = get_conn()
    rows = conn.execute(
        f"""SELECT p.id, p.name, p.league, p.draft_year, p.last_active_year, p.position, p.team_abbreviation,
                   s.season_year, s.team_abbreviation as season_team, s.games_played,
                   s.pts, s.reb, s.ast, s.stl, s.blk, s.ts_pct, s.per, s.win_shares
            FROM player_season_stats s JOIN players p ON p.id = s.player_id
            WHERE {where_clause}
            ORDER BY s.pts DESC
            LIMIT ?""",
        params,
    ).fetchall()
    conn.close()

    results = [
        SeasonFinderResult(
            player=_player_summary(r),
            season_year=r["season_year"], team_abbreviation=r["season_team"],
            games_played=r["games_played"], pts=r["pts"], reb=r["reb"], ast=r["ast"],
            stl=r["stl"], blk=r["blk"], ts_pct=r["ts_pct"], per=r["per"], win_shares=r["win_shares"],
        )
        for r in rows
    ]
    return SeasonFinderResponse(count=len(results), results=results)

from groups import router as groups_router
app.include_router(groups_router)


from awards import router as awards_router
app.include_router(awards_router)

from teams import router as teams_router
app.include_router(teams_router)
