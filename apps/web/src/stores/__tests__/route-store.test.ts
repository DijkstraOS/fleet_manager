import type { RouteDocument } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useRouteStore } from "../route-store";

function route(id: string, name: string, nodeIds: string[]): RouteDocument {
  return { id, mapId: "map-1", name, nodeIds, createdAt: "t", updatedAt: "t" };
}

describe("route store draftActive (right-zone editor card open state)", () => {
  beforeEach(() => {
    useRouteStore.setState({
      routes: [],
      selectedRouteId: null,
      draftName: "New Route",
      draftNodeIds: [],
      status: "No route selected.",
      draftActive: false,
    });
  });

  it("starts collapsed (no route selected, no draft)", () => {
    expect(useRouteStore.getState().draftActive).toBe(false);
  });

  it("opens when a new draft is started", () => {
    useRouteStore.getState().startNewRoute();
    expect(useRouteStore.getState().draftActive).toBe(true);
    expect(useRouteStore.getState().selectedRouteId).toBeNull();
  });

  it("opens when a saved route is selected", () => {
    useRouteStore.setState({ routes: [route("r1", "Alpha", ["a", "b"])] });
    useRouteStore.getState().selectRoute("r1");
    const state = useRouteStore.getState();
    expect(state.draftActive).toBe(true);
    expect(state.selectedRouteId).toBe("r1");
    expect(state.draftNodeIds).toEqual(["a", "b"]);
  });

  it("opens after loading routes (auto-selects the first) and collapses for an empty list", () => {
    useRouteStore.getState().setRoutes([route("r1", "Alpha", ["a", "b"])]);
    expect(useRouteStore.getState().draftActive).toBe(true);

    useRouteStore.getState().setRoutes([]);
    expect(useRouteStore.getState().draftActive).toBe(false);
  });

  it("stays open through mid-edit actions", () => {
    useRouteStore.getState().startNewRoute();
    useRouteStore.getState().setDraftNodeIds(["a", "b"]);
    useRouteStore.getState().removeLastDraftNode();
    expect(useRouteStore.getState().draftActive).toBe(true);
    useRouteStore.getState().clearDraft();
    expect(useRouteStore.getState().draftActive).toBe(true);
  });

  it("closes the editor and deselects when closeEditor is called", () => {
    useRouteStore.setState({ routes: [route("r1", "Alpha", ["a", "b"])] });
    useRouteStore.getState().selectRoute("r1");
    expect(useRouteStore.getState().draftActive).toBe(true);

    useRouteStore.getState().closeEditor();
    const state = useRouteStore.getState();
    expect(state.draftActive).toBe(false);
    expect(state.selectedRouteId).toBeNull();
    expect(state.draftNodeIds).toEqual([]);
  });

  it("collapses when the last saved route is deleted", () => {
    useRouteStore.getState().setRoutes([route("r1", "Alpha", ["a", "b"])]);
    useRouteStore.getState().removeRouteLocal("r1");
    expect(useRouteStore.getState().draftActive).toBe(false);
    expect(useRouteStore.getState().selectedRouteId).toBeNull();
  });
});
