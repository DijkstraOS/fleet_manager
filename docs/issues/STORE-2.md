# STORE-2 — Split `editor-store` into slices

**Area:** Structure · **Effort:** M · **Risk:** Med

`apps/web/src/stores/editor-store.ts` (~690 lines) is ~2× the next-largest file and mixes several
concerns. Carve into focused zustand slices: map-edit (nodes/edges), background-image, edge-curve,
route-drag/selection.

**Safety net:** behavior is pinned by the 14-case `apps/web/src/stores/__tests__/editor-store.test.ts`
— keep it green throughout. Best done after STORE-1 (less code to move).

**Done when:** each slice is a focused module, tests green. Then delete this file.
