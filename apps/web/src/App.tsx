import { MapCanvas } from "./components/editor/MapCanvas";
import { MapInspectorCard } from "./components/panels/MapInspectorCard";
import { MapLeftPanel } from "./components/panels/MapLeftPanel";
import { RouteEditorCard } from "./components/panels/RouteEditorCard";
import { RouteLeftPanel } from "./components/panels/RouteLeftPanel";
import { TrackingDetailCard } from "./components/panels/TrackingDetailCard";
import { TrackingLeftPanel } from "./components/panels/TrackingLeftPanel";
import { TopBar } from "./components/toolbar/TopBar";
import { useAppLifecycle } from "./hooks/useAppLifecycle";
import { useEditorStore } from "./stores/editor-store";
import { useRenderTally } from "./lib/render-tally";

export default function App() {
  useRenderTally("App");
  useAppLifecycle();
  const workspaceMode = useEditorStore((state) => state.workspaceMode);

  return (
    <div className="app-shell">
      <TopBar />
      <main className={`workspace ${workspaceMode}-workspace`}>
        {workspaceMode === "map" && <MapLeftPanel />}
        {workspaceMode === "routes" && <RouteLeftPanel />}
        {workspaceMode === "tracking" && <TrackingLeftPanel />}
        <MapCanvas />
        {workspaceMode === "map" && <MapInspectorCard />}
        {workspaceMode === "routes" && <RouteEditorCard />}
        {workspaceMode === "tracking" && <TrackingDetailCard />}
      </main>
    </div>
  );
}