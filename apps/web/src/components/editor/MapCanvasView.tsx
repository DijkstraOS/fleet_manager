import type { PointerEvent, RefObject } from "react";
import {
  getSupportNodeIds,
  nodeHasLabel,
  getQuadraticBezierHandle,
  isSupportedQuadraticBezier,
  type CanvasSize,
  type MapDocument,
  type MapEdge,
  type MapNode,
  type VdaState,
  type VdaVisualization,
} from "@agv/core";
import { LocateFixed, Minus, Plus } from "lucide-react";
import {
  CURVE_HANDLE_RADIUS,
  arrowStandoffPoint,
  nodeRenderRadius,
  routeContainsEdge,
  type CanvasBounds,
} from "../../lib/geometry";
import type { EditorBackgroundImage, Selection, WorkspaceMode } from "../../types";

export interface CanvasAgv {
  serialNumber: string;
  state: VdaState | null;
  visualization: VdaVisualization | null;
}

export interface MapCanvasViewProps {
  svgRef: RefObject<SVGSVGElement | null>;
  map: MapDocument;
  bounds: CanvasBounds;
  canvas: CanvasSize;
  gridStep: number;
  workspaceMode: WorkspaceMode;
  backgroundImage: EditorBackgroundImage | null;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  agvs: CanvasAgv[];
  onCanvasPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onCanvasPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onCanvasPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
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
        <CanvasDefs canvas={props.canvas} gridStep={props.gridStep} />
        <FloorLayer bounds={props.bounds} canvas={props.canvas} />
        <BackgroundImageLayer backgroundImage={props.backgroundImage} canvas={props.canvas} />
        <GridLayer canvas={props.canvas} />
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

function CanvasDefs(props: { canvas: CanvasSize; gridStep: number }) {
  // The grid line width scales with the step so coarser grids stay crisp; the
  // pattern is sized to the adaptive step so the line count stays legible.
  const strokeWidth = props.gridStep * 0.015;
  return (
    <defs>
      <pattern id="grid" width={props.gridStep} height={props.gridStep} patternUnits="userSpaceOnUse">
        <path
          d={`M ${props.gridStep} 0 L 0 0 0 ${props.gridStep}`}
          fill="none"
          stroke="#d7dee8"
          strokeWidth={strokeWidth}
        />
      </pattern>
      {/* Clip the grid to the floor so lines never spill onto the letterbox margin. */}
      <clipPath id="floor-clip">
        <rect x={0} y={0} width={props.canvas.width} height={props.canvas.height} />
      </clipPath>
      {/* Slim directional cue, same slate as the .edge stroke so the head reads as part
          of the line. refX=10 (the viewBox tip) lands the arrow tip at the path end;
          EdgeLayer stops arrow-bearing edges a standoff short of the target center (see
          arrowStandoffPoint) so the tip rests against the node ring. */}
      <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#475569" />
      </marker>
    </defs>
  );
}

// The out-of-bounds margin (letterbox) reads as muted gray; the finite floor sits
// on top as a bordered white rectangle anchored at the origin.
function FloorLayer(props: { bounds: CanvasBounds; canvas: CanvasSize }) {
  return (
    <g pointerEvents="none">
      <rect
        x={props.bounds.x}
        y={props.bounds.y}
        width={props.bounds.width}
        height={props.bounds.height}
        className="canvas-letterbox"
      />
      <rect x={0} y={0} width={props.canvas.width} height={props.canvas.height} className="canvas-floor" />
    </g>
  );
}

function GridLayer(props: { canvas: CanvasSize }) {
  return (
    <g pointerEvents="none" clipPath="url(#floor-clip)">
      <rect x={0} y={0} width={props.canvas.width} height={props.canvas.height} fill="url(#grid)" />
    </g>
  );
}

// The background image redefines the floor's shape (the floor adopts its aspect),
// so it simply fills the floor edge-to-edge. With the floor matched to the image
// aspect, default `preserveAspectRatio` fills exactly with no distortion.
function BackgroundImageLayer(props: { backgroundImage: EditorBackgroundImage | null; canvas: CanvasSize }) {
  const backgroundImage = props.backgroundImage;
  if (!backgroundImage) return null;
  return (
    <g className="background-layer" pointerEvents="none">
      <image
        href={backgroundImage.src}
        x={0}
        y={0}
        width={props.canvas.width}
        height={props.canvas.height}
        opacity={backgroundImage.opacity}
        className="background-image"
      />
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
  // The arrowhead marks direction into a node that actually does something, so
  // only edges arriving at a full node (a label OR actions) carry it; edges into
  // a pure path-support node read as a plain segment of the route.
  const supportNodeIds = getSupportNodeIds(props.map);
  return (
    <>
      {edges.map((edge) => {
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        if (!from || !to) return null;
        const active = props.selection?.type === "edge" && props.selection.id === edge.id;
        const routeActive = routeContainsEdge(props.routeNodeIds, edge.from, edge.to);
        const showArrow = !supportNodeIds.has(edge.to);
        const className = edgeClass(active, routeActive, props.workspaceMode, showArrow);
        const handle = getQuadraticBezierHandle(edge.trajectory);
        // Edges run from the source node center to the target: a curve uses its
        // Bézier path, a straight edge draws raw from->to. When an arrowhead is
        // shown (target is an action node) the edge stops a fixed standoff short
        // of the node center via arrowStandoffPoint, so the tip rests against the
        // ring instead of burying at the center; edges into a support node carry
        // no arrow and still run to the center. The standoff direction is the
        // curve handle for a quadratic, else the source node. Forward and reverse
        // twins intentionally overlap; the arrowhead comes from the `.edge` CSS
        // marker-end (suppressed by `.edge.no-arrow`).
        const end = showArrow ? arrowStandoffPoint(handle ?? from, to) : to;
        return (
          <g key={edge.id} onPointerDown={(event) => props.onEdgePointerDown(event, edge.id)}>
            {handle ? (
              <path d={`M ${from.x} ${from.y} Q ${handle.x} ${handle.y} ${end.x} ${end.y}`} className={className} fill="none" />
            ) : (
              <line x1={from.x} y1={from.y} x2={end.x} y2={end.y} className={className} />
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
        r={CURVE_HANDLE_RADIUS}
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
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  workspaceMode: WorkspaceMode;
  onNodePointerDown: (event: PointerEvent<SVGGElement>, node: MapNode) => void;
}) {
  // Full nodes (a label OR actions) stay hefty; pure path-support nodes — no
  // label and no actions — render as a small dot. Both keep a fixed real-world size.
  const supportNodeIds = getSupportNodeIds(props.map);
  return (
    <>
      {props.map.nodes.map((node) => {
        const isSupport = supportNodeIds.has(node.id);
        const radius = nodeRenderRadius(isSupport);
        return (
          <g key={node.id} onPointerDown={(event) => props.onNodePointerDown(event, node)}>
            <circle className={nodeClass(node.id, props.selection, props.edgeStartNodeId, props.routeNodeIds, props.workspaceMode, isSupport)} cx={node.x} cy={node.y} r={radius} />
            {nodeHasLabel(node) && (
              <text className="node-label" x={node.x + 0.35} y={node.y - 0.35}>{node.label}</text>
            )}
          </g>
        );
      })}
    </>
  );
}

function edgeClass(active: boolean, routeActive: boolean, workspaceMode: WorkspaceMode, showArrow: boolean) {
  const classes = ["edge"];
  if (workspaceMode !== "map") classes.push("subtle");
  if (active) classes.push("active");
  if (routeActive) classes.push("route");
  if (!showArrow) classes.push("no-arrow");
  return classes.join(" ");
}

function nodeClass(id: string, selection: Selection, edgeStart: string | null, route: string[], workspaceMode: WorkspaceMode, isSupport: boolean) {
  const classes = ["node"];
  if (isSupport) classes.push("support");
  if (workspaceMode !== "map") classes.push("subtle");
  if (selection?.type === "node" && selection.id === id) classes.push("active");
  if (edgeStart === id) classes.push("edge-start");
  if (route.includes(id)) classes.push("route");
  return classes.join(" ");
}
