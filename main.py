"""
main.py — WNBA Stats Compare API

Reads only from local SQLite (wnba.db). Never calls stats.nba.com live.
Run seed_data.py first to populate the DB.
"""

import sqlite3
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="WNBA Stats Compare API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_origin_regex=r"http://(192\.168|10\.0)\.\d+\.\d+:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "wnba.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ---------- Response models ----------

class PlayerSummary(BaseModel):
    id: int
    name: str
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
    stat: str            # "pts" | "reb" | "ast" | "win_shares"
    label: str            # friendly label, e.g. "Best Scoring Season"
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
    rank: Optional[int]     # 1 = best
    pool_size: int          # how many qualifying players that season


class PlayerYearComparison(BaseModel):
    player: PlayerSummary
    season_year: int
    status: str            # "active" | "not_yet_drafted" | "retired" | "no_data"
    stats: Optional[SeasonStats] = None


class CategoryScore(BaseModel):
    category: str
    player_1_score: float   # 0-100, share of the combined total for this category
    player_2_score: float


class CompositeComparison(BaseModel):
    categories: list[CategoryScore]
    overall_player_1: float
    overall_player_2: float
    winner: Optional[int]   # 1 or 2, or None if tied


class SimilarPlayer(BaseModel):
    player: PlayerSummary
    similarity_pct: float   # 0-100, higher = more similar
    ppg: Optional[float]
    rpg: Optional[float]
    apg: Optional[float]


class SimilarPlayersResponse(BaseModel):
    target_player_id: int
    min_career_games: int
    pool_size: int          # how many players were eligible for comparison
    results: list[SimilarPlayer]


class CompareResponse(BaseModel):
    season_year: int
    player_1: PlayerYearComparison
    player_2: PlayerYearComparison
    composite: Optional[CompositeComparison] = None


# ---------- Helpers ----------

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
    player_summary = PlayerSummary(
        id=p["id"], name=p["name"], draft_year=p["draft_year"],
        last_active_year=p["last_active_year"],
        position=p["position"], team_abbreviation=p["team_abbreviation"],
    )

    draft_year = p["draft_year"]
    last_active_year = p["last_active_year"]

    if draft_year is not None and season_year < draft_year:
        status = "not_yet_drafted"
    elif last_active_year is not None and season_year > last_active_year:
        # Note: this means "no stats past this point in our scraped data,"
        # which is a good proxy for retired but isn't a certainty — a player
        # could have simply missed the most recent scraped season to injury.
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
            # In range, but no row for this specific season (e.g. sat out
            # with injury). Distinct from not-yet-drafted or retired.
            status = "no_data"

    return PlayerYearComparison(
        player=player_summary, season_year=season_year,
        status=status, stats=stats,
    )


def _share(a: Optional[float], b: Optional[float]) -> Optional[tuple]:
    """Returns (a's % share, b's % share) of a+b, scale-invariant so pts (~20)
    and pct stats (~0.5) can be averaged together fairly within a category.
    Returns None if either value is missing or both are zero."""
    if a is None or b is None:
        return None
    total = a + b
    if total == 0:
        return (50.0, 50.0)
    return (a / total * 100, b / total * 100)


def compute_composite(s1: SeasonStats, s2: SeasonStats) -> CompositeComparison:
    """
    Builds a transparent, explainable 'who had the better season' score.
    This is an original analytical formula, not an official metric —
    say so in the UI. Each category score is the mean of per-stat shares
    (scale-invariant), so raw counting stats and percentage stats can mix
    within a category without one dominating.
    """
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

