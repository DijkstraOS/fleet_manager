import { useEffect, useMemo } from "react";
import { exportLifDocument, importLifDocument, nextRouteId, validateRoute } from "@agv/core";
import { downloadJson } from "../lib/download";
import {
  deleteRoute,
  exportLif,
  getMap,
  listMaps,
  listRoutes,
  saveMap,
  saveRoute as saveRouteDocument,
  sendOrder,
} from "../services/api";
import { connectRealtime } from "../services/realtime";
import { useEditorStore } from "../stores/editor-store";
import { useFleetStore } from "../stores/fleet-store";
import { useRouteStore } from "../stores/route-store";

export function useAppController() {
  const map = useEditorStore((state) => state.map);
  const workspaceMode = useEditorStore((state) => state.workspaceMode);
  const tool = useEditorStore((state) => state.tool);
  const selection = useEditorStore((state) => state.selection);
  const setMapDocument = useEditorStore((state) => state.setMapDocument);
  const setEditorStatus = useEditorStore((state) => state.setStatus);
  const renameMap = useEditorStore((state) => state.renameMap);
  const setWorkspaceMode = useEditorStore((state) => state.setWorkspaceMode);
  const setTool = useEditorStore((state) => state.setTool);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const addReverseEdgeForSelection = useEditorStore((state) => state.addReverseEdgeForSelection);
  const agvs = useFleetStore((state) => state.agvs);
  const handleRealtimeMessage = useFleetStore((state) => state.handleRealtimeMessage);
  const realtimeStatus = useFleetStore((state) => state.realtimeStatus);
  const setRealtimeStatus = useFleetStore((state) => state.setRealtimeStatus);
  const setOrderStatus = useFleetStore((state) => state.setOrderStatus);
  const selectedAgvSerial = useFleetStore((state) => state.selectedAgvSerial);
  const selectAgv = useFleetStore((state) => state.selectAgv);
  const orderStatuses = useFleetStore((state) => state.orderStatuses);
  const routes = useRouteStore((state) => state.routes);
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId);
  const draftRouteName = useRouteStore((state) => state.draftName);
  const draftRouteNodeIds = useRouteStore((state) => state.draftNodeIds);
  const routeStatus = useRouteStore((state) => state.status);
  const setRoutes = useRouteStore((state) => state.setRoutes);
  const startNewRoute = useRouteStore((state) => state.startNewRoute);
  const selectRoute = useRouteStore((state) => state.selectRoute);
  const setDraftRouteName = useRouteStore((state) => state.setDraftName);
  const removeLastRouteNode = useRouteStore((state) => state.removeLastDraftNode);
  const clearDraftRoute = useRouteStore((state) => state.clearDraft);
  const upsertRouteLocal = useRouteStore((state) => state.upsertRouteLocal);
  const removeRouteLocal = useRouteStore((state) => state.removeRouteLocal);
  const setRouteStatus = useRouteStore((state) => state.setStatus);
  const routeIssues = useMemo(() => validateRoute(map, draftRouteNodeIds), [map, draftRouteNodeIds]);
  const agvList = useMemo(() => Object.values(agvs), [agvs]);
  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) || null,
    [routes, selectedRouteId]
  );
  const trackingRouteNodeIds = useMemo(() => {
    const activeStatus = Object.values(orderStatuses).find((status) => {
      const agv = agvs[status.serialNumber];
      return status.routeId && agv?.state?.driving;
    });
    if (!activeStatus?.routeId) return [];
    return routes.find((route) => route.id === activeStatus.routeId)?.nodeIds || [];
  }, [agvs, orderStatuses, routes]);

  useEffect(() => {
    let mounted = true;
    listMaps()
      .then(async (maps) => {
        const first = maps[0];
        return first ? getMap(first.id) : useEditorStore.getState().map;
      })
      .then((loaded) => {
        if (mounted) setMapDocument(loaded, `Loaded ${loaded.name}`);
      })
      .catch((error) => setEditorStatus(error instanceof Error ? error.message : "Could not load map."));
    return () => {
      mounted = false;
    };
  }, [setEditorStatus, setMapDocument]);

  useEffect(() => {
    let mounted = true;
    listRoutes(map.id)
      .then((loadedRoutes) => {
        if (mounted) setRoutes(loadedRoutes);
      })
      .catch((error) => setRouteStatus(error instanceof Error ? error.message : "Could not load routes."));
    return () => {
      mounted = false;
    };
  }, [map.id, setRouteStatus, setRoutes]);

  useEffect(() => connectRealtime({
    onMessage: handleRealtimeMessage,
    onOpen: () => setRealtimeStatus("Realtime connected."),
    onClose: () => setRealtimeStatus("Realtime disconnected."),
  }), [handleRealtimeMessage, setRealtimeStatus]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (workspaceMode !== "map" || !selection) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      deleteSelection();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelection, selection, workspaceMode]);

  return {
    map,
    mapName: map.name,
    workspaceMode,
    tool,
    selection,
    canAddReverseEdge: selection?.type === "edge",
    routes,
    selectedRouteId,
    selectedRoute,
    draftRouteName,
    draftRouteNodeIds,
    routeIssues,
    routeStatus,
    agvs: agvList,
    selectedAgvSerial,
    selectAgv,
    orderStatuses,
    realtimeStatus,
    trackingRouteNodeIds,
    canSaveRoute: draftRouteName.trim().length > 0 && draftRouteNodeIds.length >= 2 && routeIssues.length === 0,
    canSendRoute: draftRouteNodeIds.length >= 2 && routeIssues.length === 0 && agvList.length > 0,
    renameMap,
    setWorkspaceMode,
    setTool,
    deleteSelection,
    addReverseEdgeForSelection,
    startNewRoute,
    selectRoute,
    setDraftRouteName,
    removeLastRouteNode,
    clearDraftRoute,
    save: async () => {
      const saved = await saveMap(map);
      setMapDocument(saved, `Saved ${saved.name}.`);
    },
    saveRoute: async () => {
      if (routeIssues.length > 0) {
        setRouteStatus(routeIssues[0]?.message || "Invalid route.");
        return;
      }
      const name = draftRouteName.trim() || "New Route";
      const now = new Date().toISOString();
      const route = {
        id: selectedRoute?.id || nextRouteId(routes, name),
        mapId: map.id,
        name,
        nodeIds: draftRouteNodeIds,
        createdAt: selectedRoute?.createdAt || now,
        updatedAt: now,
      };
      const saved = await saveRouteDocument(route);
      upsertRouteLocal(saved);
    },
    deleteRoute: async () => {
      if (!selectedRouteId) return;
      await deleteRoute(selectedRouteId);
      removeRouteLocal(selectedRouteId);
    },
    sendRoute: async () => {
      const agv = agvList.find((item) => item.serialNumber === selectedAgvSerial) || agvList[0];
      if (!agv) return setRouteStatus("Start the simulator app or connect an AGV first.");
      if (routeIssues.length > 0) return setRouteStatus(routeIssues[0]?.message || "Invalid route.");
      const response = await sendOrder({
        mapId: map.id,
        agvSerialNumber: agv.serialNumber,
        routeNodeIds: draftRouteNodeIds,
        ...(selectedRouteId ? { routeId: selectedRouteId } : {}),
        ...(draftRouteName.trim() ? { routeName: draftRouteName.trim() } : {}),
      });
      setOrderStatus(response.ok ? `Order sent to ${agv.serialNumber}.` : "Order failed.");
      setRouteStatus(response.ok ? `Sent ${draftRouteName} to ${agv.serialNumber}.` : "Order failed.");
    },
    exportMap: async () => {
      const lif = await exportLif(map.id).catch(() => exportLifDocument(map));
      downloadJson(`${map.id}.lif.json`, lif);
    },
    importMap: async (file: File) => {
      const imported = importLifDocument(JSON.parse(await file.text()));
      setMapDocument(imported, `Imported ${imported.name}.`);
    },
  };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
}
