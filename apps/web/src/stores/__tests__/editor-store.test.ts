import { buildVdaOrder, createDemoMap, createEmptyMap, isSupportedQuadraticBezier } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "../editor-store";

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.setState({
      map: createDemoMap(),
      workspaceMode: "map",
      tool: "select",
      backgroundImage: null,
      heightAspectLocked: true,
      selection: null,
      edgeStartNodeId: null,
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

  it("reshapes the floor to the image aspect on attach and keeps it on remove", () => {
    const widthBefore = useEditorStore.getState().map.canvas.width;
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
    expect(attached?.opacity).toBe(0.65);
    expect(useEditorStore.getState().map.canvas).toEqual({ width: widthBefore, height: widthBefore / 2 });

    useEditorStore.getState().setBackgroundImageOpacity(0.25);
    expect(useEditorStore.getState().backgroundImage?.opacity).toBe(0.25);
    useEditorStore.getState().setBackgroundImageOpacity(5);
    expect(useEditorStore.getState().backgroundImage?.opacity).toBe(1);

    useEditorStore.getState().removeBackgroundImage();
    expect(useEditorStore.getState().backgroundImage).toBeNull();
    expect(useEditorStore.getState().map.canvas).toEqual({ width: widthBefore, height: widthBefore / 2 });
  });

  it("calibrates the floor width, rescaling nodes so LIF export is to-scale", () => {
    const before = useEditorStore.getState().map;
    const dockBefore = before.nodes.find((node) => node.id === "dock-a")!;
    const fractionX = dockBefore.x / before.canvas.width;
    const fractionY = dockBefore.y / before.canvas.height;

    // No image attached -> width-only rescale (height axis unchanged).
    useEditorStore.getState().setCanvasWidth(400);

    const after = useEditorStore.getState().map;
    expect(after.canvas).toEqual({ width: 400, height: before.canvas.height });
    const dockAfter = after.nodes.find((node) => node.id === "dock-a")!;
    // x doubled (200 -> 400), y untouched; the node holds its plan-fraction across.
    expect(dockAfter.x).toBeCloseTo(dockBefore.x * 2, 10);
    expect(dockAfter.y).toBe(dockBefore.y);
    expect(dockAfter.x / after.canvas.width).toBeCloseTo(fractionX, 12);
    expect(dockAfter.y / after.canvas.height).toBeCloseTo(fractionY, 12);

    // The VDA/LIF export reflects the new to-scale coordinates.
    const order = buildVdaOrder(
      after,
      { mapId: after.id, agvSerialNumber: "agv-1", routeNodeIds: ["dock-a", "corr-1"] },
      "order-1"
    );
    const exportedDock = order.nodes.find((node) => node.nodeId === "dock-a")!;
    expect(exportedDock.nodePosition!.x).toBeCloseTo(dockAfter.x, 10);
    expect(exportedDock.nodePosition!.y).toBeCloseTo(dockAfter.y, 10);
  });

  it("rejects a non-positive calibration width (no-op)", () => {
    const before = useEditorStore.getState().map;
    useEditorStore.getState().setCanvasWidth(0);
    useEditorStore.getState().setCanvasWidth(-5);
    expect(useEditorStore.getState().map.canvas).toEqual(before.canvas);
  });

  it("rescales the height uniformly when calibrating width with an aspect-locked image", () => {
    useEditorStore.getState().attachBackgroundImage({
      src: "data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%220%200%20200%20100%22%3E%3C%2Fsvg%3E",
      fileName: "plant.svg",
      mediaType: "image/svg+xml",
      naturalWidth: 200,
      naturalHeight: 100,
    });
    // Image is 2:1, so the floor is now width x (width/2).
    const attached = useEditorStore.getState().map.canvas;
    expect(attached.height).toBe(attached.width / 2);

    useEditorStore.getState().setCanvasWidth(300);
    // Aspect-locked: height follows to keep the 2:1 ratio.
    expect(useEditorStore.getState().map.canvas).toEqual({ width: 300, height: 150 });

    // Unlock and calibrate height independently (distorted scan): y only.
    useEditorStore.getState().setHeightAspectLocked(false);
    useEditorStore.getState().setCanvasHeight(200);
    expect(useEditorStore.getState().map.canvas).toEqual({ width: 300, height: 200 });
  });

  it("keeps calibrated node coordinates when the background image is removed", () => {
    const map = {
      ...createEmptyMap("Plan"),
      nodes: [{ id: "n", label: "N", x: 50, y: 120 }],
    };
    useEditorStore.setState({ map, backgroundImage: null });

    useEditorStore.getState().attachBackgroundImage({
      src: "data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%220%200%20200%20100%22%3E%3C%2Fsvg%3E",
      fileName: "plant.svg",
      mediaType: "image/svg+xml",
      naturalWidth: 200,
      naturalHeight: 100,
    });
    // Calibrate to real-world meters: width 50 → floor 50×25 (aspect-locked).
    useEditorStore.getState().setCanvasWidth(50);

    const calibrated = useEditorStore.getState().map;
    expect(calibrated.canvas).toEqual({ width: 50, height: 25 });
    const calibratedNode = calibrated.nodes.find((node) => node.id === "n")!;

    useEditorStore.getState().removeBackgroundImage();

    // Removing the visual basemap must not resize the floor or move calibrated nodes.
    const after = useEditorStore.getState().map;
    expect(after.canvas).toEqual({ width: 50, height: 25 });
    const afterNode = after.nodes.find((node) => node.id === "n")!;
    expect(afterNode.x).toBeCloseTo(calibratedNode.x, 10);
    expect(afterNode.y).toBeCloseTo(calibratedNode.y, 10);
    expect(useEditorStore.getState().backgroundImage).toBeNull();
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
    { x: 92.5, y: 95 },
    { x: 95, y: 96.25 },
    { x: 97.5, y: 95 },
  ]);
    expect(reverse.trajectory?.controlPoints).toMatchObject([
      { x: 97.5, y: 95 },
      { x: 95, y: 96.25 },
      { x: 92.5, y: 95 },
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
    expect(forward.trajectory?.controlPoints[1]).toMatchObject({ x: 95, y: 96.25 });
    expect(reverse.trajectory?.controlPoints[1]).toMatchObject({ x: 95, y: 96.25 });
  });

  it("bifurcates only the selected directed edge", () => {
    const store = useEditorStore.getState();
    store.selectEdge("dock-a-corr-1");
    store.bifurcateSelectedEdge();

    const next = useEditorStore.getState();
    const inserted = next.map.nodes.find((node) => node.id === "n-10");

    expect(inserted).toMatchObject({ id: "n-10", x: 95, y: 95 });
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

    expect(next.map.nodes.find((node) => node.id === "n-10")).toMatchObject({ x: 95, y: 95 });
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
    // Handle near the floor-centered dock-a (92.5,95)->corr-1 (97.5,95) edge,
    // bulging ~3 m above the y=95 row (mirrors the old (2.5,3) on a y=0 edge).
    useEditorStore.getState().updateSelectedEdgeCurveHandle(95, 98);

    useEditorStore.getState().bifurcateSelectedEdge();

    const next = useEditorStore.getState();
    const inserted = next.map.nodes.find((node) => node.id === "n-10")!;
    const first = next.map.edges.find((edge) => edge.from === "dock-a" && edge.to === "n-10")!;
    const second = next.map.edges.find((edge) => edge.from === "n-10" && edge.to === "corr-1")!;

    expect(inserted.x).toBeCloseTo(95);
    expect(inserted.y).toBeCloseTo(96.5);
    expect(isSupportedQuadraticBezier(first.trajectory)).toBe(true);
    expect(isSupportedQuadraticBezier(second.trajectory)).toBe(true);
    expect(first.trajectory?.controlPoints[1]).toMatchObject({ x: 93.75, y: 96.5 });
    expect(second.trajectory?.controlPoints[1]).toMatchObject({ x: 96.25, y: 96.5 });
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

  it("updates node ids and keeps edges aligned", () => {
    const store = useEditorStore.getState();
    store.selectNode("dock-a");
    store.updateNode({ ...store.map.nodes[0]!, id: "dock-alpha" });

    const next = useEditorStore.getState();
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
