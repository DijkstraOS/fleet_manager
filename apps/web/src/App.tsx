import { MapCanvas } from "./components/editor/MapCanvas";
import { MapCommandPanel } from "./components/panels/MapCommandPanel";
import { RouteWorkspacePanel } from "./components/panels/RouteWorkspacePanel";
import { TrackingPanel } from "./components/panels/TrackingPanel";
import { TopBar } from "./components/toolbar/TopBar";
import { useAppLifecycle } from "./hooks/useAppLifecycle";
import { useEditorStore } from "./stores/editor-store";

export default function App() {
  useAppLifecycle();
  const workspaceMode = useEditorStore((state) => state.workspaceMode);

  return (
    <div className="app-shell">
      <TopBar />
      <main className={`workspace ${workspaceMode}-workspace`}>
        {workspaceMode === "routes" && <RouteWorkspacePanel />}
        {workspaceMode === "tracking" && <TrackingPanel />}
        <MapCanvas />
        {workspaceMode === "map" && <MapCommandPanel />}
      </main>
    </div>
  );
}