@app.get("/players", response_model=list[PlayerSummary])
def list_players(search: Optional[str] = Query(None, min_length=1)):
    conn = get_conn()
    if search:
        rows = conn.execute(
            "SELECT * FROM players WHERE name LIKE ? ORDER BY name",
            (f"%{search}%",),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM players ORDER BY name").fetchall()
    conn.close()
    return [
        PlayerSummary(id=r["id"], name=r["name"], draft_year=r["draft_year"],
                       last_active_year=r["last_active_year"],
                       position=r["position"], team_abbreviation=r["team_abbreviation"])
        for r in rows
    ]


@app.get("/players/{player_id}", response_model=PlayerSummary)
def get_player(player_id: int):
    conn = get_conn()
    p = fetch_player(conn, player_id)
    conn.close()
    return PlayerSummary(id=p["id"], name=p["name"], draft_year=p["draft_year"],
                          last_active_year=p["last_active_year"],
                          position=p["position"], team_abbreviation=p["team_abbreviation"])


@app.get("/players/{player_id}/stats", response_model=list[SeasonStats])
def player_career_stats(player_id: int):
    conn = get_conn()
    fetch_player(conn, player_id)  # 404s if missing
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
    season_year: int = Query(..., alias="year", ge=1997, le=2100),
):
    """
    Compare two players for a single season. `status` on each side is one of:
      - "active": player was in the league, stats included
      - "not_yet_drafted": season is before their draft year -> stats null
      - "retired": season is after their last known active year -> stats null
      - "no_data": in their active range but no stats row that year
        (e.g. missed the season with injury) -> stats null
    Frontend should map each status to friendly copy rather than treating
    every null-stats case as the same thing.
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
        player=PlayerSummary(id=p["id"], name=p["name"], draft_year=p["draft_year"],
                              last_active_year=p["last_active_year"],
                              position=p["position"], team_abbreviation=p["team_abbreviation"]),
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
    season_year: int = Query(..., ge=1997, le=2100),
    stat: str = Query(..., pattern="^(pts|reb|ast|stl|blk|win_shares|per|ts_pct)$"),
    min_games: int = Query(10, ge=0, description="Minimum games played to qualify for ranking"),
):
    """
    Rank a player against everyone else who played that season for a given
    stat. min_games filters out small-sample noise (e.g. a 2-game callup
    with a gaudy per-game average).
    """
    conn = get_conn()
    rows = conn.execute(
        f"""SELECT player_id, {stat} as value FROM player_season_stats
            WHERE season_year = ? AND games_played >= ? AND {stat} IS NOT NULL
            ORDER BY value DESC""",
        (season_year, min_games),
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


def _build_feature_vectors(conn, min_games: int) -> dict:
    """
    Builds one career-average feature vector per eligible player, using the
    same games-played-weighted averaging as the /career endpoint. Returns
    {player_id: {feature: value}}. Players below min_games are excluded
    entirely so a 3-game callup doesn't distort anyone's neighborhood.
    """
    rows = conn.execute(
        """SELECT player_id, games_played, pts, reb, ast, stl, blk,
                  fg_pct, ft_pct, per, ts_pct, usg_pct, win_shares
           FROM player_season_stats
           WHERE games_played IS NOT NULL AND games_played > 0"""
    ).fetchall()

    totals = {}  # player_id -> {feature: weighted_sum, "gp": total_gp}
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
    """Z-score each feature across the population so pts (~0-25) and
    fg_pct (~0-0.6) contribute fairly to the distance calculation instead
    of raw-scale stats dominating."""
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
    min_games: int = Query(50, ge=0, description="Minimum career games to be eligible"),
):
    """
    Finds the most statistically similar players by career profile.
    Pipeline: weighted career averages -> z-score standardization across
    the whole eligible player pool -> cosine similarity against every
    other player -> top N by score. Built without an ML library so the
    whole pipeline is auditable in this file.
    """
    conn = get_conn()
    fetch_player(conn, player_id)  # 404s if the target player doesn't exist

    raw_vectors = _build_feature_vectors(conn, min_games)
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
        # Cosine similarity on standardized stats typically lands in a
        # positive-but-imperfect range for comparable players; clamp and
        # scale to a 0-100 "similarity %" that's intuitive to read.
        similarity_pct = max(0.0, min(1.0, (cos_sim + 1) / 2)) * 100
        scored.append((pid, similarity_pct))

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:limit]

    results = []
    for pid, pct in top:
        p = fetch_player(conn, pid)
        vec = raw_vectors[pid]
        results.append(SimilarPlayer(
            player=PlayerSummary(id=p["id"], name=p["name"], draft_year=p["draft_year"],
                                  last_active_year=p["last_active_year"],
                                  position=p["position"], team_abbreviation=p["team_abbreviation"]),
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
def list_draft_years():
    """All draft years present in the data, for populating a year selector."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT DISTINCT draft_year FROM players WHERE draft_year IS NOT NULL ORDER BY draft_year DESC"
    ).fetchall()
    conn.close()
    return [r["draft_year"] for r in rows]


@app.get("/draft-classes/{draft_year}", response_model=DraftClassResponse)
def draft_class(draft_year: int):
    """
    All players from a given draft year. NOTE: we don't have actual draft
    pick order (that's a separate Basketball-Reference page we haven't
    scraped) — sorted by career games played as a reasonable "impact" proxy
    instead. This is NOT real draft position, and the frontend should not
    present it as such.
    """
    conn = get_conn()
    players = conn.execute(
        "SELECT * FROM players WHERE draft_year = ? ORDER BY name", (draft_year,)
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
            player=PlayerSummary(id=p["id"], name=p["name"], draft_year=p["draft_year"],
                                  last_active_year=p["last_active_year"],
                                  position=p["position"], team_abbreviation=p["team_abbreviation"]),
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
    min_games: int = Query(10, ge=0, description="Minimum games that season to avoid small-sample noise"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Exploration query: find every player-season matching a set of stat
    thresholds and filters. All filters are optional and AND together.
    Position and draft_year come from the players table; team and games
    are season-specific (a player's team can change year to year).
    """
    conditions = ["s.games_played >= ?"]
    params = [min_games]

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
        f"""SELECT p.id, p.name, p.draft_year, p.last_active_year, p.position, p.team_abbreviation,
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
            player=PlayerSummary(id=r["id"], name=r["name"], draft_year=r["draft_year"],
                                  last_active_year=r["last_active_year"],
                                  position=r["position"], team_abbreviation=r["team_abbreviation"]),
            season_year=r["season_year"], team_abbreviation=r["season_team"],
            games_played=r["games_played"], pts=r["pts"], reb=r["reb"], ast=r["ast"],
            stl=r["stl"], blk=r["blk"], ts_pct=r["ts_pct"], per=r["per"], win_shares=r["win_shares"],
        )
        for r in rows
    ]
    return SeasonFinderResponse(count=len(results), results=results)
