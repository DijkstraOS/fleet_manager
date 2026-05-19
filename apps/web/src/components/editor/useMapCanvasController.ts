import { useMemo, useRef, type PointerEvent } from "react";
import type { MapNode } from "@agv/core";
import { getBounds, screenToWorld } from "../../lib/geometry";
import { useEditorStore } from "../../stores/editor-store";
import { useFleetStore } from "../../stores/fleet-store";

export function useMapCanvasController() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const map = useEditorStore((state) => state.map);
  const tool = useEditorStore((state) => state.tool);
  const selection = useEditorStore((state) => state.selection);
  const edgeStartNodeId = useEditorStore((state) => state.edgeStartNodeId);
  const routeNodeIds = useEditorStore((state) => state.routeNodeIds);
  const agvs = useFleetStore((state) => state.agvs);
  const addNodeAt = useEditorStore((state) => state.addNodeAt);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const handleEdgeNode = useEditorStore((state) => state.handleEdgeNode);
  const addRouteNode = useEditorStore((state) => state.addRouteNode);
  const selectNode = useEditorStore((state) => state.selectNode);
  const selectEdge = useEditorStore((state) => state.selectEdge);
  const beginDragNode = useEditorStore((state) => state.beginDragNode);
  const dragNodeTo = useEditorStore((state) => state.dragNodeTo);
  const endDragNode = useEditorStore((state) => state.endDragNode);
  const bounds = useMemo(() => getBounds(map), [map]);

  return {
    svgRef,
    map,
    bounds,
    selection,
    edgeStartNodeId,
    routeNodeIds,
    agvs: Object.values(agvs),
    onCanvasPointerDown: (event: PointerEvent<SVGSVGElement>) => {
      if (event.target !== event.currentTarget) return;
      if (tool === "node" && svgRef.current) {
        const point = screenToWorld(svgRef.current, event.clientX, event.clientY);
        addNodeAt(point.x, point.y);
        return;
      }
      clearSelection();
    },
    onNodePointerDown: (event: PointerEvent<SVGGElement>, node: MapNode) => {
      event.stopPropagation();
      if (tool === "edge") {
        handleEdgeNode(node.id);
        return;
      }
      if (tool === "route") {
        addRouteNode(node.id);
        return;
      }
      selectNode(node.id);
      beginDragNode(node.id);
    },
    onEdgePointerDown: (event: PointerEvent<SVGGElement>, edgeId: string) => {
      event.stopPropagation();
      selectEdge(edgeId);
    },
    onCanvasPointerMove: (event: PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const point = screenToWorld(svgRef.current, event.clientX, event.clientY);
      dragNodeTo(point.x, point.y);
    },
    onCanvasPointerUp: endDragNode,
  };
}
