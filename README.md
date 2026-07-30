# StatCourt

A WNBA player comparison and analytics tool. Line up any two players — any season since they entered the league, or their full careers — and see how they stack up.

**Live demo:** _[add your deployed URL here once live]_

---

## Features

**Core comparison**
- Head-to-head stat comparison, by single season or full career
- Diverging bar charts (points, rebounds, assists, steals, blocks, turnovers)
- Season slider covering every WNBA season from 1997 to present
- Status-aware handling for players not yet drafted, retired, or missing data that season — no broken charts, just clear messaging

**Analytics**
- "Who had the better season?" — an original composite score across Offense/Defense/Efficiency, built on a scale-invariant share-based methodology (so raw counting stats like points don't drown out percentage stats like True Shooting)
- Advanced stats radar chart (PER, True Shooting %, Usage %, Win Shares)
- Player Development chart — full career progression, toggle between PPG/RPG/APG/PER/Win Shares
- Career best-season highlight badges, click to jump straight to that season's comparison

**Discovery**
- **Similar Players** — a from-scratch recommendation engine using z-score standardization + cosine similarity across career stats. No ML library, fully auditable in `main.py`
- **Season Finder** — a query builder to find every player-season matching a set of thresholds (PPG, RPG, APG, TS%, PER, Win Shares, position, team, season)
- **Draft Class Explorer** — browse every player from a given draft year
- **Team History** — per-season franchise tracking that correctly reflects trades and relocations (not just a player's most recent team)
- **Recent Searches** — your last few comparisons and searches, saved locally, one click to restore

**Polish**
- Shareable comparison URLs
- Fully responsive, tested on mobile
- Smooth transitions on every data change, not just instant pops

---

## Tech stack

**Backend:** FastAPI, SQLite, Pydantic
**Frontend:** React (Vite), Tailwind CSS, Recharts
**Data:** WNBA season and career stats, 1997–present (~1,200 players, ~4,900 season records)

---

## How it works — a few technical notes

**The composite score and radar chart** use a percentage-share normalization: each stat becomes a share of the two players' combined total, rather than comparing raw numbers directly. This is what lets points (~0–25 range) and shooting percentages (~0–1 range) contribute fairly to the same score without one dominating.

**Similar Players** is a hand-built pipeline, not a library call: career averages get z-score standardized across the full eligible player pool (so every stat contributes on the same scale), then compared via cosine similarity. Players under 50 career games are excluded from the pool to avoid small-sample noise skewing the results.

**Team history and season status** are tracked per-season, not just per-player — a player's team, draft status, and active/retired state are all evaluated relative to whichever season you're viewing, which is what makes a franchise-relocation case (like a player drafted before their team moved cities) or a Hall-of-Famer's final season display correctly instead of silently showing stale data.

**On the data:** season and career stats were collected from public WNBA statistics and loaded into the SQLite database included in this repo. The collection pipeline itself isn't included here.

---

## Local setup

```bash
git clone https://github.com/Bestakin/statcourt.git
cd statcourt

# Backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8005
```

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The database (`wnba.db`) ships with the repo, so there's no seeding step — it works immediately after install.

API docs (interactive, via FastAPI's auto-generated Swagger UI): `http://localhost:8005/docs`

---

## Project structure
statcourt/
├── main.py # FastAPI backend — all API endpoints
├── wnba.db # SQLite database (players + season stats)
├── requirements.txt
└── frontend/
├── src/
│ ├── App.jsx # Main app logic and layout
│ ├── api.js # API client
│ ├── recentSearches.js # LocalStorage-backed recent searches
│ └── components/ # UI components (charts, panels, search, etc.)
└── package.json
---

## Roadmap

Not currently planned, but on the list for later:
- Awards/MVP/Championship data (would need a separate scrape from a different source page)
- Records page (career and season leaderboards)
- "Compare Eras" — league averages by decade, for context-adjusted comparisons
