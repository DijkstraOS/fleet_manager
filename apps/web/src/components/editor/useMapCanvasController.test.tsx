// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PointerEvent } from "react";
import type { MapNode } from "@agv/core";
import { useMapCanvasController } from "./useMapCanvasController";
import { useEditorStore } from "../../stores/editor-store";

/** Guards item-handler wiring: NOT covered by the render-budget/profile suites, which drive store actions directly. */

function pointerEvent() {
  return { stopPropagation: vi.fn(), pointerId: 1 } as unknown as PointerEvent<SVGGElement>;
}

describe("useMapCanvasController item handlers (getState wiring)", () => {
  afterEach(() => {
    useEditorStore.setState({ workspaceMode: "map", tool: "select", selection: null, dragNodeId: null, edgeStartNodeId: null });
  });

  it("onNodePointerDown selects the node and begins a drag (select tool, map mode)", () => {
    useEditorStore.setState({ workspaceMode: "map", tool: "select", selection: null, dragNodeId: null });
    const node = useEditorStore.getState().map.nodes[0] as MapNode;
    const { result } = renderHook(() => useMapCanvasController());

    result.current.onNodePointerDown(pointerEvent(), node);

    expect(useEditorStore.getState().selection).toEqual({ type: "node", id: node.id });
    expect(useEditorStore.getState().dragNodeId).toBe(node.id);
  });

  it("onNodePointerDown in edge tool starts an edge instead of selecting", () => {
    useEditorStore.setState({ workspaceMode: "map", tool: "edge", selection: null, edgeStartNodeId: null });
    const node = useEditorStore.getState().map.nodes[0] as MapNode;
    const { result } = renderHook(() => useMapCanvasController());

    result.current.onNodePointerDown(pointerEvent(), node);

    expect(useEditorStore.getState().edgeStartNodeId).toBe(node.id);
    expect(useEditorStore.getState().dragNodeId).toBeNull();
  });

  it("onEdgePointerDown selects the edge in map mode", () => {
    useEditorStore.setState({ workspaceMode: "map", selection: null });
    const edge = useEditorStore.getState().map.edges[0]!;
    const { result } = renderHook(() => useMapCanvasController());

    result.current.onEdgePointerDown(pointerEvent(), edge.id);

    expect(useEditorStore.getState().selection).toEqual({ type: "edge", id: edge.id });
  });

  it("ignores node/edge pointer-downs in tracking mode (read live, not closed over)", () => {
    useEditorStore.setState({ workspaceMode: "tracking", selection: null, dragNodeId: null });
    const node = useEditorStore.getState().map.nodes[0] as MapNode;
    const { result } = renderHook(() => useMapCanvasController());

    result.current.onNodePointerDown(pointerEvent(), node);

    expect(useEditorStore.getState().selection).toBeNull();
    expect(useEditorStore.getState().dragNodeId).toBeNull();
  });
});
