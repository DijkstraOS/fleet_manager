import type { PointerEvent, RefObject, WheelEvent } from "react";
import type { MapDocument, MapEdge, MapNode, VdaState, VdaVisualization } from "@agv/core";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { GRID, type CanvasBounds } from "../../lib/geometry";
import type { WorkspaceMode } from "../../types";

export type CanvasSelection = { type: "node"; id: string } | { type: "edge"; id: string } | null;

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
  selection: CanvasSelection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  agvs: CanvasAgv[];
  onCanvasPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onCanvasPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onCanvasPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
  onCanvasWheel: (event: WheelEvent<SVGSVGElement>) => void;
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
        onWheel={props.onCanvasWheel}
      >
        <GridLayer bounds={props.bounds} />
        <EdgeLayer
          edges={props.map.edges}
          nodes={props.map.nodes}
          selection={props.selection}
          routeNodeIds={props.routeNodeIds}
          workspaceMode={props.workspaceMode}
          onEdgePointerDown={props.onEdgePointerDown}
        />
        <NodeLayer
          nodes={props.map.nodes}
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

function GridLayer(props: { bounds: CanvasBounds }) {
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#d7dee8" strokeWidth="0.015" />
        </pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      <rect x={props.bounds.x} y={props.bounds.y} width={props.bounds.width} height={props.bounds.height} fill="#f8fafc" />
      <rect x={props.bounds.x} y={props.bounds.y} width={props.bounds.width} height={props.bounds.height} fill="url(#grid)" />
    </g>
  );
}

function EdgeLayer(props: {
  edges: MapEdge[];
  nodes: MapNode[];
  selection: CanvasSelection;
  routeNodeIds: string[];
  workspaceMode: WorkspaceMode;
  onEdgePointerDown: (event: PointerEvent<SVGGElement>, edgeId: string) => void;
}) {
  return (
    <>
      {props.edges.map((edge) => {
        const from = props.nodes.find((node) => node.id === edge.from);
        const to = props.nodes.find((node) => node.id === edge.to);
        if (!from || !to) return null;
        const active = props.selection?.type === "edge" && props.selection.id === edge.id;
        const routeActive = routeContainsEdge(props.routeNodeIds, edge.from, edge.to);
        const className = edgeClass(active, routeActive, props.workspaceMode);
        return (
          <g key={edge.id} onPointerDown={(event) => props.onEdgePointerDown(event, edge.id)}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={className}
              markerEnd="url(#arrow)"
            />
          </g>
        );
      })}
    </>
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
  nodes: MapNode[];
  selection: CanvasSelection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  workspaceMode: WorkspaceMode;
  onNodePointerDown: (event: PointerEvent<SVGGElement>, node: MapNode) => void;
}) {
  return (
    <>
      {props.nodes.map((node) => (
        <g key={node.id} onPointerDown={(event) => props.onNodePointerDown(event, node)}>
          <circle className={nodeClass(node.id, props.selection, props.edgeStartNodeId, props.routeNodeIds, props.workspaceMode)} cx={node.x} cy={node.y} r="0.28" />
          <text className="node-label" x={node.x + 0.35} y={node.y - 0.35}>{node.label || node.id}</text>
        </g>
      ))}
    </>
  );
}

function routeContainsEdge(route: string[], from: string, to: string) {
  return route.some((nodeId, index) => nodeId === from && route[index + 1] === to);
}

function edgeClass(active: boolean, routeActive: boolean, workspaceMode: WorkspaceMode) {
  const classes = ["edge"];
  if (workspaceMode !== "map") classes.push("subtle");
  if (active) classes.push("active");
  if (routeActive) classes.push("route");
  return classes.join(" ");
}

function nodeClass(id: string, selection: CanvasSelection, edgeStart: string | null, route: string[], workspaceMode: WorkspaceMode) {
  const classes = ["node"];
  if (workspaceMode !== "map") classes.push("subtle");
  if (selection?.type === "node" && selection.id === id) classes.push("active");
  if (edgeStart === id) classes.push("edge-start");
  if (route.includes(id)) classes.push("route");
  return classes.join(" ");
}
