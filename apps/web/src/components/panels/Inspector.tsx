import { useEditorStore } from "../../stores/editor-store";
import { InspectorView } from "./InspectorView";

export function InspectorPanel() {
  const map = useEditorStore((state) => state.map);
  const selection = useEditorStore((state) => state.selection);
  const updateNode = useEditorStore((state) => state.updateNode);
  const updateEdge = useEditorStore((state) => state.updateEdge);
  const makeSelectedEdgeCurve = useEditorStore((state) => state.makeSelectedEdgeCurve);
  const resetSelectedEdgeCurve = useEditorStore((state) => state.resetSelectedEdgeCurve);
  const straightenSelectedEdge = useEditorStore((state) => state.straightenSelectedEdge);
  const updateSelectedEdgeCurveHandle = useEditorStore((state) => state.updateSelectedEdgeCurveHandle);
  const node = selection?.type === "node" ? map.nodes.find((item) => item.id === selection.id) : null;
  const edge = selection?.type === "edge" ? map.edges.find((item) => item.id === selection.id) : null;

  return (
    <InspectorView
      node={node || null}
      edge={edge || null}
      onChangeNode={updateNode}
      onChangeEdge={updateEdge}
      onMakeEdgeCurve={makeSelectedEdgeCurve}
      onResetEdgeCurve={resetSelectedEdgeCurve}
      onStraightenEdge={straightenSelectedEdge}
      onChangeCurveHandle={updateSelectedEdgeCurveHandle}
    />
  );
}
