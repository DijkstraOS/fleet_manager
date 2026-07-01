# `tests/perf` — the performance-eval substrate

Lock **the number of operations a real flow performs**, not milliseconds and not the big-O of
an isolated function. Deterministic counts gate PRs; wall-clock is a tracked trend only.

## Why counts, not milliseconds

Millisecond assertions flake on machine/CI noise, so the team learns to ignore red and goes
blind — a flaky perf gate is worse than none. Growth-class (`O(n)` vs `O(n²)`) checks miss the
bug this codebase actually shipped: locally-sensible code that, viewed globally, did the same
join *twice per drag frame* (the store write **and** the canvas render each ran it). The big-O
never changed; the constant factor doubled. So we gate on the **deterministic operation count of
a real, end-to-end flow at a realistic fixed map size** — identical on every machine (no flake),
of the *whole* interaction (doing the work twice shows up as 2× the integer), taken cold at scale
(so a cache that genuinely removes work is a win you re-baseline to, not a way to hide rework).

| Pillar | Concern | Metric | Role |
|---|---|---|---|
| **A** | Wasteful rework in real flows | scan ops a flow performs at realistic N | **hard gate** (`npm test`) |
| **B** | Unnecessary re-renders | render-body counts per component | **hard gate** (`npm test`) |
| **C** | Wall-clock throughput | ms via `bench` | **tracked trend** (`npm run perf:bench`) |

## Layout

```
tests/perf/
  corpus.ts            makeMap — valid, deterministic maps at scale (grid|dense|hub|chain)
  probes.ts            countScanWork — the Pillar A primitive (tally array-scan ops a flow does)
  probes.test.ts       self-test: proves countScanWork is data-independent + composable
  operations.test.ts   Pillar A — operation budgets on pure core/server flows (hard gate)
  ops.bench.ts         Pillar C — vitest bench (npm run perf:bench → docs/perf-baseline.json)
apps/web/src/
  lib/render-tally.ts              the Pillar B tally (one no-op boolean check in prod)
  components/editor/__perf__/      Pillar B render budgets (jsdom, mounts real components)
```

Import the shared corpus/probes via the `@perf` alias (wired in `vitest.config.ts`):
`import { makeMap } from "@perf/corpus"`.

## Add a Pillar A scenario (operation budget on a real flow)

Drive the **real flow the app runs** (a store action, a server publish — not a bare library
primitive), at a realistic fixed map size, and lock the exact operation count.

```ts
import { countScanWork } from "@perf/probes";
import { makeMap } from "@perf/corpus";

const map = makeMap({ nodes: 300, topology: "grid" });
const work = countScanWork(() => /* the real flow, e.g. buildVdaOrder(map, draft) */);
expect(work).toBe(35956); // record TODAY's count; add a // TARGET after <fix> comment
```

`countScanWork` tallies `Σ(scanned length)` over `find/some/filter/includes/…` at the
Array.prototype level, so it sees scans on *rebuilt intermediate* arrays and **across composed
layers** (a store write + the render it triggers). That is the point: it catches a *usage*
regression that keeps the same big-O but does the work twice. Editor flows that span store +
render live in `apps/web/src/components/editor/__perf__/` (jsdom); pure core/server flows live
here. For an end-to-end count that crosses React, assert a tight `toBeLessThanOrEqual` ceiling
(React adds ~constant reconciliation noise), not an exact `toBe`.

## Add a Pillar B scenario (re-render locality)

1. Put `useRenderTally("ComponentName")` as the first line of the component body (no-op in
   prod; the existing hot components already carry one).
2. In `__perf__/`, seed via `seedStores(mode)`, `mountCanvas()`, drive a **store action**
   (never a synthesized SVG pointer event — jsdom has no `getScreenCTM`), then assert:

```tsx
seedStores("map");
mountCanvas();
agvFrame();
expect(renderCount("MapCanvasView")).toBe(1); // record TODAY; add a // TARGET comment
```

## The loop (red → green → guard)

1. Write the aggressive scenario; record the **RED** number as the assertion with a
   `// TARGET after <step>: <value>` comment. The waste is now a *measured fact*.
2. Implement the fix.
3. Flip RED → GREEN **in the same diff**. The locked assertion is now the permanent guard.

The deterministic baseline **is** the locked assertion in the test (`toBe(678000)`) — there is
no separate ledger to drift. Wall-clock lives in `docs/perf-baseline.json`, written by
`npm run perf:bench`; `git log -p` on it is the throughput trend.

**Never** loosen a deterministic assertion to make red go green — fix the code, not the
assertion. **Never** gate on wall-clock. **Never** add a budget that asserts on hundreds of
components — only the named hot paths. Keep `makeMap` producing *valid* maps if `@agv/core`
validation tightens.

## Residuals — instrumented or documented, not yet fixed

Ranked by leverage; the high-frequency cascades (AGV firehose, pan/zoom) are done.

1. **Per-item node/edge memo** *(medium)* — select/drag still re-renders the whole graph body to
   flip one node. TARGET: `React.memo NodeItem/EdgeItem` keyed by id with primitive props, so only
   the touched node + its incident edges re-render. Locked RED-as-fact in `render-profile.test.tsx`.
2. **Curve-handle drag store scans** *(medium)* — `2,860` scan ops/frame (Pillar A RED-as-fact):
   the editor **store** has no `MapIndex` yet, so the curve action still resolves by linear scan.
   The budget guards against growth until the store maintains an index.
3. **Roster churn** *(low)* — `TrackingLeftPanel`/`RouteLeftPanel` re-render on every telemetry
   frame (only while that tab is open). Fix: `useShallow` roster selector + per-row `React.memo AgvRow`.
4. **Cold items, left as-is** — `nextNodeId` collision loop, `nodeExtents` multi-pass /
   `Math.min(...xs)` spread, `file-map-repository` full re-serialize per upsert, `lif` export double
   JSON round-trip, simulator per-tick curve sampling. Real but negligible / not array-scan-visible;
   judged not worth the churn at current scale — recorded so they are not silently forgotten.
