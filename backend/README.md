# Hop and Fill Backend

Local leaderboard backend for the Vite client.

## Run

```bash
npm start
```

Default URL: `http://localhost:8787`

## API

- `GET /health`
- `POST /leaderboards/:leaderboardName/scores`
- `GET /leaderboards/:leaderboardName/entries?includeUser=true&quantityAround=3&quantityTop=10`

Scores are persisted in `backend/data/leaderboards.json`. The client stores only a generated `playerId`; leaderboard scores live on the backend.
