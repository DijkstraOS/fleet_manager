# DUP-8 — Scattered micro-utils (low priority)

**Area:** Duplication · **Effort:** S · **Risk:** Low

`isRecord`, `numberOr`, `stringOr` (`lif`), `clamp01`, `distanceBetween` (`trajectory`),
`positiveOr` (`editor-store`) live in ad-hoc spots.

**Fix:** give them a shared `@agv/core` home *only if* it removes real duplication; otherwise leave
as-is. Don't manufacture an abstraction for single-use helpers.

**Done when:** a deliberate decision is made (consolidated or explicitly left). Then delete this file.
