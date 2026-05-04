# Crash Cubes

## Yandex Games leaderboard

The game submits the player's total star count to a Yandex Games numeric leaderboard.

- Default technical leaderboard name: `crash_cubes_total_stars`
- Override at build time: `VITE_YANDEX_LEADERBOARD_NAME=your_leaderboard_name`
- Console setup: numeric score, descending sort order

## Custom leaderboard backend

Set `VITE_LEADERBOARD_BACKEND_URL` to store and read leaderboard scores through your backend instead of the Yandex Games leaderboard API.

Expected endpoints:

- `POST {VITE_LEADERBOARD_BACKEND_URL}/leaderboards/{leaderboardName}/scores`
- `GET {VITE_LEADERBOARD_BACKEND_URL}/leaderboards/{leaderboardName}/entries?includeUser=true&quantityAround=3&quantityTop=10`

The save request body is JSON: `{ "leaderboardName": string, "score": number, "extraData": string }`.
The entries response should return `{ "userRank": number, "entries": [...] }`; each entry can include `rank`, `score`, `extraData`, and `player.publicName` / `player.uniqueID` / `player.avatarSrc`.
