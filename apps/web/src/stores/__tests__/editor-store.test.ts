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

  it("applies curve actions to the reverse edge when explicitly included", () => {
    const store = useEditorStore.getState();
    store.selectEdge("dock-a-corr-1");
    store.makeSelectedEdgeCurve({ includeReverse: true });

    let forward = useEditorStore.getState().map.edges.find((edge) => edge.from === "dock-a" && edge.to === "corr-1")!;
    let reverse = useEditorStore.getState().map.edges.find((edge) => edge.from === "corr-1" && edge.to === "dock-a")!;
    expect(isSupportedQuadraticBezier(forward.trajectory)).toBe(true);
    expect(isSupportedQuadraticBezier(reverse.trajectory)).toBe(true);
    expect(forward.trajectory?.controlPoints).toMatchObject([
      { x: 0, y: 0 },
      { x: 2.5, y: 1.25 },
      { x: 5, y: 0 },
    ]);
    expect(reverse.trajectory?.controlPoints).toMatchObject([
      { x: 5, y: 0 },
      { x: 2.5, y: 1.25 },
      { x: 0, y: 0 },
    ]);

    useEditorStore.getState().updateSelectedEdgeCurveHandle(2.5, 3);
    forward = useEditorStore.getState().map.edges.find((edge) => edge.from === "dock-a" && edge.to === "corr-1")!;
    reverse = useEditorStore.getState().map.edges.find((edge) => edge.from === "corr-1" && edge.to === "dock-a")!;
    expect(forward.trajectory?.controlPoints[1]).toMatchObject({ x: 2.5, y: 3 });
    expect(reverse.trajectory?.controlPoints[1]).toMatchObject({ x: 2.5, y: 3 });

    useEditorStore.getState().selectEdge("corr-1-dock-a");
    useEditorStore.getState().updateSelectedEdgeCurveHandle(2.5, -2);
    forward = useEditorStore.getState().map.edges.find((edge) => edge.from === "dock-a" && edge.to === "corr-1")!;
    reverse = useEditorStore.getState().map.edges.find((edge) => edge.from === "corr-1" && edge.to === "dock-a")!;
    expect(forward.trajectory?.controlPoints[1]).toMatchObject({ x: 2.5, y: -2 });
    expect(reverse.trajectory?.controlPoints[1]).toMatchObject({ x: 2.5, y: -2 });

    useEditorStore.getState().selectEdge("dock-a-corr-1");
    useEditorStore.getState().straightenSelectedEdge({ includeReverse: true });
    forward = useEditorStore.getState().map.edges.find((edge) => edge.from === "dock-a" && edge.to === "corr-1")!;
    reverse = useEditorStore.getState().map.edges.find((edge) => edge.from === "corr-1" && edge.to === "dock-a")!;
    expect(forward.trajectory).toBeNull();
    expect(reverse.trajectory).toBeNull();

    useEditorStore.getState().resetSelectedEdgeCurve({ includeReverse: true });
    forward = useEditorStore.getState().map.edges.find((edge) => edge.from === "dock-a" && edge.to === "corr-1")!;
    reverse = useEditorStore.getState().map.edges.find((edge) => edge.from === "corr-1" && edge.to === "dock-a")!;
    expect(isSupportedQuadraticBezier(forward.trajectory)).toBe(true);
    expect(isSupportedQuadraticBezier(reverse.trajectory)).toBe(true);
    expect(forward.trajectory?.controlPoints[1]).toMatchObject({ x: 2.5, y: 1.25 });
    expect(reverse.trajectory?.controlPoints[1]).toMatchObject({ x: 2.5, y: 1.25 });
  });

  it("bifurcates only the selected directed edge", () => {
    const store = useEditorStore.getState();
    store.selectEdge("dock-a-corr-1");
    store.bifurcateSelectedEdge();

    const next = useEditorStore.getState();
    const inserted = next.map.nodes.find((node) => node.id === "n-10");

    expect(inserted).toMatchObject({ id: "n-10", x: 2.5, y: 0 });
    expect(next.selection).toEqual({ type: "node", id: "n-10" });
    expect(next.map.edges.some((edge) => edge.id === "dock-a-corr-1")).toBe(false);
    expect(next.map.edges.some((edge) => edge.from === "corr-1" && edge.to === "dock-a")).toBe(true);
    expect(next.map.edges.map((edge) => `${edge.from}->${edge.to}`)).toContain("dock-a->n-10");
    expect(next.map.edges.map((edge) => `${edge.from}->${edge.to}`)).toContain("n-10->corr-1");
  });

  it("bifurcates the reverse edge when explicitly included", () => {
    const store = useEditorStore.getState();
    store.selectEdge("dock-a-corr-1");
    store.bifurcateSelectedEdge({ includeReverse: true });

    const next = useEditorStore.getState();
    const edgeDirections = next.map.edges.map((edge) => `${edge.from}->${edge.to}`);

    expect(next.map.nodes.find((node) => node.id === "n-10")).toMatchObject({ x: 2.5, y: 0 });
    expect(edgeDirections).not.toContain("dock-a->corr-1");
    expect(edgeDirections).not.toContain("corr-1->dock-a");
    expect(edgeDirections).toContain("dock-a->n-10");
    expect(edgeDirections).toContain("n-10->corr-1");
    expect(edgeDirections).toContain("corr-1->n-10");
    expect(edgeDirections).toContain("n-10->dock-a");
  });

  it("does not half-apply reverse bifurcation when the reverse trajectory is unsupported", () => {
    const map = createDemoMap();
    const reverse = map.edges.find((edge) => edge.from === "corr-1" && edge.to === "dock-a")!;
    reverse.trajectory = {
      degree: 3,
      knotVector: [0, 0, 0, 0, 1, 1, 1, 1],
      controlPoints: [
        { x: 5, y: 0 },
        { x: 4, y: 3 },
        { x: 1, y: 3 },
        { x: 0, y: 0 },
      ],
    };
    useEditorStore.setState({ map });

    useEditorStore.getState().selectEdge("dock-a-corr-1");
    useEditorStore.getState().bifurcateSelectedEdge({ includeReverse: true });

    const next = useEditorStore.getState();
    expect(next.map.nodes).toHaveLength(map.nodes.length);
    expect(next.map.edges).toHaveLength(map.edges.length);
    expect(next.map.edges.some((edge) => edge.id === "dock-a-corr-1")).toBe(true);
    expect(next.status).toBe("Reset unsupported reverse edge trajectory before bifurcating both directions.");
  });

  it("preserves supported curve shape when bifurcating a selected edge", () => {
    const store = useEditorStore.getState();
    store.selectEdge("dock-a-corr-1");
    store.makeSelectedEdgeCurve();
    useEditorStore.getState().updateSelectedEdgeCurveHandle(2.5, 3);

    useEditorStore.getState().bifurcateSelectedEdge();

    const next = useEditorStore.getState();
    const inserted = next.map.nodes.find((node) => node.id === "n-10")!;
    const first = next.map.edges.find((edge) => edge.from === "dock-a" && edge.to === "n-10")!;
    const second = next.map.edges.find((edge) => edge.from === "n-10" && edge.to === "corr-1")!;

    expect(inserted.x).toBeCloseTo(2.5);
    expect(inserted.y).toBeCloseTo(1.5);
    expect(isSupportedQuadraticBezier(first.trajectory)).toBe(true);
    expect(isSupportedQuadraticBezier(second.trajectory)).toBe(true);
    expect(first.trajectory?.controlPoints[1]).toMatchObject({ x: 1.25, y: 1.5 });
    expect(second.trajectory?.controlPoints[1]).toMatchObject({ x: 3.75, y: 1.5 });
  });

  it("does not bifurcate unsupported imported trajectories", () => {
    const map = createDemoMap();
    map.edges[0]!.trajectory = {
      degree: 3,
      knotVector: [0, 0, 0, 0, 1, 1, 1, 1],
      controlPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 0 },
      ],
    };
    useEditorStore.setState({ map });

    useEditorStore.getState().selectEdge("dock-a-corr-1");
    useEditorStore.getState().bifurcateSelectedEdge();

    const next = useEditorStore.getState();
    expect(next.map.nodes).toHaveLength(map.nodes.length);
    expect(next.map.edges).toHaveLength(map.edges.length);
    expect(next.status).toBe("Reset unsupported imported trajectory before bifurcating this edge.");
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
