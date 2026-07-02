import { memo, type PointerEvent, type RefObject } from "react";
import {
  edgeFromToKey,
  isSupportNode,
  nodeHasLabel,
  getQuadraticBezierHandle,
  isSupportedQuadraticBezier,
  type CanvasSize,
  type MapDocument,
  type MapIndex,
  type MapNode,
} from "@agv/core";
import { LocateFixed, Minus, Plus } from "lucide-react";
import {
  CURVE_HANDLE_RADIUS,
  arrowStandoffPoint,
  nodeRenderRadius,
  type CanvasBounds,
} from "../../lib/geometry";
import type { EditorBackgroundImage, Selection, WorkspaceMode } from "../../types";
import { useRenderTally } from "../../lib/render-tally";
import { AgvOverlay } from "./AgvOverlay";

export interface MapCanvasViewProps {
  svgRef: RefObject<SVGSVGElement | null>;
  map: MapDocument;
  index: MapIndex;
  bounds: CanvasBounds;
  canvas: CanvasSize;
  gridStep: number;
  workspaceMode: WorkspaceMode;
  backgroundImage: EditorBackgroundImage | null;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
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
  useRenderTally("MapCanvasView");
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
        <StaticGraph
          map={props.map}
          index={props.index}
          selection={props.selection}
          edgeStartNodeId={props.edgeStartNodeId}
          routeNodeIds={props.routeNodeIds}
          workspaceMode={props.workspaceMode}
          onEdgePointerDown={props.onEdgePointerDown}
          onCurveHandlePointerDown={props.onCurveHandlePointerDown}
          onNodePointerDown={props.onNodePointerDown}
        />
        {props.workspaceMode !== "map" && <AgvOverlay />}
      </svg>
      <div className="canvas-controls" aria-label="Canvas zoom controls">
        <button type="button" className="icon-button" title="Zoom in" onClick={props.onZoomIn}><Plus /></button>
        <button type="button" className="icon-button" title="Zoom out" onClick={props.onZoomOut}><Minus /></button>
        <button type="button" className="icon-button" title="Reset view" onClick={props.onResetView}><LocateFixed /></button>
      </div>
    </section>
  );
}

interface StaticGraphProps {
  map: MapDocument;
  index: MapIndex;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  workspaceMode: WorkspaceMode;
  onEdgePointerDown: (event: PointerEvent<SVGGElement>, edgeId: string) => void;
  onCurveHandlePointerDown: (event: PointerEvent<SVGCircleElement>, edgeId: string) => void;
  onNodePointerDown: (event: PointerEvent<SVGGElement>, node: MapNode) => void;
}

const StaticGraph = memo(function StaticGraph(props: StaticGraphProps) {
  useRenderTally("StaticGraph");
  return (
    <>
      <EdgeLayer
        map={props.map}
        index={props.index}
        selection={props.selection}
        routeNodeIds={props.routeNodeIds}
        workspaceMode={props.workspaceMode}
        onEdgePointerDown={props.onEdgePointerDown}
      />
      <CurveHandleLayer
        index={props.index}
        selection={props.selection}
        workspaceMode={props.workspaceMode}
        onCurveHandlePointerDown={props.onCurveHandlePointerDown}
      />
      <NodeLayer
        map={props.map}
        index={props.index}
        selection={props.selection}
        edgeStartNodeId={props.edgeStartNodeId}
        routeNodeIds={props.routeNodeIds}
        workspaceMode={props.workspaceMode}
        onNodePointerDown={props.onNodePointerDown}
      />
    </>
  );
});

function CanvasDefs(props: { canvas: CanvasSize; gridStep: number }) {
  useRenderTally("CanvasDefs");
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
      <clipPath id="floor-clip">
        <rect x={0} y={0} width={props.canvas.width} height={props.canvas.height} />
      </clipPath>
      {/* EdgeLayer stops arrow-bearing edges a standoff short of the target center (arrowStandoffPoint) so the tip rests against the node ring. */}
      <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#475569" />
      </marker>
    </defs>
  );
}

