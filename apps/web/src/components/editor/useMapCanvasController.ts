import { useCallback, useEffect, useMemo, useRef, type PointerEvent } from "react";
import { fitViewportToContent, gridStepForViewport, buildMapIndex, type MapNode } from "@agv/core";
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

// Do NOT inline `[]`: a fresh array each render breaks StaticGraph's React.memo every pan/zoom frame.
const EMPTY_ROUTE_NODE_IDS: string[] = [];

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
  const routeNodeIds = useRouteStore((state) => state.draftNodeIds);
  const routes = useRouteStore((state) => state.routes);
  const addNodeAt = useEditorStore((state) => state.addNodeAt);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const dragNodeTo = useEditorStore((state) => state.dragNodeTo);
  const endDragNode = useEditorStore((state) => state.endDragNode);
  const setViewport = useEditorStore((state) => state.setViewport);
  const updateSelectedEdgeCurveHandle = useEditorStore((state) => state.updateSelectedEdgeCurveHandle);

  const onNodePointerDown = useCallback((event: PointerEvent<SVGGElement>, node: MapNode) => {
    event.stopPropagation();
    const editor = useEditorStore.getState();
    if (editor.workspaceMode === "tracking") return;
    if (editor.workspaceMode === "routes") {
      useRouteStore.getState().addDraftNode(editor.map, node.id);
      return;
    }
    if (editor.tool === "edge") {
      editor.handleEdgeNode(node.id);
      return;
    }
    editor.selectNode(node.id);
    if (editor.tool === "select") editor.beginDragNode(node.id);
  }, []);
  const onEdgePointerDown = useCallback((event: PointerEvent<SVGGElement>, edgeId: string) => {
    event.stopPropagation();
    const editor = useEditorStore.getState();
    if (editor.workspaceMode !== "map") return;
    editor.selectEdge(edgeId);
  }, []);
  const onCurveHandlePointerDown = useCallback((event: PointerEvent<SVGCircleElement>, edgeId: string) => {
    event.stopPropagation();
    const editor = useEditorStore.getState();
    if (editor.workspaceMode !== "map" || !svgRef.current) return;
    editor.selectEdge(edgeId);
    curveDragRef.current = { edgeId };
    svgRef.current.setPointerCapture(event.pointerId);
  }, []);
  // viewBox aspect must equal the SVG's pixel aspect or the floor stretches; floor aspect is the fallback until the element is measurable.
  function viewportAspect(): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) return rect.width / rect.height;
    return map.canvas.width / map.canvas.height;
  }
  const fitBounds = useMemo(
    () => fitViewportToContent(map, map.canvas.width / map.canvas.height),
    [map],
  );
  const mapIndex = useMemo(() => buildMapIndex(map), [map]);
  const viewport = viewportState || fitBounds;
  const activeRouteId = useFleetStore((state) => {
    if (workspaceMode !== "tracking") return null;
    const activeStatus = Object.values(state.orderStatuses).find(
      (status) => status.routeId && state.agvs[status.serialNumber]?.state?.driving,
    );
    return activeStatus?.routeId ?? null;
  });
  const trackingRouteNodeIds = useMemo(
    () => (activeRouteId ? routes.find((route) => route.id === activeRouteId)?.nodeIds || [] : []),
    [activeRouteId, routes],
  );
  const visibleRouteNodeIds = workspaceMode === "tracking" ? trackingRouteNodeIds : workspaceMode === "routes" ? routeNodeIds : EMPTY_ROUTE_NODE_IDS;

  function zoomAt(anchor: { x: number; y: number }, scale: number) {
    setViewport(zoomViewport(viewport, anchor, scale, map.canvas));
  }

  function zoomAroundCenter(scale: number) {
    zoomAt({ x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 }, scale);
  }

  // Native non-passive listener: React's onWheel is passive, so preventDefault() there is a no-op.
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
    index: mapIndex,
    bounds: viewport,
    canvas: map.canvas,
    gridStep: gridStepForViewport(viewport.width),
    workspaceMode,
    backgroundImage,
    selection,
    edgeStartNodeId,
    routeNodeIds: visibleRouteNodeIds,
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
    onNodePointerDown,
    onEdgePointerDown,
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
    onCurveHandlePointerDown,
    onZoomIn: () => zoomAroundCenter(0.85),
    onZoomOut: () => zoomAroundCenter(1.18),
    onResetView: () => setViewport(fitViewportToContent(map, viewportAspect())),
  };
}
