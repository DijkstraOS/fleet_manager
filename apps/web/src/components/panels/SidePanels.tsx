import { FleetPanel } from "./FleetPanel";
import { InspectorPanel } from "./Inspector";
import { RoutePanel } from "./RoutePanel";
import { StatusPanel } from "./StatusPanel";

export function LeftPanel() {
  return (
    <aside className="left-panel">
      <RoutePanel />
      <FleetPanel />
      <StatusPanel />
    </aside>
  );
}

export function RightPanel() {
  return (
    <aside className="right-panel">
      <InspectorPanel />
    </aside>
  );
}
