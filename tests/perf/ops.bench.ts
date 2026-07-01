import { bench } from "vitest";
import { moveNode, syncMapEdgeTrajectoryEndpoints } from "@agv/core";
import { makeMap } from "@perf/corpus";

/** Pillar C: wall-clock trend, NOT a gate (excluded from `npm test`). Run `npm run perf:bench` → docs/perf-baseline.json. See README. */

for (const n of [1000, 5000, 10000]) {
  const map = makeMap({ nodes: n, topology: "grid" });
  const target = map.nodes[Math.floor(n / 2)]!.id;

  bench(`moveNode @ ${n} nodes`, () => {
    moveNode(target, 1, 1)(map);
  });

  bench(`syncMapEdgeTrajectoryEndpoints @ ${n} nodes`, () => {
    syncMapEdgeTrajectoryEndpoints(map.edges, map.nodes);
  });
}
