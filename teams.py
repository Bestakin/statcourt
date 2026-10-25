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

# Basketball-Reference team codes -> names (names are era-specific where the code is, e.g. NJN, SEA, WSB).
TEAM_NAMES = {
    "NBA": {
        "ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BRK": "Brooklyn Nets", "NJN": "New Jersey Nets",
        "CHA": "Charlotte Bobcats", "CHH": "Charlotte Hornets", "CHO": "Charlotte Hornets", "CHI": "Chicago Bulls",
        "CLE": "Cleveland Cavaliers", "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons",
        "GSW": "Golden State Warriors", "HOU": "Houston Rockets", "IND": "Indiana Pacers", "KCK": "Kansas City Kings",
        "LAC": "Los Angeles Clippers", "SDC": "San Diego Clippers", "LAL": "Los Angeles Lakers",
        "MEM": "Memphis Grizzlies", "VAN": "Vancouver Grizzlies", "MIA": "Miami Heat", "MIL": "Milwaukee Bucks",
        "MIN": "Minnesota Timberwolves", "NOP": "New Orleans Pelicans", "NOH": "New Orleans Hornets",
        "NOK": "New Orleans/Oklahoma City Hornets", "NYK": "New York Knicks", "OKC": "Oklahoma City Thunder",
        "SEA": "Seattle SuperSonics", "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers", "PHO": "Phoenix Suns",
        "POR": "Portland Trail Blazers", "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs",
        "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "WAS": "Washington Wizards", "WSB": "Washington Bullets",
    },
    "WNBA": {
        "ATL": "Atlanta Dream", "CHI": "Chicago Sky", "CON": "Connecticut Sun", "DAL": "Dallas Wings",
        "IND": "Indiana Fever", "LVA": "Las Vegas Aces", "LAS": "Los Angeles Sparks", "MIN": "Minnesota Lynx",
        "NYL": "New York Liberty", "PHO": "Phoenix Mercury", "SEA": "Seattle Storm", "WAS": "Washington Mystics",
        "GSV": "Golden State Valkyries", "TOR": "Toronto Tempo", "POR": "Portland Fire",
        "CHA": "Charlotte Sting", "CLE": "Cleveland Rockers", "DET": "Detroit Shock", "HOU": "Houston Comets",
        "MIA": "Miami Sol", "ORL": "Orlando Miracle", "SAC": "Sacramento Monarchs", "SAN": "San Antonio Stars",
        "TUL": "Tulsa Shock", "UTA": "Utah Starzz",
    },
}


def _name(league, code):
    return TEAM_NAMES.get(league, {}).get(code)


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
    name: Optional[str] = None
    players: int
    usable: bool
    reason: Optional[str] = None


class TeamList(BaseModel):
    league: str
    season_year: int
    teams: list[TeamInfo]


class TeamComparison(BaseModel):
    league: str
    season_year: int          # team A's season
    season_year_b: int        # team B's season (same as season_year unless comparing different seasons)
    team_a: str
    team_b: str
    name_a: Optional[str] = None
    name_b: Optional[str] = None
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
            out.append(TeamInfo(abbreviation=tm, name=_name(league, tm), players=len(rows), usable=ok, reason=why))
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
    year_b: Optional[int] = Query(None, ge=1946, le=2100, description="team B's season; defaults to `year`"),
):
    yb = year if year_b is None else year_b
    _check_year(league, year)
    _check_year(league, yb)
    a, b = a.upper(), b.upper()
    if a == b and year == yb:
        raise HTTPException(400, "Pick two different teams, or the same team in two different seasons")
    conn = _conn()
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(player_season_stats)")}
        if "t_fga" not in cols:
            raise HTTPException(503, "Season totals haven't been loaded into this database yet")
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "player_season_stints" not in tables:
            raise HTTPException(503, "Team data hasn't been loaded into this database yet")
        sides, fives = [], []
        for tm, yr in ((a, year), (b, yb)):
            rows = _team_rows(conn, league, yr, tm)
            ok, why = _usable(rows)
            if not ok:
                raise HTTPException(404, f"{tm} {yr}: {why}")
            five = _five(rows)
            side, _ = groups._side(conn, [f.player_id for f in five], "season", yr, team=tm)
            sides.append(side)
            fives.append(five)
    finally:
        conn.close()
    if sides[0].totals.players == 0 or sides[1].totals.players == 0:
        raise HTTPException(404, "One team has no players with data for that selection")
    return TeamComparison(
        league=league, season_year=year, season_year_b=yb, team_a=a, team_b=b,
        name_a=_name(league, a), name_b=_name(league, b), five_a=fives[0], five_b=fives[1],
        a=sides[0], b=sides[1],
        note="Each team's five is the players with the most games started for that team in its season "
             "(ties broken by minutes). It is not a confirmed lineup. Traded players count only for "
             "their games with that team. When two different seasons are compared, each side uses its own "
             "season, so differences in era (pace, three-point volume) are part of what you see.")
