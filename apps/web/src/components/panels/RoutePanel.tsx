import { useEditorStore } from "../../stores/editor-store";
import { RoutePanelView } from "./RoutePanelView";

export function RoutePanel() {
  const routeNodeIds = useEditorStore((state) => state.routeNodeIds);
  const clearRoute = useEditorStore((state) => state.clearRoute);

  return <RoutePanelView routeNodeIds={routeNodeIds} onClearRoute={clearRoute} />;
}
