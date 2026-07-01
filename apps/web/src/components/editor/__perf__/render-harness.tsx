// @vitest-environment jsdom
import { act, cleanup as rtlCleanup, render } from "@testing-library/react";
import type { MapDocument } from "@agv/core";
import { makeMap } from "@perf/corpus";
import type { WorkspaceMode } from "../../../types";
import { MapCanvas } from "../MapCanvas";
import { useEditorStore } from "../../../stores/editor-store";
import { useFleetStore } from "../../../stores/fleet-store";
import { useRouteStore } from "../../../stores/route-store";
import { resetRenderTally, setRenderTallyEnabled } from "../../../lib/render-tally";

/** Pillar B mount harness (see tests/perf/README.md). Drive interactions through store actions, not synthesized SVG pointer events: jsdom lacks createSVGPoint/getScreenCTM, and every audit trigger is a store write anyway. */

const DEFAULT_MAP = makeMap({ nodes: 1000, topology: "grid" });

/** zustand setState shallow-merges, so override only scenario-controlled fields — do NOT reconstruct/replace the whole state or you drop the real actions. */
export function seedStores(mode: WorkspaceMode, mapDoc: MapDocument = DEFAULT_MAP): void {
  useEditorStore.setState({
    map: mapDoc,
    workspaceMode: mode,
    tool: "select",
    selection: null,
    edgeStartNodeId: null,
    viewport: null,
  });
  useFleetStore.setState({
    agvs: {},
    orderStatuses: {},
    selectedAgvSerial: null,
    trackedAgvSerial: null,
  });
  useRouteStore.setState({
    routes: [],
    draftNodeIds: [],
    selectedRouteId: null,
    draftActive: false,
  });
}

export function mountCanvas() {
  setRenderTallyEnabled(true);
  const view = render(<MapCanvas />);
  resetRenderTally();
  return view;
}

/** Position values are arbitrary — map mode discards AGVs, so the store write is the only thing that matters. */
export function agvFrame(serial = "SIM1"): void {
  act(() => {
    useFleetStore.getState().handleRealtimeMessage({
      type: "agv_visualization",
      serialNumber: serial,
      manufacturer: "perf-harness",
      visualization: {
        agvPosition: { x: 1, y: 1, theta: 0, mapId: "perf", positionInitialized: true },
      },
    });
  });
}

export function panFrame(): void {
  act(() => {
    const { viewport, map } = useEditorStore.getState();
    const base = viewport ?? { x: 0, y: 0, width: map.canvas.width, height: map.canvas.height };
    useEditorStore.getState().setViewport({ ...base, x: base.x + 1, y: base.y + 1 });
  });
}

export function cleanup(): void {
  rtlCleanup();
  setRenderTallyEnabled(false);
  resetRenderTally();
}

export { act };
