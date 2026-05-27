import { createDemoMap, createEmptyMap, isSupportedQuadraticBezier } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import { getBounds } from "../../lib/geometry";
import { useEditorStore } from "../editor-store";

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.setState({
      map: createDemoMap(),
      workspaceMode: "map",
      tool: "select",
      backgroundImage: null,
      selection: null,
      edgeStartNodeId: null,
      routeNodeIds: [],
      dragNodeId: null,
      viewport: null,
      status: "Loading map...",
    });
  });

  it("clears selection when changing mode or tool", () => {
    const store = useEditorStore.getState();
    store.selectNode("dock-a");
    store.setWorkspaceMode("routes");

    expect(useEditorStore.getState().selection).toBeNull();
    expect(useEditorStore.getState().tool).toBe("select");

    useEditorStore.getState().selectNode("corr-1");
    useEditorStore.getState().setTool("edge");

    expect(useEditorStore.getState().selection).toBeNull();
  });

  it("adds nodes from canvas points and selects the new node", () => {
    const store = useEditorStore.getState();
    store.addNodeAt(2, 3);

    const next = useEditorStore.getState();
    expect(next.map.nodes.some((node) => node.x === 2 && node.y === 3)).toBe(true);
    expect(next.selection?.type).toBe("node");
  });

  it("creates one-way edges and can explicitly add the reverse edge", () => {
    const map = {
      ...createEmptyMap("Line"),
      nodes: [
        { id: "a", label: "A", x: 0, y: 0 },
        { id: "b", label: "B", x: 1, y: 0 },
      ],
    };
    useEditorStore.setState({ map });

    useEditorStore.getState().handleEdgeNode("a");
    useEditorStore.getState().handleEdgeNode("b");

    expect(useEditorStore.getState().map.edges.map((edge) => `${edge.from}->${edge.to}`)).toEqual(["a->b"]);

    useEditorStore.getState().addReverseEdgeForSelection();

    expect(useEditorStore.getState().map.edges.map((edge) => `${edge.from}->${edge.to}`)).toEqual(["a->b", "b->a"]);
  });

  it("attaches, fits, locks, and removes a background image", () => {
    const store = useEditorStore.getState();
    store.attachBackgroundImage({
      src: "data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%220%200%20200%20100%22%3E%3C%2Fsvg%3E",
      fileName: "plant.svg",
      mediaType: "image/svg+xml",
      naturalWidth: 200,
      naturalHeight: 100,
    });

    const attached = useEditorStore.getState().backgroundImage;
    expect(attached?.fileName).toBe("plant.svg");
    expect(attached?.width).toBeGreaterThan(0);
    expect(useEditorStore.getState().tool).toBe("background");

    useEditorStore.getState().setBackgroundImageOpacity(0.25);
    useEditorStore.getState().setBackgroundImageLocked(true);
    expect(useEditorStore.getState().backgroundImage?.opacity).toBe(0.25);
    expect(useEditorStore.getState().backgroundImage?.locked).toBe(true);

    useEditorStore.getState().updateBackgroundImage((backgroundImage) => ({
      ...backgroundImage,
      x: -12,
      y: -12,
      width: 4,
      height: 2,
    }));
    const bounds = getBounds(useEditorStore.getState().map, useEditorStore.getState().backgroundImage);
    expect(bounds.x).toBeLessThanOrEqual(-14);

    useEditorStore.getState().fitBackgroundImageToMap();
    expect(useEditorStore.getState().backgroundImage?.width).toBeGreaterThan(0);

    useEditorStore.getState().removeBackgroundImage();
    expect(useEditorStore.getState().backgroundImage).toBeNull();
    expect(useEditorStore.getState().tool).toBe("select");
  });

  it("selects a connected route node by node", () => {
    const store = useEditorStore.getState();

    store.addRouteNode("dock-a");
    useEditorStore.getState().addRouteNode("corr-1");

    expect(useEditorStore.getState().routeNodeIds).toEqual(["dock-a", "corr-1"]);
  });

  it("creates, updates, resets, straightens, and syncs edge curves", () => {
    const store = useEditorStore.getState();
    store.selectEdge("dock-a-corr-1");
    store.makeSelectedEdgeCurve();

    let edge = useEditorStore.getState().map.edges.find((item) => item.id === "dock-a-corr-1")!;
    expect(isSupportedQuadraticBezier(edge.trajectory)).toBe(true);

    useEditorStore.getState().updateSelectedEdgeCurveHandle(2.5, 3);
    edge = useEditorStore.getState().map.edges.find((item) => item.id === "dock-a-corr-1")!;
    expect(edge.trajectory?.controlPoints[1]).toMatchObject({ x: 2.5, y: 3 });

    useEditorStore.getState().resetSelectedEdgeCurve();
    edge = useEditorStore.getState().map.edges.find((item) => item.id === "dock-a-corr-1")!;
    expect(isSupportedQuadraticBezier(edge.trajectory)).toBe(true);

    useEditorStore.getState().selectNode("dock-a");
    useEditorStore.getState().updateNode({ ...useEditorStore.getState().map.nodes[0]!, x: -1, y: -1 });
    edge = useEditorStore.getState().map.edges.find((item) => item.id === "dock-a-corr-1")!;
    expect(edge.trajectory?.controlPoints[0]).toMatchObject({ x: -1, y: -1 });

    useEditorStore.getState().selectEdge("dock-a-corr-1");
    useEditorStore.getState().straightenSelectedEdge();
    edge = useEditorStore.getState().map.edges.find((item) => item.id === "dock-a-corr-1")!;
    expect(edge.trajectory).toBeNull();
  });

  it("updates node ids and keeps edges and route references aligned", () => {
    const store = useEditorStore.getState();
    store.addRouteNode("dock-a");
    store.selectNode("dock-a");
    store.updateNode({ ...store.map.nodes[0]!, id: "dock-alpha" });

    const next = useEditorStore.getState();
    expect(next.routeNodeIds).toEqual(["dock-alpha"]);
    expect(next.map.edges.some((edge) => edge.from === "dock-alpha")).toBe(true);
  });

  it("deletes selected nodes and dependent edges", () => {
    const store = useEditorStore.getState();
    store.selectNode("dock-a");
    store.deleteSelection();

    const next = useEditorStore.getState();
    expect(next.map.nodes.some((node) => node.id === "dock-a")).toBe(false);
    expect(next.map.edges.some((edge) => edge.from === "dock-a" || edge.to === "dock-a")).toBe(false);
  });
});
