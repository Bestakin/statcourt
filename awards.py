"""
awards.py - Awards endpoints for StatCourt.

Wire into main.py with two lines (once, near the other include_router lines):
    from awards import router as awards_router
    app.include_router(awards_router)

Data comes from the `awards` table written by seed_awards.py.
Endpoints:
    GET /awards/catalog?league=WNBA         awards available + season range + count
    GET /awards?league=WNBA&award=mvp       year-by-year winners, newest first
    GET /players/{player_id}/awards         one player's awards, grouped, with counts
"""
import sqlite3
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()
DB_PATH = "wnba.db"
LEAGUES = ("WNBA", "NBA")

# Short labels for badges ("5x MVP"); display order for profile badges.
SHORT = {
    "mvp": "MVP", "dpoy": "DPOY", "roy": "ROY", "mip": "MIP",
    "sixth_woman": "6WOY", "sixth_man": "6MOY",
    "finals_mvp": "Finals MVP", "all_star_mvp": "All-Star MVP", "cup_mvp": "Cup MVP",
}
ORDER = ["mvp", "finals_mvp", "dpoy", "roy", "mip", "sixth_woman", "sixth_man", "all_star_mvp", "cup_mvp"]


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _require_table(c):
    ok = c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='awards'").fetchone()
    if not ok:
        raise HTTPException(503, "Awards data is not loaded yet")


def _league(league: str) -> str:
    league = league.upper()
    if league not in LEAGUES:
        raise HTTPException(400, "league must be WNBA or NBA")
    return league


class AwardInfo(BaseModel):
    key: str
    name: str
    short: str
    first_season: int
    last_season: int
    count: int


class Winner(BaseModel):
    season_year: int
    player_id: Optional[int]
    player_name: str
    team_abbreviation: Optional[str]
    is_tie: bool


class AwardHistory(BaseModel):
    league: str
    award: str
    name: str
    winners: List[Winner]


class PlayerAward(BaseModel):
    award: str
    name: str
    short: str
    count: int
    seasons: List[int]


class PlayerAwards(BaseModel):
    player_id: int
    total: int
    awards: List[PlayerAward]


@router.get("/awards/catalog", response_model=List[AwardInfo])
def catalog(league: str = Query("WNBA")):
    league = _league(league)
    with _conn() as c:
        _require_table(c)
        rows = c.execute(
            """SELECT award_key, award_name, MIN(season_year) a, MAX(season_year) b, COUNT(*) n
               FROM awards WHERE league=? GROUP BY award_key, award_name""", (league,)).fetchall()
    out = [AwardInfo(key=r["award_key"], name=r["award_name"], short=SHORT.get(r["award_key"], r["award_key"]),
                     first_season=r["a"], last_season=r["b"], count=r["n"]) for r in rows]
    out.sort(key=lambda x: ORDER.index(x.key) if x.key in ORDER else 99)
    return out


@router.get("/awards", response_model=AwardHistory)
def award_history(league: str = Query("WNBA"), award: str = Query(...)):
    league = _league(league)
    with _conn() as c:
        _require_table(c)
        rows = c.execute(
            """SELECT a.award_name, a.season_year, a.player_id, a.player_name, a.is_tie,
                      COALESCE(a.team_abbreviation, s.team_abbreviation) AS team
               FROM awards a
               LEFT JOIN player_season_stats s
                 ON s.player_id = a.player_id AND s.season_year = a.season_year
               WHERE a.league=? AND a.award_key=?
               ORDER BY a.season_year DESC, a.player_name""", (league, award)).fetchall()
    if not rows:
        raise HTTPException(404, "No such award for that league")
    seen, winners = set(), []
    for r in rows:   # the join can repeat a row if a player has several stats rows that season
        k = (r["season_year"], r["player_name"])
        if k in seen:
            continue
        seen.add(k)
        winners.append(Winner(season_year=r["season_year"], player_id=r["player_id"],
                              player_name=r["player_name"], team_abbreviation=r["team"],
                              is_tie=bool(r["is_tie"])))
    return AwardHistory(league=league, award=award, name=rows[0]["award_name"], winners=winners)


@router.get("/players/{player_id}/awards", response_model=PlayerAwards)
def player_awards(player_id: int):
    with _conn() as c:
        _require_table(c)
        rows = c.execute(
            "SELECT award_key, award_name, season_year FROM awards WHERE player_id=? ORDER BY season_year",
            (player_id,)).fetchall()
    by = {}
    for r in rows:
        d = by.setdefault(r["award_key"], {"name": r["award_name"], "seasons": []})
        d["seasons"].append(r["season_year"])
    keys = sorted(by, key=lambda k: ORDER.index(k) if k in ORDER else 99)
    awards = [PlayerAward(award=k, name=by[k]["name"], short=SHORT.get(k, k),
                          count=len(by[k]["seasons"]), seasons=by[k]["seasons"]) for k in keys]
    return PlayerAwards(player_id=player_id, total=len(rows), awards=awards)