# Architecture

A lean map of how `agv-new` fits together. **Rules live in code, not here:** the dependency
boundaries are defined and documented (with rationale) in
[`scripts/check-architecture.mjs`](../scripts/check-architecture.mjs) and enforced by
`npm run architecture:check`. Open tightening work lives as one file per issue in
[`docs/issues/`](./issues/); the [`/architecture-review`](../.claude/skills/architecture-review/SKILL.md)
skill is the review process. Keep this file short — when a fact can live in code, put it there.

## System overview

A VDA 5050 v2.1 AGV map editor + dummy-fleet simulator. Five workspaces in an npm-workspaces
monorepo (`apps/*`, `packages/*`), all TypeScript/ESM. `npm start` runs the whole system.

```
            HTTP/WS                     MQTT (VDA 5050)
 ┌────────┐ ───────► ┌────────────┐ ◄──────────────► ┌─────────────┐
 │  web   │          │   server   │     broker       │  simulator  │
 │ (React)│ ◄─────── │ (Fastify)  │ ◄──────────────► │ (dummy AGV) │
 └────────┘  realtime└────────────┘                  └─────────────┘
      │                    │                                 │
      └──────────── @agv/core (pure domain) ─────────────────┘
```

## Workspaces

| Workspace | Role | Internal structure |
|-----------|------|--------------------|
| `packages/core` (`@agv/core`) | **Pure domain** — map model, geometry, LIF I/O, VDA orders. No I/O, no framework. | `map/` (+ `map/trajectory.ts` bézier math), `lif/`, `vda/` |
| `apps/server` | Fastify REST + WebSocket hub + VDA 5050 master client. **Ports & adapters.** | `domain/ports.ts`, `infra/`, `services/`, `routes/` |
| `apps/simulator` | Dummy AGV runtime: motion + state over MQTT. | `config/`, `runtime/`, `services/`, `simulation/`, `transport/` |
| `apps/broker` | Local Aedes MQTT broker for dev. | `runtime.ts` |
| `apps/web` | React/Vite SVG editor + live view. **Container/View split.** | `components/`, `hooks/`, `lib/`, `services/`, `stores/` |

## Key patterns

- **Web container/view split.** Each UI unit is a pair: `Xxx.tsx` (container — subscribes to
  stores, derives state, wires callbacks) and `XxxView.tsx` (presentational — props → JSX, no
  store/service imports). The canvas adds a controller hook,
  [`useMapCanvasController`](../apps/web/src/components/editor/useMapCanvasController.ts).
- **Where logic belongs.** Domain/map/geometry math → `@agv/core`. View-only canvas helpers →
  `apps/web/src/lib`. UI orchestration (store + API) → `apps/web/src/hooks`. Never put domain
  logic in a store or a component.
- **Server ports & adapters.** [`domain/ports.ts`](../apps/server/src/domain/ports.ts) declares
  interfaces; `infra/` supplies adapters (MQTT, file repos); `services/` holds logic. Keeps
  protocol/storage swappable and logic testable against fakes.

## State

Three zustand stores, each one responsibility:
[`editor-store`](../apps/web/src/stores/editor-store.ts) (map document + editor UI),
[`route-store`](../apps/web/src/stores/route-store.ts) (routes + draft),
[`fleet-store`](../apps/web/src/stores/fleet-store.ts) (realtime AGV state + order statuses).
Stores hold state transitions and delegate domain operations to `@agv/core`.

## Testing

| Layer | Location |
|-------|----------|
| Unit | `packages/core/src/core.test.ts`, `apps/web/src/{lib,stores,services}/**`, `apps/simulator/src/**` |
| Integration | `tests/integration/runtime-flow.test.ts`, `tests/server/services.test.ts` |
| E2E | `tests/e2e/app.spec.ts` (Playwright) |

**Rule:** new domain logic in `@agv/core` ships with **direct** unit tests in `core.test.ts`, not
only indirect coverage through a consumer.

## Commands

`npm start` (full system) · `npm run build` (all workspaces) · `npm test` (vitest) ·
`npm run test:e2e` (Playwright) · `npm run architecture:check` (boundary rules).
