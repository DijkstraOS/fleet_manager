import { useMapCommands } from "../../hooks/useMapCommands";
import { useEditorStore } from "../../stores/editor-store";
import { InspectorPanel } from "./Inspector";
import { MapCommandPanelView } from "./MapCommandPanelView";

export function MapCommandPanel() {
  const tool = useEditorStore((state) => state.tool);
  const selection = useEditorStore((state) => state.selection);
  const backgroundImage = useEditorStore((state) => state.backgroundImage);
  const setTool = useEditorStore((state) => state.setTool);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const addReverseEdgeForSelection = useEditorStore((state) => state.addReverseEdgeForSelection);
  const setBackgroundImageOpacity = useEditorStore((state) => state.setBackgroundImageOpacity);
  const setBackgroundImageLocked = useEditorStore((state) => state.setBackgroundImageLocked);
  const fitBackgroundImageToMap = useEditorStore((state) => state.fitBackgroundImageToMap);
  const removeBackgroundImage = useEditorStore((state) => state.removeBackgroundImage);
  const { saveMap, exportMap, importMap, uploadBackground } = useMapCommands();

  return (
    <MapCommandPanelView
      tool={tool}
      selection={selection}
      backgroundImage={backgroundImage}
      canAddReverseEdge={selection?.type === "edge"}
      inspector={<InspectorPanel />}
      onSetTool={setTool}
      onDeleteSelection={deleteSelection}
      onAddReverseEdge={addReverseEdgeForSelection}
      onSave={() => void saveMap()}
      onExport={() => void exportMap()}
      onImport={(file) => void importMap(file)}
      onUploadBackground={(file) => void uploadBackground(file)}
      onSetBackgroundOpacity={setBackgroundImageOpacity}
      onFitBackground={fitBackgroundImageToMap}
      onSetBackgroundLocked={setBackgroundImageLocked}
      onRemoveBackground={removeBackgroundImage}
    />
  );
}
