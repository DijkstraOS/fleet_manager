import { useMemo } from "react";
import { validateRoute } from "@agv/core";
import { useRouteCommands } from "../../hooks/useRouteCommands";
import { useEditorStore } from "../../stores/editor-store";
import { useRouteStore } from "../../stores/route-store";
import { FloatingCard } from "./FloatingCard";
import { RouteEditorCardView } from "./RouteEditorCardView";

/**
 * Right-zone container for the Route tab. Mounts the floating route editor — name, node
 * sequence, and save/clear/delete. Just the route; assigning an AGV and sending orders
 * are route actions and live in the left column (RouteLeftPanel). Opens while a route is
 * selected or a new draft is active (`draftActive`), and the header close button collapses
 * it by deselecting the route. The card is an absolute overlay over the map's right edge,
 * so mounting it never reflows the canvas.
 */
export function RouteEditorCard() {
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
  // Save/delete act on the route alone — they never dispatch to an AGV, so the fleet
  // stays out of this container. Send / Start-Loop / Stop-Loop live in RouteLeftPanel.
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
