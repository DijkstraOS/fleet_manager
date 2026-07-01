import { useEffect } from "react";
import {
  getMap,
  listMaps,
  listRoutes,
} from "../services/api";
import { connectRealtime } from "../services/realtime";
import { useEditorStore } from "../stores/editor-store";
import { useFleetStore } from "../stores/fleet-store";
import { useRouteStore } from "../stores/route-store";

export function useAppLifecycle() {
  const mapId = useEditorStore((state) => state.map.id);
  const setMapDocument = useEditorStore((state) => state.setMapDocument);
  const setEditorStatus = useEditorStore((state) => state.setStatus);
  const setRoutes = useRouteStore((state) => state.setRoutes);
  const setRouteStatus = useRouteStore((state) => state.setStatus);

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
    listRoutes(mapId)
      .then((loadedRoutes) => {
        if (mounted) setRoutes(loadedRoutes);
      })
      .catch((error) => setRouteStatus(error instanceof Error ? error.message : "Could not load routes."));
    return () => {
      mounted = false;
    };
  }, [mapId, setRouteStatus, setRoutes]);

  // Read fleet actions via getState(), not closures — keep deps empty so a re-render never tears down and rebuilds the socket.
  useEffect(() => connectRealtime({
    onMessage: (message) => useFleetStore.getState().handleRealtimeMessage(message),
    onOpen: () => useFleetStore.getState().setRealtimeStatus("Realtime connected."),
    onClose: () => useFleetStore.getState().setRealtimeStatus("Realtime disconnected."),
  }), []);

  // Keep deps empty: adding `selection` here would re-subscribe App to selection and re-render the whole shell on every select.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const { selection, workspaceMode, deleteSelection } = useEditorStore.getState();
      if (workspaceMode !== "map" || !selection) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      deleteSelection();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
}
