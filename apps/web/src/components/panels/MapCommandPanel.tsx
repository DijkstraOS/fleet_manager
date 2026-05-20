import { useMapCommands } from "../../hooks/useMapCommands";
import { useEditorStore } from "../../stores/editor-store";
import { InspectorPanel } from "./Inspector";
import { MapCommandPanelView } from "./MapCommandPanelView";

export function MapCommandPanel() {
  const tool = useEditorStore((state) => state.tool);
  const selection = useEditorStore((state) => state.selection);
  const setTool = useEditorStore((state) => state.setTool);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const addReverseEdgeForSelection = useEditorStore((state) => state.addReverseEdgeForSelection);
  const { saveMap, exportMap, importMap } = useMapCommands();

  return (
    <MapCommandPanelView
      tool={tool}
      selection={selection}
      canAddReverseEdge={selection?.type === "edge"}
      inspector={<InspectorPanel />}
      onSetTool={setTool}
      onDeleteSelection={deleteSelection}
      onAddReverseEdge={addReverseEdgeForSelection}
      onSave={() => void saveMap()}
      onExport={() => void exportMap()}
      onImport={(file) => void importMap(file)}
    />
  );
}
