import { useEditorStore } from "../../stores/editor-store";
import { useRenderTally } from "../../lib/render-tally";
import { TopBarView } from "./TopBarView";

export function TopBar() {
  useRenderTally("TopBar");
  const mapName = useEditorStore((state) => state.map.name);
  const workspaceMode = useEditorStore((state) => state.workspaceMode);
  const renameMap = useEditorStore((state) => state.renameMap);
  const setWorkspaceMode = useEditorStore((state) => state.setWorkspaceMode);

  return (
    <TopBarView
      mapName={mapName}
      workspaceMode={workspaceMode}
      onRenameMap={renameMap}
      onSetWorkspaceMode={setWorkspaceMode}
    />
  );
}
