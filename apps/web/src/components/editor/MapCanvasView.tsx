import type { PointerEvent, RefObject } from "react";
import {
  getActionNodeIds,
  getQuadraticBezierHandle,
  isSupportedQuadraticBezier,
  quadraticBezierSvgPath,
  type MapDocument,
  type MapEdge,
  type MapNode,
  type VdaState,
  type VdaVisualization,
} from "@agv/core";
import { LocateFixed, Minus, Plus } from "lucide-react";
import {
  GRID,
  SUPPORT_NODE_HIT_RADIUS,
  nodeRenderRadius,
  routeContainsEdge,
  type CanvasBounds,
} from "../../lib/geometry";
import type { EditorBackgroundImage, Selection, Tool, WorkspaceMode } from "../../types";

export interface CanvasAgv {
  serialNumber: string;
  state: VdaState | null;
  visualization: VdaVisualization | null;
}

export interface MapCanvasViewProps {
  svgRef: RefObject<SVGSVGElement | null>;
  map: MapDocument;
  bounds: CanvasBounds;
  workspaceMode: WorkspaceMode;
  tool: Tool;
  backgroundImage: EditorBackgroundImage | null;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  agvs: CanvasAgv[];
  onCanvasPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onCanvasPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onCanvasPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
  onBackgroundPointerDown: (event: PointerEvent<SVGGElement>, backgroundImage: EditorBackgroundImage) => void;
  onBackgroundScalePointerDown: (event: PointerEvent<SVGRectElement>, backgroundImage: EditorBackgroundImage) => void;
  onCurveHandlePointerDown: (event: PointerEvent<SVGCircleElement>, edgeId: string) => void;
  onNodePointerDown: (event: PointerEvent<SVGGElement>, node: MapNode) => void;
  onEdgePointerDown: (event: PointerEvent<SVGGElement>, edgeId: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function MapCanvasView(props: MapCanvasViewProps) {
  return (
    <section className="map-stage">
      <svg
        ref={props.svgRef}
        className="map-svg"
        viewBox={`${props.bounds.x} ${props.bounds.y} ${props.bounds.width} ${props.bounds.height}`}
        onPointerDown={props.onCanvasPointerDown}
        onPointerMove={props.onCanvasPointerMove}
        onPointerUp={props.onCanvasPointerUp}
        onPointerLeave={props.onCanvasPointerUp}
      >
        <CanvasDefs />
        <BaseLayer bounds={props.bounds} />
        <BackgroundImageLayer
          backgroundImage={props.backgroundImage}
          active={props.workspaceMode === "map" && props.tool === "background"}
          onBackgroundPointerDown={props.onBackgroundPointerDown}
          onBackgroundScalePointerDown={props.onBackgroundScalePointerDown}
        />
        <GridLayer bounds={props.bounds} />
        <EdgeLayer
          map={props.map}
          selection={props.selection}
          routeNodeIds={props.routeNodeIds}
          workspaceMode={props.workspaceMode}
          onEdgePointerDown={props.onEdgePointerDown}
        />
        <CurveHandleLayer
          edges={props.map.edges}
          selection={props.selection}
          workspaceMode={props.workspaceMode}
          onCurveHandlePointerDown={props.onCurveHandlePointerDown}
        />
        <NodeLayer
          map={props.map}
          bounds={props.bounds}
          selection={props.selection}
          edgeStartNodeId={props.edgeStartNodeId}
          routeNodeIds={props.routeNodeIds}
          workspaceMode={props.workspaceMode}
          onNodePointerDown={props.onNodePointerDown}
        />
        <AgvOverlayLayer agvs={props.agvs} />
      </svg>
      <div className="canvas-controls" aria-label="Canvas zoom controls">
        <button type="button" className="icon-button" title="Zoom in" onClick={props.onZoomIn}><Plus /></button>
        <button type="button" className="icon-button" title="Zoom out" onClick={props.onZoomOut}><Minus /></button>
        <button type="button" className="icon-button" title="Reset view" onClick={props.onResetView}><LocateFixed /></button>
      </div>
    </section>
  );
}

function CanvasDefs() {
  return (
    <defs>
      <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
        <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#d7dee8" strokeWidth="0.015" />
      </pattern>
      {/* Slim directional cue, same slate as the .edge stroke so the head reads as part
          of the line. refX=10 (the viewBox tip) lands the arrow tip at the path end —
          the target node center — so the head sits at the node rather than overshooting. */}
      <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#475569" />
      </marker>
    </defs>
  );
}

function BaseLayer(props: { bounds: CanvasBounds }) {
  return (
    <g pointerEvents="none">
      <rect x={props.bounds.x} y={props.bounds.y} width={props.bounds.width} height={props.bounds.height} fill="#f8fafc" />
    </g>
  );
}

function GridLayer(props: { bounds: CanvasBounds }) {
  return (
    <g pointerEvents="none">
      <rect x={props.bounds.x} y={props.bounds.y} width={props.bounds.width} height={props.bounds.height} fill="url(#grid)" />
    </g>
  );
}

function BackgroundImageLayer(props: {
  backgroundImage: EditorBackgroundImage | null;
  active: boolean;
  onBackgroundPointerDown: (event: PointerEvent<SVGGElement>, backgroundImage: EditorBackgroundImage) => void;
  onBackgroundScalePointerDown: (event: PointerEvent<SVGRectElement>, backgroundImage: EditorBackgroundImage) => void;
}) {
  const backgroundImage = props.backgroundImage;
  if (!backgroundImage) return null;
  const editable = props.active && !backgroundImage.locked;
  const handleSize = Math.max(0.35, Math.min(backgroundImage.width, backgroundImage.height) * 0.035);

  return (
    <g
      className={editable ? "background-layer editable" : "background-layer"}
      pointerEvents={editable ? "auto" : "none"}
      onPointerDown={(event) => props.onBackgroundPointerDown(event, backgroundImage)}
    >
      <image
        href={backgroundImage.src}
        x={backgroundImage.x}
        y={backgroundImage.y}
        width={backgroundImage.width}
        height={backgroundImage.height}
        opacity={backgroundImage.opacity}
        preserveAspectRatio="none"
        className="background-image"
      />
      {props.active && (
        <rect
          x={backgroundImage.x}
          y={backgroundImage.y}
          width={backgroundImage.width}
          height={backgroundImage.height}
          className={backgroundImage.locked ? "background-frame locked" : "background-frame"}
          pointerEvents="none"
        />
      )}
      {editable && (
        <rect
          x={backgroundImage.x + backgroundImage.width - handleSize / 2}
          y={backgroundImage.y + backgroundImage.height - handleSize / 2}
          width={handleSize}
          height={handleSize}
          rx={handleSize * 0.18}
          className="background-scale-handle"
          onPointerDown={(event) => props.onBackgroundScalePointerDown(event, backgroundImage)}
        />
      )}
    </g>
  );
}

function EdgeLayer(props: {
  map: MapDocument;
  selection: Selection;
  routeNodeIds: string[];
  workspaceMode: WorkspaceMode;
  onEdgePointerDown: (event: PointerEvent<SVGGElement>, edgeId: string) => void;
}) {
  const edges = props.map.edges;
  const nodes = props.map.nodes;
  return (
    <>
      {edges.map((edge) => {
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        if (!from || !to) return null;
        const active = props.selection?.type === "edge" && props.selection.id === edge.id;
        const routeActive = routeContainsEdge(props.routeNodeIds, edge.from, edge.to);
        const className = edgeClass(active, routeActive, props.workspaceMode);
        // Edges run as one continuous line from source node center to target node
        // center: curved edges use the full Bézier path, straight edges draw raw
        // from->to. Forward and reverse twins intentionally overlap on the same line.
        const pathData = quadraticBezierSvgPath(edge.trajectory);
        return (
          <g key={edge.id} onPointerDown={(event) => props.onEdgePointerDown(event, edge.id)}>
            {pathData ? (
              <path d={pathData} className={className} markerEnd="url(#arrow)" fill="none" />
            ) : (
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={className}
                markerEnd="url(#arrow)"
              />
            )}
          </g>
        );
      })}
    </>
  );
}

function CurveHandleLayer(props: {
  edges: MapEdge[];
  selection: Selection;
  workspaceMode: WorkspaceMode;
  onCurveHandlePointerDown: (event: PointerEvent<SVGCircleElement>, edgeId: string) => void;
}) {
  if (props.workspaceMode !== "map" || props.selection?.type !== "edge") return null;
  const edge = props.edges.find((item) => item.id === props.selection?.id);
  if (!edge || !isSupportedQuadraticBezier(edge.trajectory)) return null;
  const handle = getQuadraticBezierHandle(edge.trajectory);
  if (!handle) return null;
  return (
    <g className="curve-handle-layer">
      <circle
        className="curve-handle"
        cx={handle.x}
        cy={handle.y}
        r="0.23"
        onPointerDown={(event) => props.onCurveHandlePointerDown(event, edge.id)}
      />
    </g>
  );
}

function AgvOverlayLayer(props: { agvs: CanvasAgv[] }) {
  return (
    <g className="agv-layer" pointerEvents="none">
      {props.agvs.map((agv) => {
        const pos = agv.visualization?.agvPosition || agv.state?.agvPosition;
        if (!pos) return null;
        return (
          <g className="agv-marker" key={agv.serialNumber} transform={`translate(${pos.x} ${pos.y}) rotate(${(pos.theta * 180) / Math.PI})`}>
            <rect x="-0.35" y="-0.22" width="0.7" height="0.44" rx="0.07" className="agv-body" />
            <path d="M 0.35 0 L 0.58 0.16 L 0.58 -0.16 z" className="agv-nose" />
            <text className="agv-label" x="-0.45" y="-0.45">{agv.serialNumber}</text>
          </g>
        );
      })}
    </g>
  );
}

function NodeLayer(props: {
  map: MapDocument;
  bounds: CanvasBounds;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  workspaceMode: WorkspaceMode;
  onNodePointerDown: (event: PointerEvent<SVGGElement>, node: MapNode) => void;
}) {
  // Action/station nodes (derived from preserved LIF data) stay hefty; pure
  // path-support nodes shrink to a small dot floored against the current zoom.
  const actionNodeIds = getActionNodeIds(props.map);
  return (
    <>
      {props.map.nodes.map((node) => {
        const isAction = actionNodeIds.has(node.id);
        const radius = nodeRenderRadius(isAction, props.bounds.width);
        return (
          <g key={node.id} onPointerDown={(event) => props.onNodePointerDown(event, node)}>
            {!isAction && (
              <circle className="node-hit" cx={node.x} cy={node.y} r={SUPPORT_NODE_HIT_RADIUS} />
            )}
            <circle className={nodeClass(node.id, props.selection, props.edgeStartNodeId, props.routeNodeIds, props.workspaceMode)} cx={node.x} cy={node.y} r={radius} />
            <text className="node-label" x={node.x + 0.35} y={node.y - 0.35}>{node.label || node.id}</text>
          </g>
        );
      })}
    </>
  );
}

function edgeClass(active: boolean, routeActive: boolean, workspaceMode: WorkspaceMode) {
  const classes = ["edge"];
  if (workspaceMode !== "map") classes.push("subtle");
  if (active) classes.push("active");
  if (routeActive) classes.push("route");
  return classes.join(" ");
}

function nodeClass(id: string, selection: Selection, edgeStart: string | null, route: string[], workspaceMode: WorkspaceMode) {
  const classes = ["node"];
  if (workspaceMode !== "map") classes.push("subtle");
  if (selection?.type === "node" && selection.id === id) classes.push("active");
  if (edgeStart === id) classes.push("edge-start");
  if (route.includes(id)) classes.push("route");
  return classes.join(" ");
}
