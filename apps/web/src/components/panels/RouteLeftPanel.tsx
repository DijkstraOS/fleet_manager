import { useMemo, useState } from "react";
import { validateRoute } from "@agv/core";
import { useRouteCommands } from "../../hooks/useRouteCommands";
import { useEditorStore } from "../../stores/editor-store";
import { useFleetStore } from "../../stores/fleet-store";
import { useRouteStore } from "../../stores/route-store";
import { RouteLeftPanelView } from "./RouteLeftPanelView";

/**
 * Left-zone container for the Route tab. Owns the route *actions* — the saved-routes list
 * (browse/create) plus, while a route is active, Assign-AGV and Send / Start-Loop /
 * Stop-Loop. Editing the route's geometry lives in the right floating card
 * (RouteEditorCard); this panel only acts on the current draft/selection.
 */
export function RouteLeftPanel() {
  const map = useEditorStore((state) => state.map);
  const agvs = useFleetStore((state) => state.agvs);
  const selectedAgvSerial = useFleetStore((state) => state.selectedAgvSerial);
  const orderStatuses = useFleetStore((state) => state.orderStatuses);
  const selectAgv = useFleetStore((state) => state.selectAgv);
  const routes = useRouteStore((state) => state.routes);
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId);
  const draftActive = useRouteStore((state) => state.draftActive);
  const draftRouteNodeIds = useRouteStore((state) => state.draftNodeIds);
  const startNewRoute = useRouteStore((state) => state.startNewRoute);
  const selectRoute = useRouteStore((state) => state.selectRoute);
  const closeEditor = useRouteStore((state) => state.closeEditor);
  const [loopRoute, setLoopRoute] = useState(false);

  // Tapping the already-selected route toggles it off (deselect + close the editor).
  const toggleRoute = (routeId: string) =>
    routeId === selectedRouteId ? closeEditor() : selectRoute(routeId);

  const routeIssues = useMemo(() => validateRoute(map, draftRouteNodeIds), [map, draftRouteNodeIds]);
  const agvList = useMemo(() => Object.values(agvs), [agvs]);
  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) || null,
    [routes, selectedRouteId]
  );
  const canLoopRoute = draftRouteNodeIds.length >= 2
    && draftRouteNodeIds[0] === draftRouteNodeIds[draftRouteNodeIds.length - 1];
  const selectedOrderStatus = selectedAgvSerial ? orderStatuses[selectedAgvSerial] : null;
  const canStopLoop = Boolean(
    selectedOrderStatus?.loop
    && selectedOrderStatus.status !== "completed"
    && selectedOrderStatus.status !== "failed"
    && selectedOrderStatus.status !== "rejected"
    && selectedOrderStatus.status !== "loop stopped"
  );
  const { sendRoute, stopLoop } = useRouteCommands({ agvs: agvList, routeIssues, selectedRoute });
  const canSendRoute = draftRouteNodeIds.length >= 2
    && routeIssues.length === 0
    && agvList.length > 0
    && (!loopRoute || canLoopRoute);

  return (
    <RouteLeftPanelView
      routes={routes}
      selectedRouteId={selectedRouteId}
      onNewRoute={startNewRoute}
      onSelectRoute={toggleRoute}
      showActions={draftActive}
      agvs={agvList}
      selectedAgvSerial={selectedAgvSerial}
      loopRoute={loopRoute}
      canLoopRoute={canLoopRoute}
      draftRouteNodeIds={draftRouteNodeIds}
      canSendRoute={canSendRoute}
      canStopLoop={canStopLoop}
      onSelectAgv={selectAgv}
      onLoopRouteChange={setLoopRoute}
      onSendRoute={() => void sendRoute({ loop: loopRoute })}
      onStopLoop={() => void stopLoop()}
    />
  );
}
