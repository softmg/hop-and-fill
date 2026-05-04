# Archon Execution Plan

## Current State

- Product name for release: `Hop & Fill`.
- Repository and Archon workflow names remain `Crash Cubes` / `crash-cubes-*`.
- Main autonomous workflow: `crash-cubes-plan-iterative`.
- Focused implementation workflow used by the runner: `crash-cubes-dev`.
- Interactive release-material workflow: `crash-cubes-release-interactive`.
- Persistent task queue: `.archon/state/plan-status.yaml`.

The old implementation slices through `step-9` are marked `done`. The new
release-readiness queue starts at `step-10`.

## Autonomous Queue

Run the next pending implementation/doc slice:

```bash
archon workflow run crash-cubes-plan-iterative
```

Typical overnight run:

```bash
nohup archon workflow run crash-cubes-plan-iterative \
  > .archon-autonomous.log 2>&1 &
```

The runner reads `.archon/state/plan-status.yaml`, picks the first actionable
step, runs `crash-cubes-dev` in a branch worktree, validates with:

```bash
npm run test
npm run lint
npm run build
```

It advances only when final validation is green and `review.md` has verdict
`pass` or `pass-with-notes`.

## Pending Release Steps

- `step-10`: update Yandex SDK loader path.
- `step-11`: gate `LoadingAPI.ready()` on truly playable launch state.
- `step-12`: add SDK language autodetection at launch.
- `step-13`: add Yandex debug panel verification checklist/helper.
- `step-14`: enforce portrait-first mobile release.
- `step-15`: apply gameplay/audio lifecycle holds to rewarded ads.
- `step-16`: cache the Yandex `Player` object.
- `step-17`: clean release metadata leftovers.
- `step-18`: make user-facing copy brand-safe.
- `step-19`: reduce initial JS bundle risk.
- `step-20`: draft Yandex store text for `Hop & Fill`.
- `step-21`: specify Yandex visual material requirements.
- `step-22`: document cloud save draft setting.

## Interactive Tasks

These are intentionally `manual` in `.archon/state/plan-status.yaml` because
they require user approval gates.

Gameplay screenshot/media shot list:

```bash
archon workflow run crash-cubes-release-interactive \
  --branch release/gameplay-media-shot-list \
  --from main \
  "Create and finalize the Hop & Fill Yandex Games gameplay screenshot/media shot list. Ask for user approval on levels, themes, viewport sizes, and states before writing docs/yandex-release/screenshot-shot-list.md."
```

Asset provenance/licensing checklist:

```bash
archon workflow run crash-cubes-release-interactive \
  --branch release/asset-rights-checklist \
  --from main \
  "Create and finalize the Hop & Fill Yandex Games asset provenance and licensing checklist. Ask for user confirmation on generated, owned, and externally sourced materials before writing docs/yandex-release/asset-rights-checklist.md."
```

## Integration Checklist

For each successful worktree:

```bash
WORKTREE="$HOME/.archon/workspaces/games/crash-cubes/worktrees/archon/task-<branch-slug>"
git -C "$WORKTREE" status --short
git -C "$WORKTREE" diff --stat main
git -C "$WORKTREE" diff main
```

Only integrate a worktree after reading its `review.md`. If the verdict is
`needs-follow-up`, continue or rerun that branch before merging.

Clean up stale worktrees only after their changes are merged or intentionally
discarded:

```bash
archon complete <branch-name>
```
