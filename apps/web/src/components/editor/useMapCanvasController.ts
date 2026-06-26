import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import { fitViewportToContent, gridStepForViewport, type MapNode } from "@agv/core";
import { panViewport, screenToWorld, screenToWorldRaw, wheelZoomScale, zoomViewport, type CanvasBounds } from "../../lib/geometry";
import { useEditorStore } from "../../stores/editor-store";
import { useFleetStore } from "../../stores/fleet-store";
import { useRouteStore } from "../../stores/route-store";

interface PanState {
  clientX: number;
  clientY: number;
  viewport: CanvasBounds;
  moved: boolean;
}

interface CurveDragState {
  edgeId: string;
}

export function useMapCanvasController() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panRef = useRef<PanState | null>(null);
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
  const updateSelectedEdgeCurveHandle = useEditorStore((state) => state.updateSelectedEdgeCurveHandle);
  // The viewBox aspect must match the SVG's pixel aspect so the floor renders
  // square-on-square without stretching; fall back to the floor aspect before the
  // element is mounted (first render) or measurable.
  function viewportAspect(): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) return rect.width / rect.height;
    return map.canvas.width / map.canvas.height;
  }
  const fitBounds = useMemo(
    () => fitViewportToContent(map, map.canvas.width / map.canvas.height),
    [map],
  );
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
    setViewport(zoomViewport(viewport, anchor, scale, map.canvas));
  }

  function zoomAroundCenter(scale: number) {
    zoomAt({ x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 }, scale);
  }

  // Wheel zoom is attached as a native, non-passive listener. React routes its
  // onWheel prop through a passive listener, so event.preventDefault() there is
  // a no-op and the browser's own scroll / pinch-zoom runs on top of ours. The
  // ref keeps the DOM listener stable while always seeing the latest viewport.
  const wheelHandlerRef = useRef<(event: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelHandlerRef.current = (event) => {
      if (!svgRef.current) return;
      event.preventDefault();
      const anchor = screenToWorldRaw(svgRef.current, event.clientX, event.clientY);
      setViewport(zoomViewport(viewport, anchor, wheelZoomScale(event), map.canvas));
    };
  });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const listener = (event: WheelEvent) => wheelHandlerRef.current(event);
    svg.addEventListener("wheel", listener, { passive: false });
    return () => svg.removeEventListener("wheel", listener);
  }, []);

  return {
    svgRef,
    map,
    bounds: viewport,
    canvas: map.canvas,
    gridStep: gridStepForViewport(viewport.width),
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
      const point = screenToWorld(svgRef.current, event.clientX, event.clientY);
      dragNodeTo(point.x, point.y);
      if (panRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const deltaX = -((event.clientX - panRef.current.clientX) * panRef.current.viewport.width) / rect.width;
        const deltaY = -((event.clientY - panRef.current.clientY) * panRef.current.viewport.height) / rect.height;
        if (Math.abs(event.clientX - panRef.current.clientX) > 2 || Math.abs(event.clientY - panRef.current.clientY) > 2) {
          panRef.current.moved = true;
        }
        setViewport(panViewport(panRef.current.viewport, deltaX, deltaY, map.canvas));
      }
    },
    onCanvasPointerUp: (event: PointerEvent<SVGSVGElement>) => {
      if (panRef.current && !panRef.current.moved && workspaceMode === "map" && tool === "select") {
        clearSelection();
      }
      panRef.current = null;
      curveDragRef.current = null;
      endDragNode();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onCurveHandlePointerDown: (event: PointerEvent<SVGCircleElement>, edgeId: string) => {
      event.stopPropagation();
      if (workspaceMode !== "map" || !svgRef.current) return;
      selectEdge(edgeId);
      curveDragRef.current = { edgeId };
      svgRef.current.setPointerCapture(event.pointerId);
    },
    onZoomIn: () => zoomAroundCenter(0.85),
    onZoomOut: () => zoomAroundCenter(1.18),
    // Reset to the default view (fit-to-content for a populated map, empty-floor
    // center otherwise), measured against the real SVG aspect and floor-clamped.
    onResetView: () => setViewport(fitViewportToContent(map, viewportAspect())),
  };
}
