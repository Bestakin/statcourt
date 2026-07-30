# WNBA Stats Compare — Backend Scaffold

## What's here
- `seed_data.py` — one-time script that pulls WNBA player + season stats via
  `py_ball` (stats.nba.com/wnba wrapper) into a local `wnba.db` SQLite file.
- `main.py` — FastAPI backend that reads only from `wnba.db`. It never calls
  stats.nba.com live, so your app stays fast and demo-safe.

## Setup

```bash
pip install -r requirements.txt --break-system-packages
python seed_data.py --players --stats
uvicorn main:app --reload --port 8005
```

Then hit `http://localhost:8005/docs` to see the interactive API.

## ⚠️ Important: verify field names before trusting the seed script

I built this against `py_ball`'s documented endpoints (`playerindex` and
`playercareerstats`), which are real and confirmed to exist. But stats.nba.com
is an **unofficial, undocumented API** — exact JSON field names (like
`DRAFT_YEAR`, `SEASON_ID`, `PERSON_ID`) can drift or vary between
NBA vs WNBA responses, and I can't test live calls from my sandbox
(stats.nba.com isn't in my allowed network list).

**Before your first real seed run**, do this quick check:

```python
from py_ball import league
HEADERS = {'User-Agent': 'Mozilla/5.0 ...'}  # same as in seed_data.py
idx = league.League(headers=HEADERS, endpoint='playerindex', league_id='10')
print(idx.data.keys())
print(idx.data[list(idx.data.keys())[0]][0])  # inspect first row's actual keys
```

Do the same for `player.Player(..., endpoint='playercareerstats', player_id='<some_wnba_id>', league_id='10')`
to confirm the season stats field names. Then adjust the `.get('...')` calls
in `seed_data.py` to match. This should take 10-15 minutes, not a full day.

## If py_ball gives you 403s or header trouble

Fallback: pull one season's basic + advanced stats from Basketball-Reference
as a one-time manual CSV export (`pandas.read_html()` on their season pages),
seed from that instead. Slower to update season-to-season, but zero auth
headaches. Worth trying py_ball for ~half a day first since it's the
better long-term source (full career history, all seasons, one script).

## The "not yet drafted" logic

`players.draft_year` is the anchor. In `main.py`'s `/compare` endpoint,
a player is `active=False` for any `season_year < draft_year`, and the API
returns `stats: null` for that player-year — no error, just nil. Frontend
should render that as "Not yet drafted" rather than a blank chart.

## Next steps (not scaffolded yet)
- React frontend: player search/select, year slider, Recharts radar +
  bar comparison views
- Advanced stats (PER, TS%, USG%, Win Shares) — `playerdashboardbyyearoveryear`
  or `playerestimatedmetrics` endpoints in py_ball likely cover these;
  worth checking their exact response shape during your field-name pass above
