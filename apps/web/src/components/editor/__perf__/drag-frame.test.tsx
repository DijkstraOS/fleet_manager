// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { makeMap } from "@perf/corpus";
import { countScanWork } from "@perf/probes";
import { useEditorStore } from "../../../stores/editor-store";
import { act, cleanup, mountCanvas, seedStores } from "./render-harness";

/** Pillar A: counts array-scan ops one node-drag frame performs and locks the integer (red→green→guard, see tests/perf/README.md). */

const N = 300;
const dragMap = makeMap({ nodes: N, topology: "grid" });
const TARGET = dragMap.nodes[Math.floor(N / 2)]!.id;

afterEach(() => cleanup());

describe("operation budget: node drag", () => {
  it("store write: dragNodeTo resolves edge endpoints via a node index (0 scans)", () => {
    seedStores("map", dragMap); // no mount → measure the store write alone
    useEditorStore.getState().beginDragNode(TARGET);

    const work = countScanWork(() => {
      useEditorStore.getState().dragNodeTo(5, 5);
    });

    // 0 = no redundant per-edge node scan. countScanWork counts lookup-scan ops only (find/some/includes), not the inherent .map traversal — so 0 is not "no work".
    expect(work).toBe(0);
  });

  it("end to end: one drag frame (store write + canvas re-render) does ~345k scans", () => {
    seedStores("map", dragMap);
    mountCanvas();
    useEditorStore.getState().beginDragNode(TARGET);

    // Counts the whole frame (store write + re-render act() flushes). Crosses React, so assert a ceiling (≤), not an exact lock.
    const work = countScanWork(() => {
      act(() => {
        useEditorStore.getState().dragNodeTo(6, 6);
      });
    });

    // Ceiling is now ONLY React reconciling the full static graph; mode-gating/memoizing that re-render drives it toward 0.
    expect(work).toBeLessThanOrEqual(344_785);
    expect(work).toBeLessThan(678000);
  });
});

describe("operation budget: curve-handle drag (the other per-frame editor gesture)", () => {
  // Grid corpus emits n0->n1 with a reverse twin n1->n0, so this edge is the resolver's worst case (both findEdge scans hit).
  const CURVE_EDGE = "n0->n1";

  it("store write: a curve-handle frame re-scans the map by id today (RED-as-fact)", () => {
    seedStores("map", dragMap); // no mount → measure the store write alone
    useEditorStore.getState().selectEdge(CURVE_EDGE);

    const work = countScanWork(() => {
      useEditorStore.getState().updateSelectedEdgeCurveHandle(5, 5);
    });

    // RED-as-fact: updateSelectedEdgeCurveHandle resolves the edge + endpoints via raw linear scans every pointer frame — findEdgeById O(E) + reverse-twin findEdge O(E) + 2×findNode O(N). 2860 = 2E + 2N on this grid (E=1130, N=300).
    expect(work).toBe(2860);
  });
});
