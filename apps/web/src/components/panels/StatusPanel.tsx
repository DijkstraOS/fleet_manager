import { useEditorStore } from "../../stores/editor-store";
import { useFleetStore } from "../../stores/fleet-store";
import { StatusPanelView } from "./StatusPanelView";

export function StatusPanel() {
  const editorStatus = useEditorStore((state) => state.status);
  const realtimeStatus = useFleetStore((state) => state.realtimeStatus);
  const orderStatus = useFleetStore((state) => state.orderStatus);

  return (
    <StatusPanelView
      primaryStatus={orderStatus || editorStatus || realtimeStatus}
      realtimeStatus={realtimeStatus}
    />
  );
}
