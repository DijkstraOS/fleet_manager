import { useMapCommands } from "../../hooks/useMapCommands";
import { useEditorStore } from "../../stores/editor-store";
import { MapLeftPanelView } from "./MapLeftPanelView";

export function MapLeftPanel() {
  const tool = useEditorStore((state) => state.tool);
  const backgroundImage = useEditorStore((state) => state.backgroundImage);
  const setTool = useEditorStore((state) => state.setTool);
  const setBackgroundImageOpacity = useEditorStore((state) => state.setBackgroundImageOpacity);
  const setBackgroundImageLocked = useEditorStore((state) => state.setBackgroundImageLocked);
  const fitBackgroundImageToMap = useEditorStore((state) => state.fitBackgroundImageToMap);
  const removeBackgroundImage = useEditorStore((state) => state.removeBackgroundImage);
  const { saveMap, exportMap, importMap, uploadBackground } = useMapCommands();

  return (
    <MapLeftPanelView
      tool={tool}
      backgroundImage={backgroundImage}
      onSetTool={setTool}
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
