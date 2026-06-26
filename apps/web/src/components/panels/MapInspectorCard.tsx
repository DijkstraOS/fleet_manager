import { findEdge, findEdgeById } from "@agv/core";
import { useEditorStore } from "../../stores/editor-store";
import { FloatingCard } from "./FloatingCard";
import { InspectorPanel } from "./Inspector";
import { MapInspectorCardView } from "./MapInspectorCardView";

/**
 * Right-zone container for the Map tab. Mounts the floating Inspector card while a node
 * or edge is selected and collapses to nothing when the selection clears. The card is an
 * absolute overlay over the map's right edge, so mounting it never reflows the canvas.
 */
export function MapInspectorCard() {
  const selection = useEditorStore((state) => state.selection);
  const map = useEditorStore((state) => state.map);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const addReverseEdgeForSelection = useEditorStore((state) => state.addReverseEdgeForSelection);

  // When the selected edge already has a reverse twin, the command selects it instead of
  // adding a duplicate (see addReverseEdgeForSelection), so label the button accordingly.
  const selectedEdge = selection?.type === "edge" ? findEdgeById(map, selection.id) : undefined;
  const hasReverseEdge = Boolean(selectedEdge && findEdge(map, selectedEdge.to, selectedEdge.from));

  return (
    <FloatingCard open={selection !== null}>
      <MapInspectorCardView
        inspector={<InspectorPanel />}
        canAddReverseEdge={selection?.type === "edge"}
        hasReverseEdge={hasReverseEdge}
        onDeleteSelection={deleteSelection}
        onAddReverseEdge={addReverseEdgeForSelection}
      />
    </FloatingCard>
  );
}
