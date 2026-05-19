import { useEffect, useMemo } from "react";
import { exportLifDocument, importLifDocument, validateRoute } from "@agv/core";
import { downloadJson } from "../lib/download";
import { exportLif, getMap, listMaps, saveMap, sendOrder } from "../services/api";
import { connectRealtime } from "../services/realtime";
import { useEditorStore } from "../stores/editor-store";
import { useFleetStore } from "../stores/fleet-store";

export function useAppController() {
  const map = useEditorStore((state) => state.map);
  const tool = useEditorStore((state) => state.tool);
  const routeNodeIds = useEditorStore((state) => state.routeNodeIds);
  const setMapDocument = useEditorStore((state) => state.setMapDocument);
  const setEditorStatus = useEditorStore((state) => state.setStatus);
  const renameMap = useEditorStore((state) => state.renameMap);
  const setTool = useEditorStore((state) => state.setTool);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const agvs = useFleetStore((state) => state.agvs);
  const handleRealtimeMessage = useFleetStore((state) => state.handleRealtimeMessage);
  const setRealtimeStatus = useFleetStore((state) => state.setRealtimeStatus);
  const setOrderStatus = useFleetStore((state) => state.setOrderStatus);
  const selectedAgvSerial = useFleetStore((state) => state.selectedAgvSerial);
  const routeIssues = useMemo(() => validateRoute(map, routeNodeIds), [map, routeNodeIds]);
  const agvList = useMemo(() => Object.values(agvs), [agvs]);

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

  useEffect(() => connectRealtime({
    onMessage: handleRealtimeMessage,
    onOpen: () => setRealtimeStatus("Realtime connected."),
    onClose: () => setRealtimeStatus("Realtime disconnected."),
  }), [handleRealtimeMessage, setRealtimeStatus]);

  return {
    mapName: map.name,
    tool,
    canSendOrder: routeNodeIds.length >= 2 && routeIssues.length === 0 && agvList.length > 0,
    renameMap,
    setTool,
    deleteSelection,
    save: async () => {
      const saved = await saveMap(map);
      setMapDocument(saved, `Saved ${saved.name}.`);
    },
    sendOrder: async () => {
      const agv = agvList.find((item) => item.serialNumber === selectedAgvSerial) || agvList[0];
      if (!agv) return setEditorStatus("Start the simulator app or connect an AGV first.");
      if (routeIssues.length > 0) return setEditorStatus(routeIssues[0]?.message || "Invalid route.");
      const response = await sendOrder({ mapId: map.id, agvSerialNumber: agv.serialNumber, routeNodeIds });
      setOrderStatus(response.ok ? `Order sent to ${agv.serialNumber}.` : "Order failed.");
      useEditorStore.getState().clearRoute();
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
