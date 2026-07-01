import { findEdge, findEdgeById } from "@agv/core";
import { useEditorStore } from "../../stores/editor-store";
import { useRenderTally } from "../../lib/render-tally";
import { FloatingCard } from "./FloatingCard";
import { InspectorPanel } from "./Inspector";
import { MapInspectorCardView } from "./MapInspectorCardView";

export function MapInspectorCard() {
  useRenderTally("MapInspectorCard");
  const selection = useEditorStore((state) => state.selection);
  const map = useEditorStore((state) => state.map);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const addReverseEdgeForSelection = useEditorStore((state) => state.addReverseEdgeForSelection);

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
