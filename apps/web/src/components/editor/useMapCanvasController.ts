import { useMemo, useRef, type PointerEvent, type WheelEvent } from "react";
import type { MapNode } from "@agv/core";
import { getBounds, panViewport, screenToWorld, screenToWorldRaw, zoomViewport, type CanvasBounds } from "../../lib/geometry";
import { useEditorStore, type EditorBackgroundImage } from "../../stores/editor-store";
import { useFleetStore } from "../../stores/fleet-store";
import { useRouteStore } from "../../stores/route-store";

interface PanState {
  clientX: number;
  clientY: number;
  viewport: CanvasBounds;
  moved: boolean;
}

interface BackgroundDragState {
  kind: "move" | "scale";
  origin: { x: number; y: number };
  backgroundImage: EditorBackgroundImage;
}

interface CurveDragState {
  edgeId: string;
}

export function useMapCanvasController() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panRef = useRef<PanState | null>(null);
  const backgroundDragRef = useRef<BackgroundDragState | null>(null);
  const curveDragRef = useRef<CurveDragState | null>(null);
  const map = useEditorStore((state) => state.map);
  const workspaceMode = useEditorStore((state) => state.workspaceMode);
  const tool = useEditorStore((state) => state.tool);
  const backgroundImage = useEditorStore((state) => state.backgroundImage);
  const selection = useEditorStore((state) => state.selection);
  const edgeStartNodeId = useEditorStore((state) => state.edgeStartNodeId);
  const viewportState = useEditorStore((state) => state.viewport);
  const agvs = useFleetStore((state) => state.agvs);
  const orderStatuses = useFleetStore((state) => state.orderStatuses);
  const routeNodeIds = useRouteStore((state) => state.draftNodeIds);
  const addDraftNode = useRouteStore((state) => state.addDraftNode);
  const routes = useRouteStore((state) => state.routes);
  const addNodeAt = useEditorStore((state) => state.addNodeAt);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const handleEdgeNode = useEditorStore((state) => state.handleEdgeNode);
  const selectNode = useEditorStore((state) => state.selectNode);
  const selectEdge = useEditorStore((state) => state.selectEdge);
  const beginDragNode = useEditorStore((state) => state.beginDragNode);
  const dragNodeTo = useEditorStore((state) => state.dragNodeTo);
  const endDragNode = useEditorStore((state) => state.endDragNode);
  const setViewport = useEditorStore((state) => state.setViewport);
  const updateBackgroundImage = useEditorStore((state) => state.updateBackgroundImage);
  const updateSelectedEdgeCurveHandle = useEditorStore((state) => state.updateSelectedEdgeCurveHandle);
  const fitBounds = useMemo(() => getBounds(map, backgroundImage), [map, backgroundImage]);
  const viewport = viewportState || fitBounds;
  const trackingRouteNodeIds = useMemo(() => {
    const activeStatus = Object.values(orderStatuses).find((status) => {
      const agv = agvs[status.serialNumber];
      return status.routeId && agv?.state?.driving;
    });
    if (!activeStatus?.routeId) return [];
    return routes.find((route) => route.id === activeStatus.routeId)?.nodeIds || [];
  }, [agvs, orderStatuses, routes]);
  const visibleRouteNodeIds = workspaceMode === "tracking" ? trackingRouteNodeIds : workspaceMode === "routes" ? routeNodeIds : [];

  function zoomAt(anchor: { x: number; y: number }, scale: number) {
    setViewport(zoomViewport(viewport, anchor, scale));
  }

  function zoomAroundCenter(scale: number) {
    zoomAt({ x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 }, scale);
  }

  return {
    svgRef,
    map,
    bounds: viewport,
    workspaceMode,
    tool,
    backgroundImage,
    selection,
    edgeStartNodeId,
    routeNodeIds: visibleRouteNodeIds,
    agvs: workspaceMode === "map" ? [] : Object.values(agvs),
    onCanvasPointerDown: (event: PointerEvent<SVGSVGElement>) => {
      if (event.target !== event.currentTarget) return;
      if (workspaceMode === "map" && tool === "node" && svgRef.current) {
        const point = screenToWorld(svgRef.current, event.clientX, event.clientY);
        addNodeAt(point.x, point.y);
        return;
      }
      panRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        viewport,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onNodePointerDown: (event: PointerEvent<SVGGElement>, node: MapNode) => {
      event.stopPropagation();
      if (workspaceMode === "tracking") return;
      if (workspaceMode === "routes") {
        addDraftNode(map, node.id);
        return;
      }
      if (tool === "edge") {
        handleEdgeNode(node.id);
        return;
      }
      selectNode(node.id);
      if (tool === "select") beginDragNode(node.id);
    },
    onEdgePointerDown: (event: PointerEvent<SVGGElement>, edgeId: string) => {
      event.stopPropagation();
      if (workspaceMode !== "map") return;
      selectEdge(edgeId);
    },
    onCanvasPointerMove: (event: PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      if (curveDragRef.current) {
        const point = screenToWorld(svgRef.current, event.clientX, event.clientY);
        updateSelectedEdgeCurveHandle(point.x, point.y);
        return;
      }
      if (backgroundDragRef.current) {
        const point = screenToWorldRaw(svgRef.current, event.clientX, event.clientY);
        const drag = backgroundDragRef.current;
        if (drag.kind === "move") {
          updateBackgroundImage((backgroundImage) => ({
            ...backgroundImage,
            x: drag.backgroundImage.x + point.x - drag.origin.x,
            y: drag.backgroundImage.y + point.y - drag.origin.y,
          }));
        } else {
          const scale = Math.max(
            0.05,
            Math.max(
              (point.x - drag.backgroundImage.x) / drag.backgroundImage.width,
              (point.y - drag.backgroundImage.y) / drag.backgroundImage.height
            )
          );
          updateBackgroundImage((backgroundImage) => ({
            ...backgroundImage,
            width: drag.backgroundImage.width * scale,
            height: drag.backgroundImage.height * scale,
          }));
        }
        return;
      }
      const point = screenToWorld(svgRef.current, event.clientX, event.clientY);
      dragNodeTo(point.x, point.y);
      if (panRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const deltaX = -((event.clientX - panRef.current.clientX) * panRef.current.viewport.width) / rect.width;
        const deltaY = -((event.clientY - panRef.current.clientY) * panRef.current.viewport.height) / rect.height;
        if (Math.abs(event.clientX - panRef.current.clientX) > 2 || Math.abs(event.clientY - panRef.current.clientY) > 2) {
          panRef.current.moved = true;
        }
        setViewport(panViewport(panRef.current.viewport, deltaX, deltaY));
      }
    },
    onCanvasPointerUp: (event: PointerEvent<SVGSVGElement>) => {
      if (panRef.current && !panRef.current.moved && workspaceMode === "map" && tool === "select") {
        clearSelection();
      }
      panRef.current = null;
      backgroundDragRef.current = null;
      curveDragRef.current = null;
      endDragNode();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onBackgroundPointerDown: (event: PointerEvent<SVGGElement>, backgroundImage: EditorBackgroundImage) => {
      event.stopPropagation();
      if (workspaceMode !== "map" || tool !== "background" || backgroundImage.locked || !svgRef.current) return;
      backgroundDragRef.current = {
        kind: "move",
        origin: screenToWorldRaw(svgRef.current, event.clientX, event.clientY),
        backgroundImage,
      };
      svgRef.current.setPointerCapture(event.pointerId);
    },
    onBackgroundScalePointerDown: (event: PointerEvent<SVGRectElement>, backgroundImage: EditorBackgroundImage) => {
      event.stopPropagation();
      if (workspaceMode !== "map" || tool !== "background" || backgroundImage.locked || !svgRef.current) return;
      backgroundDragRef.current = {
        kind: "scale",
        origin: screenToWorldRaw(svgRef.current, event.clientX, event.clientY),
        backgroundImage,
      };
      svgRef.current.setPointerCapture(event.pointerId);
    },
    onCurveHandlePointerDown: (event: PointerEvent<SVGCircleElement>, edgeId: string) => {
      event.stopPropagation();
      if (workspaceMode !== "map" || !svgRef.current) return;
      selectEdge(edgeId);
      curveDragRef.current = { edgeId };
      svgRef.current.setPointerCapture(event.pointerId);
    },
    onCanvasWheel: (event: WheelEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      event.preventDefault();
      const anchor = screenToWorld(svgRef.current, event.clientX, event.clientY);
      zoomAt(anchor, event.deltaY < 0 ? 0.85 : 1.18);
    },
    onZoomIn: () => zoomAroundCenter(0.85),
    onZoomOut: () => zoomAroundCenter(1.18),
    onResetView: () => setViewport(null),
  };
}
