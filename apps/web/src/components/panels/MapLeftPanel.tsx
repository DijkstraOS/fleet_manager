import { useMapCommands } from "../../hooks/useMapCommands";
import { useEditorStore } from "../../stores/editor-store";
import { MapLeftPanelView } from "./MapLeftPanelView";

export function MapLeftPanel() {
  const tool = useEditorStore((state) => state.tool);
  const backgroundImage = useEditorStore((state) => state.backgroundImage);
  const canvas = useEditorStore((state) => state.map.canvas);
  const heightAspectLocked = useEditorStore((state) => state.heightAspectLocked);
  const setTool = useEditorStore((state) => state.setTool);
  const setBackgroundImageOpacity = useEditorStore((state) => state.setBackgroundImageOpacity);
  const removeBackgroundImage = useEditorStore((state) => state.removeBackgroundImage);
  const setCanvasWidth = useEditorStore((state) => state.setCanvasWidth);
  const setCanvasHeight = useEditorStore((state) => state.setCanvasHeight);
  const setHeightAspectLocked = useEditorStore((state) => state.setHeightAspectLocked);
  const { saveMap, exportMap, importMap, uploadBackground } = useMapCommands();

  return (
    <MapLeftPanelView
      tool={tool}
      backgroundImage={backgroundImage}
      canvas={canvas}
      heightAspectLocked={heightAspectLocked}
      onSetTool={setTool}
      onSave={() => void saveMap()}
      onExport={() => void exportMap()}
      onImport={(file) => void importMap(file)}
      onUploadBackground={(file) => void uploadBackground(file)}
      onSetBackgroundOpacity={setBackgroundImageOpacity}
      onRemoveBackground={removeBackgroundImage}
      onSetCanvasWidth={setCanvasWidth}
      onSetCanvasHeight={setCanvasHeight}
      onSetHeightAspectLocked={setHeightAspectLocked}
    />
  );
}
