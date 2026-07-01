import { useMemo } from "react";
import { validateRoute } from "@agv/core";
import { useRouteCommands } from "../../hooks/useRouteCommands";
import { useEditorStore } from "../../stores/editor-store";
import { useRouteStore } from "../../stores/route-store";
import { useRenderTally } from "../../lib/render-tally";
import { FloatingCard } from "./FloatingCard";
import { RouteEditorCardView } from "./RouteEditorCardView";

export function RouteEditorCard() {
  useRenderTally("RouteEditorCard");
  const map = useEditorStore((state) => state.map);
  const routes = useRouteStore((state) => state.routes);
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId);
  const draftActive = useRouteStore((state) => state.draftActive);
  const draftRouteName = useRouteStore((state) => state.draftName);
  const draftRouteNodeIds = useRouteStore((state) => state.draftNodeIds);
  const routeStatus = useRouteStore((state) => state.status);
  const setDraftRouteName = useRouteStore((state) => state.setDraftName);
  const removeLastRouteNode = useRouteStore((state) => state.removeLastDraftNode);
  const clearDraftRoute = useRouteStore((state) => state.clearDraft);
  const closeEditor = useRouteStore((state) => state.closeEditor);
  const routeIssues = useMemo(() => validateRoute(map, draftRouteNodeIds), [map, draftRouteNodeIds]);
  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) || null,
    [routes, selectedRouteId]
  );
  // agvs: [] — save/delete never dispatch to an AGV; send/loop (which use agvs) live in RouteLeftPanel.
  const { saveRoute, deleteRoute } = useRouteCommands({ agvs: [], routeIssues, selectedRoute });

  return (
    <FloatingCard open={draftActive} title="Route Editor" onClose={closeEditor}>
      <RouteEditorCardView
        selectedRouteId={selectedRouteId}
        draftRouteName={draftRouteName}
        draftRouteNodeIds={draftRouteNodeIds}
        routeIssues={routeIssues}
        routeStatus={routeStatus}
        canSaveRoute={draftRouteName.trim().length > 0 && draftRouteNodeIds.length >= 2 && routeIssues.length === 0}
        onDraftName={setDraftRouteName}
        onRemoveLastNode={removeLastRouteNode}
        onClearRoute={clearDraftRoute}
        onSaveRoute={() => void saveRoute()}
        onDeleteRoute={() => void deleteRoute()}
      />
    </FloatingCard>
  );
}
