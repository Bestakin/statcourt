# StatCourt

A basketball player comparison and analytics tool, covering both the **WNBA** and **NBA**. Line up any two players, any season since they entered the league, or their full careers, and see how they stack up.

**Live demo:** https://statcourt-1.onrender.com

---

## Features

**Core comparison**
- Head-to-head stat comparison, by single season or full career
- Diverging bar charts (points, rebounds, assists, steals, blocks, turnovers)
- Season slider covering each league's full history (WNBA: 1997–present, NBA: 1950–present)
- Status-aware handling for players not yet drafted, retired, or missing data that season, no broken charts, just clear messaging

**Analytics**
- "Who had the better season?": an original composite score across Offense/Defense/Efficiency, built on a scale-invariant share-based methodology (so raw counting stats like points don't drown out percentage stats like True Shooting)
- Advanced stats radar chart (PER, True Shooting %, Usage %, Win Shares)
- Player Development chart: full career progression, toggle between PPG/RPG/APG/PER/Win Shares
- Career best-season highlight badges, click to jump straight to that season's comparison

**Discovery**
- **Similar Players**: a from-scratch recommendation engine using z-score standardization + cosine similarity across career stats. Scoped to each player's own league (an NBA player is never compared against a WNBA one, or vice versa). No ML library, fully auditable in `main.py`
- **Season Finder**: a query builder to find every player-season matching a set of thresholds (PPG, RPG, APG, TS%, PER, Win Shares, position, team, season)
- **Draft Class Explorer**: browse every player from a given draft year
- **Team History**: per-season franchise tracking that correctly reflects trades and relocations (not just a player's most recent team)
- **Recent Searches**: your last few comparisons and searches, saved locally, one click to restore

**Multi-league**
- Toggle between WNBA and NBA at the top of the app, every feature above works identically in both, scoped correctly to whichever league is selected

**Polish**
- Shareable comparison URLs (league included, so a shared link restores the exact same view)
- Fully responsive, tested on mobile
- Smooth transitions on every data change, not just instant pops

---

## Tech stack

**Backend:** FastAPI, SQLite, Pydantic
**Frontend:** React (Vite), Tailwind CSS, Recharts
**Data:** WNBA (1997–present, ~1,200 players, ~4,900 season records) and NBA (1950–present, ~4,900 players, ~25,000 season records), sharing one unified database

---

## How it works (a few technical notes)

**The composite score and radar chart** use a percentage-share normalization: each stat becomes a share of the two players' combined total, rather than comparing raw numbers directly. This is what lets points (~0–25 range) and shooting percentages (~0–1 range) contribute fairly to the same score without one dominating.

**Similar Players** is a hand-built pipeline, not a library call: career averages get z-score standardized across the full eligible player pool *within that player's own league*, then compared via cosine similarity. Players under 50 career games are excluded from the pool to avoid small-sample noise skewing the results.

**Team history and season status** are tracked per-season, not just per-player, a player's team, draft status, and active/retired state are all evaluated relative to whichever season you're viewing, which is what makes a franchise-relocation case, or a Hall-of-Famer's final season, display correctly instead of silently showing stale data.

**Multi-league architecture:** players and season stats live in one shared schema with a `league` column, rather than two separate databases. Every population-level query (search, Season Finder, Draft Class Explorer, Similar Players) filters by league explicitly. One real bug this surfaced during development: several team abbreviations are shared between the two leagues (e.g. `IND` is both the Indiana Pacers and the Indiana Fever, `DAL` is both the Mavericks and the Wings), team name lookups had to be split into league-scoped dictionaries rather than one shared one, or players would show the wrong franchise name entirely.

**On the data:** season and career stats were collected from public basketball statistics and loaded into the SQLite database included in this repo. The collection pipeline itself isn't included here.

**Data freshness:** stats are refreshed periodically (roughly weekly during each league's season) via a private collection pipeline, not real-time. Deployed data reflects whenever the database was last updated and pushed.

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

Open `http://localhost:5173`. The database (`wnba.db`) ships with the repo, so there's no seeding step, it works immediately after install.

API docs (interactive, via FastAPI's auto-generated Swagger UI): `http://localhost:8005/docs`

---

## Project structure

- `main.py`: FastAPI backend, all API endpoints
- `wnba.db`: SQLite database (players + season stats, both leagues)
- `requirements.txt`
- `frontend/`
  - `src/App.jsx`: main app logic, layout, and league state
  - `src/api.js`: API client
  - `src/recentSearches.js`: localStorage-backed recent searches
  - `src/components/`: UI components (charts, panels, search, etc.)
  - `package.json`

---

## Roadmap

Not currently planned, but on the list for later:
- Awards/MVP/Championship data (would need a separate scrape from a different source page)
- Records page (career and season leaderboards)
- "Compare Eras", league averages by decade, for context-adjusted comparisons
- NBA's earliest seasons (1947–1949, played as the BAA before the NBA merger), currently excluded since Basketball-Reference files them under a different league identifier
