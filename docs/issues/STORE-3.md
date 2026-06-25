# STORE-3 — Collapse `editor-store` boilerplate

**Area:** Tightness · **Effort:** S · **Risk:** Low

Two repeated patterns in `apps/web/src/stores/editor-store.ts`:
- **12** actions inline `updatedAt: new Date().toISOString()` instead of routing through the
  existing `updateMap` helper (which already stamps `updatedAt`).
- **8** copies of `if (state.selection?.type !== "edge") return {}`.

**Fix:** route every map mutation through `updateMap`; add a `requireSelectedEdge(state)` guard for
the selection checks.

**Done when:** no inline `updatedAt` spreads or duplicated edge guards remain, tests green. Then
delete this file.
