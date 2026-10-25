"""
career_extra.py - extra career per-game numbers (turnovers, minutes) for Build Your Comparison.

Wire into main.py with two lines (once):
    from career_extra import router as career_extra_router
    app.include_router(career_extra_router)

The existing /players/{id}/career endpoint is NOT touched.

Rules (the frontend shows exactly what this returns):
  * TOV per game = sum of season turnover TOTALS / sum of games, over seasons where turnovers were recorded.
  * MIN per game = sum of (minutes per game x games) / sum of games, over seasons where minutes exist.
    (= total minutes / games, so seasons with more games count for more.)
  * A season whose value is missing (NULL) is NOT counted as zero - it is left out and reported as uncovered.
    A genuine 0 is a real value and is counted.
  * Coverage is measured in GAMES, not seasons: covered_games / total_games.
  * Fewer than 50% of the player's games covered -> value is null ("unavailable"). Exactly 50% is enough.
"""
import sqlite3
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import groups

router = APIRouter()
MIN_COVERAGE = 0.5


def _conn():
    c = sqlite3.connect(groups.DB_PATH)
    c.row_factory = sqlite3.Row
    return c


class Metric(BaseModel):
    value: Optional[float]          # per game, 1 decimal; null = unavailable
    covered_games: int
    total_games: int
    covered_seasons: int
    total_seasons: int


class CareerExtra(BaseModel):
    player_id: int
    tov: Metric
    min: Metric


def _metric(rows, per_game):
    """rows: seasons with games_played > 0. per_game(row) -> (total for the season | None)."""
    total_games = sum(r["games_played"] for r in rows)
    cov_games = cov_seasons = 0
    acc = 0.0
    for r in rows:
        t = per_game(r)
        if t is None:
            continue
        acc += t
        cov_games += r["games_played"]
        cov_seasons += 1
    ok = total_games > 0 and cov_games > 0 and cov_games / total_games >= MIN_COVERAGE
    return Metric(value=round(acc / cov_games, 1) if ok else None,
                  covered_games=cov_games, total_games=total_games,
                  covered_seasons=cov_seasons, total_seasons=len(rows))


@router.get("/career-extra", response_model=CareerExtra)
def career_extra(player_id: int = Query(...)):
    conn = _conn()
    try:
        if conn.execute("SELECT 1 FROM players WHERE id=?", (player_id,)).fetchone() is None:
            raise HTTPException(404, f"Player {player_id} not found")
        rows = conn.execute(
            "SELECT games_played, minutes, t_tov FROM player_season_stats "
            "WHERE player_id=? AND games_played>0", (player_id,)).fetchall()
        return CareerExtra(
            player_id=player_id,
            tov=_metric(rows, lambda r: r["t_tov"]),
            min=_metric(rows, lambda r: None if r["minutes"] is None else r["minutes"] * r["games_played"]),
        )
    finally:
        conn.close()
