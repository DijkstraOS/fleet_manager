import {
  nextRouteId,
  type RouteDocument,
  type ValidationIssue,
} from "@agv/core";
import {
  deleteRoute as deleteRouteDocument,
  saveMap as saveMapDocument,
  saveRoute as saveRouteDocument,
  sendOrder,
} from "../services/api";
import { useEditorStore } from "../stores/editor-store";
import { type RealtimeAgv, useFleetStore } from "../stores/fleet-store";
import { useRouteStore } from "../stores/route-store";

export function useRouteCommands(options: {
  agvs: RealtimeAgv[];
  routeIssues: ValidationIssue[];
  selectedRoute: RouteDocument | null;
}) {
  const map = useEditorStore((state) => state.map);
  const mapId = map.id;
  const selectedAgvSerial = useFleetStore((state) => state.selectedAgvSerial);
  const setOrderStatus = useFleetStore((state) => state.setOrderStatus);
  const routes = useRouteStore((state) => state.routes);
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId);
  const draftRouteName = useRouteStore((state) => state.draftName);
  const draftRouteNodeIds = useRouteStore((state) => state.draftNodeIds);
  const upsertRouteLocal = useRouteStore((state) => state.upsertRouteLocal);
  const removeRouteLocal = useRouteStore((state) => state.removeRouteLocal);
  const setRouteStatus = useRouteStore((state) => state.setStatus);

  return {
    saveRoute: async () => {
      if (options.routeIssues.length > 0) {
        setRouteStatus(options.routeIssues[0]?.message || "Invalid route.");
        return;
      }
      const name = draftRouteName.trim() || "New Route";
      const now = new Date().toISOString();
      const route = {
        id: options.selectedRoute?.id || nextRouteId(routes, name),
        mapId,
        name,
        nodeIds: draftRouteNodeIds,
        createdAt: options.selectedRoute?.createdAt || now,
        updatedAt: now,
      };
      const saved = await saveRouteDocument(route);
      upsertRouteLocal(saved);
    },
    deleteRoute: async () => {
      if (!selectedRouteId) return;
      await deleteRouteDocument(selectedRouteId);
      removeRouteLocal(selectedRouteId);
    },
    sendRoute: async () => {
      const agv = options.agvs.find((item) => item.serialNumber === selectedAgvSerial) || options.agvs[0];
      if (!agv) {
        setRouteStatus("Start the simulator app or connect an AGV first.");
        return;
      }
      if (options.routeIssues.length > 0) {
        setRouteStatus(options.routeIssues[0]?.message || "Invalid route.");
        return;
      }
      try {
        setRouteStatus("Preparing route...");
        await saveMapDocument(map);
        const response = await sendOrder({
          mapId,
          agvSerialNumber: agv.serialNumber,
          routeNodeIds: draftRouteNodeIds,
          ...(selectedRouteId ? { routeId: selectedRouteId } : {}),
          ...(draftRouteName.trim() ? { routeName: draftRouteName.trim() } : {}),
        });
        setOrderStatus(response.ok ? `Order sent to ${agv.serialNumber}.` : "Order failed.");
        setRouteStatus(response.ok ? `Sent ${draftRouteName} to ${agv.serialNumber}.` : "Order failed.");
      } catch (error) {
        setOrderStatus("Order failed.");
        setRouteStatus(error instanceof Error ? error.message : "Order failed.");
      }
    },
  };
}
