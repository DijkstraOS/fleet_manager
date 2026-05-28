import { useMemo, useState } from "react";
import { validateRoute } from "@agv/core";
import { useRouteCommands } from "../../hooks/useRouteCommands";
import { useEditorStore } from "../../stores/editor-store";
import { useFleetStore } from "../../stores/fleet-store";
import { useRouteStore } from "../../stores/route-store";
import { RouteWorkspacePanelView } from "./RouteWorkspacePanelView";

export function RouteWorkspacePanel() {
  const map = useEditorStore((state) => state.map);
  const agvs = useFleetStore((state) => state.agvs);
  const selectedAgvSerial = useFleetStore((state) => state.selectedAgvSerial);
  const orderStatuses = useFleetStore((state) => state.orderStatuses);
  const selectAgv = useFleetStore((state) => state.selectAgv);
  const routes = useRouteStore((state) => state.routes);
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId);
  const draftRouteName = useRouteStore((state) => state.draftName);
  const draftRouteNodeIds = useRouteStore((state) => state.draftNodeIds);
  const routeStatus = useRouteStore((state) => state.status);
  const startNewRoute = useRouteStore((state) => state.startNewRoute);
  const selectRoute = useRouteStore((state) => state.selectRoute);
  const setDraftRouteName = useRouteStore((state) => state.setDraftName);
  const removeLastRouteNode = useRouteStore((state) => state.removeLastDraftNode);
  const clearDraftRoute = useRouteStore((state) => state.clearDraft);
  const [loopRoute, setLoopRoute] = useState(false);
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
    && selectedOrderStatus.status !== "loop stopped"
  );
  const { saveRoute, deleteRoute, sendRoute, stopLoop } = useRouteCommands({
    agvs: agvList,
    routeIssues,
    selectedRoute,
  });
  const canSendRoute = draftRouteNodeIds.length >= 2
    && routeIssues.length === 0
    && agvList.length > 0
    && (!loopRoute || canLoopRoute);

  return (
    <RouteWorkspacePanelView
      routes={routes}
      selectedRouteId={selectedRouteId}
      draftRouteName={draftRouteName}
      draftRouteNodeIds={draftRouteNodeIds}
      routeIssues={routeIssues}
      routeStatus={routeStatus}
      agvs={agvList}
      selectedAgvSerial={selectedAgvSerial}
      loopRoute={loopRoute}
      canLoopRoute={canLoopRoute}
      canSaveRoute={draftRouteName.trim().length > 0 && draftRouteNodeIds.length >= 2 && routeIssues.length === 0}
      canSendRoute={canSendRoute}
      canStopLoop={canStopLoop}
      onNewRoute={startNewRoute}
      onSelectRoute={selectRoute}
      onDraftName={setDraftRouteName}
      onRemoveLastNode={removeLastRouteNode}
      onClearRoute={clearDraftRoute}
      onSaveRoute={() => void saveRoute()}
      onDeleteRoute={() => void deleteRoute()}
      onSelectAgv={selectAgv}
      onLoopRouteChange={setLoopRoute}
      onSendRoute={() => void sendRoute({ loop: loopRoute })}
      onStopLoop={() => void stopLoop()}
    />
  );
}
