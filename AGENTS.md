# Crash Cubes Agent Guide

@RTK.md

## Project Context

- Isometric web puzzle game built on a Lovable-generated frontend.
- Core code changes are made in this repository through Codex.
- Level balancing is handled separately from the main frontend flow.
- Target content plan: `50` levels total, `5` visual styles, `10` levels per style.
- Release target: Yandex Games.

## Working Rules

- Preserve compatibility with Lovable-managed frontend structure.
- Prefer changes in `src/game/*`, `src/components/*`, and `src/sdk/yandex.ts` over broad scaffold rewrites.
- Keep gameplay logic, level data, and balancing logic separated.
- Do not mix balance-tuning changes with unrelated UI refactors in the same task unless explicitly requested.
- When changing multiple files or touching gameplay flow, inspect current level data, difficulty formulas, and Yandex SDK integration first.

## Repo Landmarks

- `src/components/GameCanvas.tsx`: game shell, level flow, win/loss UI.
- `src/game/levels/index.ts`: current level registry and handcrafted levels.
- `src/game/difficulty.ts`: move budget and star calculation.
- `src/sdk/yandex.ts`: Yandex Games SDK wrapper and local mock.
- `src/assets/*`: per-style sprite and background assets.

## Delivery Priorities

- Gameplay correctness before visual polish.
- Level readability and solvability before difficulty spikes.
- Stable browser behavior before platform-specific monetization hooks.
- Yandex Games compatibility before optional local optimizations.

## Recommended skills.sh Skills

Install only the skills that match the current phase of work. Prefer audited,
popular, and official skills when several options overlap.

```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/anthropics/skills --skill webapp-testing
npx skills add https://github.com/mindrally/skills --skill pixi-js
npx skills add https://github.com/asyrafhussin/agent-skills --skill react-vite-best-practices
```

## Conditional skills.sh Skills

```bash
npx skills add https://github.com/coreyhaines31/marketingskills --skill copywriting
npx skills add https://github.com/currents-dev/playwright-best-practices-skill --skill playwright-best-practices
npx skills add https://github.com/partme-ai/full-stack-skills --skill vitest
```

- `copywriting`: use for Yandex Games store text, onboarding copy, and promo pages.
- `playwright-best-practices`: use when adding real browser regression coverage.
- `vitest`: use when expanding unit/component test coverage beyond the current setup.

## Local Skill Ideas

- `level-balance`: validate solvability, move budgets, and progression pacing.
- `yandex-games-release`: checklist for SDK, ads, persistence, preload, and publication packaging.
- `lovable-sync-guard`: guardrails for changes that can conflict with Lovable-generated structure.

## Notes

- `skills.sh` refers to the public agent skills directory at https://skills.sh/.
- If a local skills bootstrap script is introduced later, document its usage in `RTK.md`.
