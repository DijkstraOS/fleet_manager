import { createDemoMap, createEmptyMap } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "../editor-store";

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.setState({
      map: createDemoMap(),
      workspaceMode: "map",
      tool: "select",
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

  it("selects a connected route node by node", () => {
    const store = useEditorStore.getState();

    store.addRouteNode("dock-a");
    useEditorStore.getState().addRouteNode("corr-1");

    expect(useEditorStore.getState().routeNodeIds).toEqual(["dock-a", "corr-1"]);
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
