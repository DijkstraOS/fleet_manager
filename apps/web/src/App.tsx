import { MapCanvas } from "./components/editor/MapCanvas";
import { LeftPanel, RightPanel } from "./components/panels/SidePanels";
import { TopBar } from "./components/toolbar/TopBar";
import { useAppController } from "./hooks/useAppController";

export default function App() {
  const controller = useAppController();

  return (
    <div className="app-shell">
      <TopBar
        mapName={controller.mapName}
        tool={controller.tool}
        canSendOrder={controller.canSendOrder}
        onRenameMap={controller.renameMap}
        onSetTool={controller.setTool}
        onDeleteSelection={controller.deleteSelection}
        onSave={() => void controller.save()}
        onExport={() => void controller.exportMap()}
        onImport={(file) => void controller.importMap(file)}
        onSendOrder={() => void controller.sendOrder()}
      />
      <main className="workspace">
        <LeftPanel />
        <MapCanvas />
        <RightPanel />
      </main>
    </div>
  );
}
