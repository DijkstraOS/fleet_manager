import { MapCanvas } from "./components/editor/MapCanvas";
import { MapCommandPanel } from "./components/panels/MapCommandPanel";
import { RouteWorkspacePanel } from "./components/panels/RouteWorkspacePanel";
import { TrackingPanel } from "./components/panels/TrackingPanel";
import { TopBar } from "./components/toolbar/TopBar";
import { useAppController } from "./hooks/useAppController";

export default function App() {
  const controller = useAppController();

  return (
    <div className="app-shell">
      <TopBar
        mapName={controller.mapName}
        workspaceMode={controller.workspaceMode}
        onRenameMap={controller.renameMap}
        onSetWorkspaceMode={controller.setWorkspaceMode}
      />
      <main className={`workspace ${controller.workspaceMode}-workspace`}>
        {controller.workspaceMode === "routes" && (
          <RouteWorkspacePanel
            routes={controller.routes}
            selectedRouteId={controller.selectedRouteId}
            draftRouteName={controller.draftRouteName}
            draftRouteNodeIds={controller.draftRouteNodeIds}
            routeIssues={controller.routeIssues}
            routeStatus={controller.routeStatus}
            agvs={controller.agvs}
            selectedAgvSerial={controller.selectedAgvSerial}
            canSaveRoute={controller.canSaveRoute}
            canSendRoute={controller.canSendRoute}
            onNewRoute={controller.startNewRoute}
            onSelectRoute={controller.selectRoute}
            onDraftName={controller.setDraftRouteName}
            onRemoveLastNode={controller.removeLastRouteNode}
            onClearRoute={controller.clearDraftRoute}
            onSaveRoute={() => void controller.saveRoute()}
            onDeleteRoute={() => void controller.deleteRoute()}
            onSelectAgv={controller.selectAgv}
            onSendRoute={() => void controller.sendRoute()}
          />
        )}
        {controller.workspaceMode === "tracking" && (
          <TrackingPanel
            agvs={controller.agvs}
            orderStatuses={controller.orderStatuses}
            realtimeStatus={controller.realtimeStatus}
          />
        )}
        <MapCanvas />
        {controller.workspaceMode === "map" && (
          <MapCommandPanel
            tool={controller.tool}
            selection={controller.selection}
            canAddReverseEdge={controller.canAddReverseEdge}
            onSetTool={controller.setTool}
            onDeleteSelection={controller.deleteSelection}
            onAddReverseEdge={controller.addReverseEdgeForSelection}
            onSave={() => void controller.save()}
            onExport={() => void controller.exportMap()}
            onImport={(file) => void controller.importMap(file)}
          />
        )}
      </main>
    </div>
  );
}
