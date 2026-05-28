import { useEffect, useState } from "react";
import { findEdge } from "@agv/core";
import { useEditorStore } from "../../stores/editor-store";
import { InspectorView } from "./InspectorView";

export function InspectorPanel() {
  const [includeReverseEdge, setIncludeReverseEdge] = useState(false);
  const map = useEditorStore((state) => state.map);
  const selection = useEditorStore((state) => state.selection);
  const updateNode = useEditorStore((state) => state.updateNode);
  const updateEdge = useEditorStore((state) => state.updateEdge);
  const makeSelectedEdgeCurve = useEditorStore((state) => state.makeSelectedEdgeCurve);
  const resetSelectedEdgeCurve = useEditorStore((state) => state.resetSelectedEdgeCurve);
  const straightenSelectedEdge = useEditorStore((state) => state.straightenSelectedEdge);
  const bifurcateSelectedEdge = useEditorStore((state) => state.bifurcateSelectedEdge);
  const updateSelectedEdgeCurveHandle = useEditorStore((state) => state.updateSelectedEdgeCurveHandle);
  const node = selection?.type === "node" ? map.nodes.find((item) => item.id === selection.id) : null;
  const edge = selection?.type === "edge" ? map.edges.find((item) => item.id === selection.id) : null;
  const hasReverseEdge = Boolean(edge && findEdge(map, edge.to, edge.from));

  useEffect(() => {
    setIncludeReverseEdge(false);
  }, [edge?.id]);

  return (
    <InspectorView
      node={node || null}
      edge={edge || null}
      onChangeNode={updateNode}
      onChangeEdge={updateEdge}
      onMakeEdgeCurve={() => makeSelectedEdgeCurve({ includeReverse: hasReverseEdge && includeReverseEdge })}
      onResetEdgeCurve={() => resetSelectedEdgeCurve({ includeReverse: hasReverseEdge && includeReverseEdge })}
      onStraightenEdge={() => straightenSelectedEdge({ includeReverse: hasReverseEdge && includeReverseEdge })}
      hasReverseEdge={hasReverseEdge}
      includeReverseEdge={includeReverseEdge}
      onIncludeReverseEdgeChange={setIncludeReverseEdge}
      onBifurcateEdge={() => bifurcateSelectedEdge({ includeReverse: hasReverseEdge && includeReverseEdge })}
      onChangeCurveHandle={(x, y) => updateSelectedEdgeCurveHandle(x, y, { includeReverse: hasReverseEdge && includeReverseEdge })}
    />
  );
}
