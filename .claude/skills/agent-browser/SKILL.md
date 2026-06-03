---
name: agent-browser
description: "Compatibility browser skill for Codex. Use when a task mentions `agent-browser`, asks to open or inspect a local app in the browser, or needs browser-based reproduction on localhost, 127.0.0.1, ::1, or file:// URLs."
---

# Agent Browser

This skill is a Codex compatibility alias for legacy workflows and prompts that refer to `agent-browser`.

## Use this skill when

- The task explicitly mentions `agent-browser`
- A workflow or prompt says to open a local app and reproduce a UI bug
- The target is a local browser surface such as `localhost`, `127.0.0.1`, `::1`, or `file://`

## Routing

Use Codex browser capabilities, not Claude-only Skill-tool behavior.

Preferred order:

1. Use the bundled `browser-use:browser` skill and the in-app browser for local browser work.
2. If the in-app browser is unavailable, use the available Codex browser automation tools for the current session.
3. Only fall back to static code analysis if no browser automation path exists.

## Expectations

- Do not claim visual reproduction from source inspection alone.
- If browser tooling is unavailable, say that explicitly.
- Capture concrete evidence when possible: URL opened, actions taken, screenshots, console errors, and the exact observed behavior.

## Common legacy command mapping

If a prompt says:

- `agent-browser open http://localhost:5173`

Interpret it as:

- Open that URL with the Codex in-app browser and continue the reproduction there.

If a prompt says:

- `agent-browser screenshot ...`
- `agent-browser snapshot -i`
- `agent-browser click ...`

Interpret those as requests to use the current Codex browser surface to inspect, screenshot, and interact with the page.
