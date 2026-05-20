import {
  Activity,
  Map as MapIcon,
  Route,
} from "lucide-react";
import type { WorkspaceMode } from "../../types";

export function TopBarView(props: {
  mapName: string;
  workspaceMode: WorkspaceMode;
  onRenameMap: (name: string) => void;
  onSetWorkspaceMode: (mode: WorkspaceMode) => void;
}) {
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">AGV Map Simulator</div>
        <input
          className="map-title"
          value={props.mapName}
          onChange={(event) => props.onRenameMap(event.target.value)}
        />
      </div>
      <div className="mode-switch" role="tablist" aria-label="Workspace mode">
        <button
          type="button"
          className={props.workspaceMode === "map" ? "mode-button active" : "mode-button"}
          onClick={() => props.onSetWorkspaceMode("map")}
        >
          <MapIcon /> Map
        </button>
        <button
          type="button"
          className={props.workspaceMode === "routes" ? "mode-button active" : "mode-button"}
          onClick={() => props.onSetWorkspaceMode("routes")}
        >
          <Route /> Routes
        </button>
        <button
          type="button"
          className={props.workspaceMode === "tracking" ? "mode-button active" : "mode-button"}
          onClick={() => props.onSetWorkspaceMode("tracking")}
        >
          <Activity /> Tracking
        </button>
      </div>
    </header>
  );
}
