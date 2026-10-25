"""
teams.py - Team Comparison endpoints for StatCourt.

Wire into main.py with two lines (once):
    from teams import router as teams_router
    app.include_router(teams_router)

Needs groups.py (it reuses Group Comparison's math) and the player_season_stints table.

Honest-data rules:
  * a team's "five" = the five players with the MOST GAMES STARTED for that team that season
    (ties: total minutes, then games played). It is labelled "most starts", never "the starting lineup".
  * each player counts only for his games WITH THAT TEAM (one stints row), never his whole traded season
  * a team-season is offered only if its starts add up (sum of games started is a multiple of 5);
    NBA before 1982 has no reliable starts data, so it is not offered at all
  * numbers side by side, no team score, no winner
"""
import sqlite3
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import groups

router = APIRouter()
FIRST_YEAR = {"WNBA": 1997, "NBA": 1982}   # NBA 1982 = the 1981-82 season, the first with games started


def _conn():
    c = sqlite3.connect(groups.DB_PATH)
    c.row_factory = sqlite3.Row
    return c


class FiveMan(BaseModel):
    rank: int
    player_id: int
    name: str
    games_started: int
    games_played: int


class TeamInfo(BaseModel):
    abbreviation: str
    players: int
    usable: bool
    reason: Optional[str] = None


class TeamList(BaseModel):
    league: str
    season_year: int
    teams: list[TeamInfo]


class TeamComparison(BaseModel):
    league: str
    season_year: int
    team_a: str
    team_b: str
    five_a: list[FiveMan]
    five_b: list[FiveMan]
    a: groups.GroupSide
    b: groups.GroupSide
    note: str


def _check_year(league, year):
    if league not in FIRST_YEAR:
        raise HTTPException(400, "league must be WNBA or NBA")
    if year < FIRST_YEAR[league]:
        raise HTTPException(404, f"Team comparison starts in {FIRST_YEAR[league]} for {league} "
                                 "(games-started data before that isn't reliable)")


def _team_rows(conn, league, year, team):
    return conn.execute("""
        SELECT t.player_id, p.name, COALESCE(t.games_started, 0) AS gs, t.games_started AS gs_raw,
               COALESCE(t.games_played, 0) AS gp, COALESCE(t.minutes, 0) * COALESCE(t.games_played, 0) AS mins
        FROM player_season_stints t JOIN players p ON p.id = t.player_id
        WHERE p.league = ? AND t.season_year = ? AND t.team_abbreviation = ?
        ORDER BY gs DESC, mins DESC, gp DESC, p.name""", (league, year, team)).fetchall()


def _usable(rows):
    if not rows:
        return False, "no players found for that team and season"
    if any(r["gs_raw"] is None for r in rows):
        return False, "games-started data is incomplete for this team"
    total = sum(r["gs"] for r in rows)
    if total == 0 or total % 5 != 0:
        return False, "games-started numbers don't add up for this team (source data problem)"
    return True, None


@router.get("/teams", response_model=TeamList)
def list_teams(league: str = Query(..., pattern="^(WNBA|NBA)$"), year: int = Query(..., ge=1946, le=2100)):
    _check_year(league, year)
    conn = _conn()
    try:
        names = [r[0] for r in conn.execute("""
            SELECT DISTINCT t.team_abbreviation FROM player_season_stints t JOIN players p ON p.id = t.player_id
            WHERE p.league = ? AND t.season_year = ? AND t.team_abbreviation IS NOT NULL
            ORDER BY 1""", (league, year))]
        out = []
        for tm in names:
            rows = _team_rows(conn, league, year, tm)
            ok, why = _usable(rows)
            out.append(TeamInfo(abbreviation=tm, players=len(rows), usable=ok, reason=why))
    finally:
        conn.close()
    if not out:
        raise HTTPException(404, "No team data for that season")
    return TeamList(league=league, season_year=year, teams=out)


def _five(rows):
    return [FiveMan(rank=i, player_id=r["player_id"], name=r["name"],
                    games_started=int(r["gs"]), games_played=int(r["gp"]))
            for i, r in enumerate(rows[:5], 1)]


@router.get("/compare-teams", response_model=TeamComparison)
def compare_teams(
    league: str = Query(..., pattern="^(WNBA|NBA)$"),
    year: int = Query(..., ge=1946, le=2100),
    a: str = Query(..., min_length=2, max_length=4, description="team abbreviation, side A"),
    b: str = Query(..., min_length=2, max_length=4, description="team abbreviation, side B"),
):
    _check_year(league, year)
    a, b = a.upper(), b.upper()
    if a == b:
        raise HTTPException(400, "Pick two different teams")
    conn = _conn()
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(player_season_stats)")}
        if "t_fga" not in cols:
            raise HTTPException(503, "Season totals haven't been loaded into this database yet")
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "player_season_stints" not in tables:
            raise HTTPException(503, "Team data hasn't been loaded into this database yet")
        sides, fives = [], []
        for tm in (a, b):
            rows = _team_rows(conn, league, year, tm)
            ok, why = _usable(rows)
            if not ok:
                raise HTTPException(404, f"{tm} {year}: {why}")
            five = _five(rows)
            side, _ = groups._side(conn, [f.player_id for f in five], "season", year, team=tm)
            sides.append(side)
            fives.append(five)
    finally:
        conn.close()
    if sides[0].totals.players == 0 or sides[1].totals.players == 0:
        raise HTTPException(404, "One team has no players with data for that selection")
    return TeamComparison(
        league=league, season_year=year, team_a=a, team_b=b, five_a=fives[0], five_b=fives[1],
        a=sides[0], b=sides[1],
        note="Each team's five is the players with the most games started for that team this season "
             "(ties broken by minutes). It is not a confirmed lineup. Traded players count only for "
             "their games with that team.")
