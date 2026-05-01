# Crash Cubes Plan for Yandex Games

## Goal

Prepare the isometric puzzle game for a strong Yandex Games release: stable first session, reliable saves, clear progression, fair monetization, and moderation-ready platform integration.

## Current Context

- The game is a Lovable-generated Vite/React/Pixi web game.
- Code work is done in this GitHub repository through Codex.
- Level balancing is handled through a separate script.
- Target content: `50` levels total, `10` levels per visual style.
- Current code already has a Yandex SDK wrapper and local mock in `src/sdk/yandex.ts`.

## 1. Progression and Saves

Implement persistent player progress through Yandex player data and local mock storage.

- Save unlocked level.
- Save completed levels.
- Save best stars per level.
- Save tutorial completion.
- Save sound/music preferences when audio is added.
- Load progress on startup before rendering final level state.
- Replace free previous/next navigation with a proper level select.
- Allow replaying completed levels.
- Unlock the next level only after winning the current one.

Why this matters:

- Yandex requirements allow guest play, but progress must be saved.
- Progression is the main retention loop for a 50-level puzzle game.

## 2. Yandex SDK Integration

Tighten SDK usage so it matches platform expectations.

- Call `LoadingAPI.ready()` only after Pixi assets and the first playable state are ready.
- Add `GameplayAPI.start()` when the player starts or resumes active gameplay.
- Add `GameplayAPI.stop()` on win, loss, pause, ads, tab backgrounding, or overlays.
- Keep local mock behavior for development outside Yandex.
- Avoid SDK crashes when Yandex APIs are unavailable.

Current risk:

- `ysdkReady()` is called from `GameCanvas` immediately after creating `PixiGame`, while Pixi assets are loaded asynchronously inside `PixiGame`.

## 3. Monetization

Use ads only during clear pauses.

- Interstitial ad candidates:
  - after losing;
  - after every few completed levels;
  - before starting a new chapter/style;
  - never during an active jump or puzzle interaction.
- Rewarded video candidates:
  - get `+5` moves;
  - undo one move;
  - show a hint;
  - skip a difficult level;
  - reveal the ideal first move.
- Mute or pause gameplay/audio during ads.
- Resume gameplay cleanly after ad callbacks.

Rules:

- Ads must be expected by the player.
- Ads must appear in logical pauses.
- Rewarded ads can be more frequent than interstitials, but the reward must be explicit.

## 4. Level and Balance Strategy

Use the 50 levels as a difficulty curve, not just a content count.

- Levels `1-5`: teach movement, stars, move limit, and simple traps.
- Levels `6-10`: first chapter test.
- Levels `11-20`: introduce stronger branching and longer routes.
- Levels `21-30`: combine rings, dead ends, and misleading starts.
- Levels `31-40`: advanced multi-loop puzzles.
- Levels `41-50`: final exam levels with high readability and controlled difficulty spikes.

Balance script should track:

- tile count;
- optimal moves;
- move limit;
- dead-end count;
- branching count;
- graph diameter;
- start penalty;
- expected retry difficulty;
- style/chapter;
- whether the level has a clear intended trick.

Recommended level metadata:

```ts
{
  name: string;
  rows: string[];
  theme: TileTheme;
  chapter: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  intendedTrick?: string;
}
```

## 5. UX Improvements

Improve first-session clarity and reduce frustration.

- Add a chapter/level map.
- Show total stars per chapter, for example `27/30`.
- Add undo, at least as a rewarded option or limited free action.
- Add pause/settings menu.
- Add final screen after the last level.
- Add clear chapter transition screens when a new visual style opens.
- Make failure text match real mechanics.
- Confirm all HUD elements fit on small mobile screens.
- Keep tutorial short and interactive.

Current copy issue:

- Loss text mentions a jump into empty space, but invalid moves are currently ignored. Either make invalid moves cause failure or change the text.

## 6. Retention Features

Add lightweight retention loops that fit a puzzle game.

- Daily challenge based on existing level patterns or generated layouts.
- Chapter completion rewards.
- Perfect chapter badge for all `30/30` stars in a style.
- Continue button that resumes the latest unlocked level.
- Optional hint economy tied to rewarded ads.

Avoid heavy systems before first release:

- No complex currency unless needed.
- No purchases before the core game loop is proven.
- No account-gated features.

## 7. Visual and Audio Polish

Make each style feel like a chapter, not just a tile skin.

- Ensure each group of 10 levels has matching tiles, player, background, and small UI accent.
- Add light sound effects:
  - hop;
  - tile paint;
  - win;
  - loss;
  - chapter unlock.
- Add a global mute toggle.
- Stop or mute all audio when the tab is hidden or ads are shown.
- Optimize image sizes before upload.

## 8. Moderation Checklist

Before submitting to Yandex Games:

- Run production build.
- Test with Yandex debug panel.
- Test desktop and mobile layouts.
- Test supported browsers.
- Check there are no console errors.
- Check loading completes and `LoadingAPI.ready()` fires once at the correct time.
- Check gameplay start/stop events.
- Check save/load as guest.
- Check ads only appear in logical pauses.
- Check UI is not cropped by game boundaries.
- Check all visible interface text matches declared game languages.
- Check game name in the app matches draft materials.
- Check icon, cover, screenshots, and description match the actual game.
- Check all assets are owned or licensed.

## 9. Suggested Implementation Order

1. Add save/load progress and lock level navigation.
2. Add real Yandex gameplay events and correct ready timing.
3. Add level select and chapter progression.
4. Add 50-level data structure and balance validation output.
5. Add rewarded hint/undo mechanic.
6. Add interstitial ads in safe pauses.
7. Add audio and mute/background handling.
8. Run mobile layout and debug panel checks.
9. Prepare store text and screenshots.
10. Submit first moderation build.

## 10. Useful References

- Yandex Games requirements: https://yandex.com/dev/games/doc/en/concepts/criteria
- Moderation checklist: https://yandex.com/dev/games/doc/en/concepts/moderation
- Loading and gameplay events: https://yandex.com/dev/games/doc/en/sdk/sdk-game-events
- Ad placement: https://yandex.com/dev/games/doc/en/requirements/4/4
- Player data: https://yandex.com/dev/games/doc/en/sdk/sdk-player
