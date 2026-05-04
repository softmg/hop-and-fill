# Hop & Fill Release Plan for Yandex Games

## Decisions

- Product title: `Hop & Fill`.
- Repository and Archon workflow names may remain `Crash Cubes` / `crash-cubes-*`.
- First release content target: `25` levels, `5` chapters, `5` levels per visual theme.
- Manual playtest result: current level curve is acceptable for release.
- Mobile orientation target: portrait only. The Yandex Games draft must select `Portrait`.

## Current Local Baseline

- `npm test`: passes, `55` tests.
- `npm run lint`: passes with warnings only from shared UI exports.
- `npm run build`: passes.
- `npm run validate:levels`: passes, `25` levels analyzed, no warnings.
- Production build currently warns about one large JS chunk around `877 kB`.

## P0: Required Before Moderation

1. Product naming
   - Keep the game title as `Hop & Fill`.
   - Keep repo/workflow names as `Crash Cubes` where they are infrastructure names.
   - Align visible game/store/metadata names before upload.

2. Yandex SDK connection
   - Archon task: update the SDK loader to the current Yandex Games path.
   - For archive upload to Yandex hosting, the SDK path should be relative.
   - Preserve local mock behavior outside Yandex.

3. `LoadingAPI.ready()` timing
   - Archon task: fire `LoadingAPI.ready()` only once the launch flow is truly playable.
   - The readiness gate should include progress load, Pixi asset readiness, first scene renderability, and intro completion.

4. Automatic language detection
   - Archon task: read `ysdk.environment.i18n.lang` during launch.
   - RU-only release may still use Russian text, but SDK-based auto-detection must exist and be verifiable in the debug panel.

5. Yandex debug panel verification
   - Archon task: add a repo checklist or lightweight verification helper for debug-panel checks.
   - Final verification still happens manually in the Yandex draft.

## P1: Game Readiness

1. Release scope
   - Use `25` levels for v1 instead of the old `50`-level target.
   - Store copy and screenshots must describe `25` levels, not `50`.

2. Difficulty/playtest
   - Manual playtest done. No blocking task.

3. Portrait-only mobile release
   - Archon task: make the game portrait-first and add a landscape blocker or clear unsupported-orientation state if needed.
   - Yandex draft must select `Portrait`, which lets the platform show its rotate-device placeholder.

4. Rewarded ad lifecycle
   - Archon task: apply audio/gameplay pause handling to rewarded ads, not only fullscreen interstitials.

5. Player object caching
   - Archon task: cache the Yandex `Player` object in `src/sdk/yandex.ts` to avoid repeated `getPlayer()` calls.

## P2: Build and Packaging

1. Production ZIP
   - Manual later: build `dist`, zip the contents so `index.html` is at archive root, upload to the draft.

2. Relative asset paths with Vite
   - If Yandex draft preview shows 404s for JS/CSS/assets, set Vite `base: "./"`.
   - Example:

```ts
export default defineConfig(({ mode }) => ({
  base: "./",
  // existing config...
}));
```

   - Rebuild after the change and recheck `dist/index.html`; asset URLs should be relative, for example `./assets/...`.

3. Metadata cleanup
   - Archon task: remove Lovable leftovers and stale external preview images from metadata.

4. Brand-safe copy
   - Archon task: remove references to third-party brands from user-facing/store-facing copy.

5. Initial bundle size
   - Archon task: reduce the first JS chunk or configure sensible manual chunks so startup is friendlier for mobile.

## P3: Yandex Draft Materials

1. Store text
   - Archon task: prepare Title, SEO description, Description, and How to play for `Hop & Fill`.
   - Text must match the real `25`-level game.

2. Visual materials
   - Archon task: prepare a checklist/spec for icon, maskable icon, cover, hero image, and screenshots.

3. Cloud save setting
   - Archon task: document and verify the Yandex draft setting `The game use cloud save`, because the game uses player data.

4. Gameplay screenshots and media
   - Interactive Archon task: build an approved shot list and capture workflow for real gameplay screenshots/media.
   - The user should approve which levels/themes and states are represented.

5. Asset rights
   - Interactive Archon task: collect and document asset provenance/licensing notes.
   - The user should confirm any generated or externally sourced materials before submission.

## Archon Execution

The executable queue lives in:

```text
.archon/state/plan-status.yaml
```

Run the next autonomous implementation slice with:

```bash
archon workflow run crash-cubes-plan-iterative
```

For interactive release-material tasks, use the dedicated interactive workflow after the implementation queue is stable.
