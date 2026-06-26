import { useEffect, useState } from "react";
import { findEdge, findEdgeById, findNode, getStationNodeIds, nodeIdEditPolicy } from "@agv/core";
import { useEditorStore } from "../../stores/editor-store";
import { useRouteStore } from "../../stores/route-store";
import { InspectorView } from "./InspectorView";

export function InspectorPanel() {
  const [includeReverseEdge, setIncludeReverseEdge] = useState(false);
  const map = useEditorStore((state) => state.map);
  const selection = useEditorStore((state) => state.selection);
  const routes = useRouteStore((state) => state.routes);
  const updateNode = useEditorStore((state) => state.updateNode);
  const updateEdge = useEditorStore((state) => state.updateEdge);
  const makeSelectedEdgeCurve = useEditorStore((state) => state.makeSelectedEdgeCurve);
  const resetSelectedEdgeCurve = useEditorStore((state) => state.resetSelectedEdgeCurve);
  const straightenSelectedEdge = useEditorStore((state) => state.straightenSelectedEdge);
  const bifurcateSelectedEdge = useEditorStore((state) => state.bifurcateSelectedEdge);
  const updateSelectedEdgeCurveHandle = useEditorStore((state) => state.updateSelectedEdgeCurveHandle);
  const node = selection?.type === "node" ? findNode(map, selection.id) : null;
  const edge = selection?.type === "edge" ? findEdgeById(map, selection.id) : null;
  const hasReverseEdge = Boolean(edge && findEdge(map, edge.to, edge.from));

  // ID edit policy is derived LIVE from the node's current relationships — no
  // persisted flag — so deleting all its edges returns it to the editable state.
  const idEditPolicy = node
    ? nodeIdEditPolicy({
        hasEdges: map.edges.some((item) => item.from === node.id || item.to === node.id),
        isStationReferenced: getStationNodeIds(map).has(node.id),
        isRouteReferenced: routes.some((route) => route.nodeIds.includes(node.id)),
      })
    : "editable";

  useEffect(() => {
    setIncludeReverseEdge(false);
  }, [edge?.id]);

  return (
    <InspectorView
      node={node || null}
      edge={edge || null}
      nodeIdEditPolicy={idEditPolicy}
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
