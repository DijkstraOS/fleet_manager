import { describe, expect, it } from "vitest";
import { buildMapIndex, buildVdaOrder } from "@agv/core";
import { makeMap } from "@perf/corpus";
import { countScanWork } from "@perf/probes";

// Pillar A operation budgets for pure core/server flows. The editor drag frame lives in apps/web/src/components/editor/__perf__/drag-frame.test.tsx.

describe("operation budget: order publish (the server's hot flow)", () => {
  it("buildVdaOrder for a 12-step route resolves the route once (0 scans)", () => {
    const map = makeMap({ nodes: 400, topology: "chain" });
    const routeNodeIds = Array.from({ length: 12 }, (_value, i) => `n${i}`);

    const work = countScanWork(() =>
      buildVdaOrder(map, { mapId: map.id, agvSerialNumber: "SIM1", routeNodeIds }),
    );

    // Must stay 0: no per-route findNode/findEdge on the publish path (index-only lookups).
    expect(work).toBe(0);
  });
});

describe("operation budget: buildMapIndex (the index every consumer reads)", () => {
  it("builds the index of a 400-node grid with no linear array scans", () => {
    const map = makeMap({ nodes: 400, topology: "grid" });

    const work = countScanWork(() => buildMapIndex(map));

    // Must stay 0. (getStationNodeIds .filters interactionNodeIds; the corpus has no stations, so nothing is scanned.)
    expect(work).toBe(0);
  });
});
