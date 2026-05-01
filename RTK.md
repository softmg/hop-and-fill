# Crash Cubes Runbook

## Stack

- `Vite`
- `React 18`
- `TypeScript`
- `Pixi.js`
- `Tailwind`
- `Vitest`
- `Yandex Games SDK` via local wrapper in `src/sdk/yandex.ts`

## Commands

```bash
npm install
npm run dev
npm run build
npm run test
npm run lint
```

## Architecture

- UI shell lives in `src/components` and `src/pages`.
- Core gameplay logic lives in `src/game`.
- Level definitions currently live in `src/game/levels/index.ts`.
- Difficulty heuristics are in `src/game/difficulty.ts`.
- Yandex integration is isolated in `src/sdk/yandex.ts`.

## Level Expansion Plan

- Total target: `50` levels.
- Style plan:
  - default: `10`
  - paper: `10`
  - wood: `10`
  - neon: `10`
  - slime: `10`
- Keep level source data structured so batch balancing and validation can be automated later.

## Change Strategy

- Frontend visual/layout changes must remain compatible with Lovable ownership.
- Game rules, movement, progression, and save logic can be changed here directly.
- Prefer adding tooling around level validation rather than hardcoding many exceptions into runtime logic.

## Yandex Games Focus

- Keep SDK calls isolated and mockable.
- Guard game startup for local development without Yandex domain requirements.
- Treat save, ads, loading-ready hook, and performance budget as release-critical.

## Testing Focus

- Any gameplay rule change should be backed by at least one targeted test where practical.
- Any level-data migration should be verified with build plus a solvability sanity check.
- Before release-facing work, run `npm run build` and `npm run test`.
