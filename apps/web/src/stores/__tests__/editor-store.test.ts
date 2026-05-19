import { createDemoMap } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "../editor-store";

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.setState({
      map: createDemoMap(),
      tool: "select",
      selection: null,
      edgeStartNodeId: null,
      routeNodeIds: [],
      dragNodeId: null,
      status: "Loading map...",
    });
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