// The out-of-bounds margin (letterbox) reads as muted gray; the finite floor sits
// on top as a bordered white rectangle anchored at the origin.
function FloorLayer(props: { bounds: CanvasBounds; canvas: CanvasSize }) {
  useRenderTally("FloorLayer");
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
  useRenderTally("GridLayer");
  return (
    <g pointerEvents="none" clipPath="url(#floor-clip)">
      <rect x={0} y={0} width={props.canvas.width} height={props.canvas.height} fill="url(#grid)" />
    </g>
  );
}

function BackgroundImageLayer(props: { backgroundImage: EditorBackgroundImage | null; canvas: CanvasSize }) {
  useRenderTally("BackgroundImageLayer");
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
  index: MapIndex;
  selection: Selection;
  routeNodeIds: string[];
  workspaceMode: WorkspaceMode;
  onEdgePointerDown: (event: PointerEvent<SVGGElement>, edgeId: string) => void;
}) {
  useRenderTally("EdgeLayer");
  const edges = props.map.edges;
  const routeEdgeKeys = routeEdgeKeySet(props.routeNodeIds);
  return (
    <>
      {edges.map((edge) => {
        const from = props.index.nodeById.get(edge.from);
        const to = props.index.nodeById.get(edge.to);
        if (!from || !to) return null;
        const active = props.selection?.type === "edge" && props.selection.id === edge.id;
        const routeActive = routeEdgeKeys.has(edgeFromToKey(edge.from, edge.to));
        const showArrow = !isSupportNode(to, props.index.stationNodeIds);
        const className = edgeClass(active, routeActive, props.workspaceMode, showArrow);
        const handle = getQuadraticBezierHandle(edge.trajectory);
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
  index: MapIndex;
  selection: Selection;
  workspaceMode: WorkspaceMode;
  onCurveHandlePointerDown: (event: PointerEvent<SVGCircleElement>, edgeId: string) => void;
}) {
  useRenderTally("CurveHandleLayer");
  if (props.workspaceMode !== "map" || props.selection?.type !== "edge") return null;
  const edge = props.index.edgeById.get(props.selection.id);
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

function NodeLayer(props: {
  map: MapDocument;
  index: MapIndex;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  workspaceMode: WorkspaceMode;
  onNodePointerDown: (event: PointerEvent<SVGGElement>, node: MapNode) => void;
}) {
  useRenderTally("NodeLayer");
  const routeNodeSet = new Set(props.routeNodeIds);
  return (
    <>
      {props.map.nodes.map((node) => {
        const isSupport = isSupportNode(node, props.index.stationNodeIds);
        const radius = nodeRenderRadius(isSupport);
        return (
          <g key={node.id} onPointerDown={(event) => props.onNodePointerDown(event, node)}>
            <circle className={nodeClass(node.id, props.selection, props.edgeStartNodeId, routeNodeSet, props.workspaceMode, isSupport)} cx={node.x} cy={node.y} r={radius} />
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

function nodeClass(id: string, selection: Selection, edgeStart: string | null, routeNodeSet: ReadonlySet<string>, workspaceMode: WorkspaceMode, isSupport: boolean) {
  const classes = ["node"];
  if (isSupport) classes.push("support");
  if (workspaceMode !== "map") classes.push("subtle");
  if (selection?.type === "node" && selection.id === id) classes.push("active");
  if (edgeStart === id) classes.push("edge-start");
  if (routeNodeSet.has(id)) classes.push("route");
  return classes.join(" ");
}

function routeEdgeKeySet(route: string[]): Set<string> {
  const keys = new Set<string>();
  for (let index = 0; index < route.length - 1; index += 1) {
    keys.add(edgeFromToKey(route[index]!, route[index + 1]!));
  }
  return keys;
}
