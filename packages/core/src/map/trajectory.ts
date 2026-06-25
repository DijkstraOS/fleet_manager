import type { EdgeTrajectory, MapDocument, MapEdge, MapNode } from "./types";
// `splitEdge` needs stable id generation; these live in their own module (not ./index) to
// avoid an index <-> trajectory import cycle.
import { nextEdgeId, nextNodeId } from "./ids";

export interface TrajectoryPoint {
  x: number;
  y: number;
}

export interface TrajectoryPose extends TrajectoryPoint {
  theta: number;
}

export const QUADRATIC_BEZIER_KNOT_VECTOR = [0, 0, 0, 1, 1, 1] as const;

export function createQuadraticBezierTrajectory(
  from: TrajectoryPoint,
  to: TrajectoryPoint,
  handle = defaultQuadraticHandle(from, to)
): EdgeTrajectory {
  return {
    degree: 2,
    knotVector: [...QUADRATIC_BEZIER_KNOT_VECTOR],
    controlPoints: [
      { x: from.x, y: from.y },
      { x: handle.x, y: handle.y },
      { x: to.x, y: to.y },
    ],
  };
}

export function resetEdgeToQuadraticBezier(edge: MapEdge, from: MapNode, to: MapNode): MapEdge {
  return {
    ...edge,
    trajectory: createQuadraticBezierTrajectory(from, to),
  };
}

export function setQuadraticBezierHandle(edge: MapEdge, from: MapNode, to: MapNode, handle: TrajectoryPoint): MapEdge {
  return {
    ...edge,
    trajectory: createQuadraticBezierTrajectory(from, to, handle),
  };
}

export function syncTrajectoryEndpoints(edge: MapEdge, from: MapNode | undefined, to: MapNode | undefined): MapEdge {
  if (!edge.trajectory || !from || !to || edge.trajectory.controlPoints.length < 2) return edge;
  const controlPoints = edge.trajectory.controlPoints.map((point) => ({ ...point }));
  controlPoints[0] = { ...controlPoints[0]!, x: from.x, y: from.y };
  controlPoints[controlPoints.length - 1] = {
    ...controlPoints[controlPoints.length - 1]!,
    x: to.x,
    y: to.y,
  };
  return {
    ...edge,
    trajectory: {
      ...edge.trajectory,
      controlPoints,
    },
  };
}

export function syncMapEdgeTrajectoryEndpoints(edges: MapEdge[], nodes: MapNode[]): MapEdge[] {
  return edges.map((edge) =>
    syncTrajectoryEndpoints(
      edge,
      nodes.find((node) => node.id === edge.from),
      nodes.find((node) => node.id === edge.to)
    )
  );
}

export function isSupportedQuadraticBezier(trajectory: EdgeTrajectory | null | undefined): trajectory is EdgeTrajectory {
  if (!trajectory) return false;
  if (trajectory.degree !== 2) return false;
  if (trajectory.knotVector.length !== QUADRATIC_BEZIER_KNOT_VECTOR.length) return false;
  if (!trajectory.knotVector.every((value, index) => value === QUADRATIC_BEZIER_KNOT_VECTOR[index])) return false;
  if (trajectory.controlPoints.length !== 3) return false;
  return trajectory.controlPoints.every((point) =>
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    (point.weight === undefined || point.weight === 1)
  );
}

export function validateTrajectory(edge: MapEdge): string[] {
  const trajectory = edge.trajectory;
  if (!trajectory) return [];
  const issues: string[] = [];
  if (!Number.isInteger(trajectory.degree) || trajectory.degree < 1) {
    issues.push(`Edge ${edge.id} trajectory degree must be a positive integer.`);
  }
  if (!Array.isArray(trajectory.knotVector) || trajectory.knotVector.length === 0) {
    issues.push(`Edge ${edge.id} trajectory knot vector is required.`);
  } else if (!trajectory.knotVector.every(Number.isFinite)) {
    issues.push(`Edge ${edge.id} trajectory knot vector must contain finite numbers.`);
  }
  if (!Array.isArray(trajectory.controlPoints) || trajectory.controlPoints.length < 2) {
    issues.push(`Edge ${edge.id} trajectory needs at least two control points.`);
  } else {
    for (const point of trajectory.controlPoints) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        issues.push(`Edge ${edge.id} trajectory control points must use finite coordinates.`);
        break;
      }
      if (point.weight !== undefined && (!Number.isFinite(point.weight) || point.weight <= 0)) {
        issues.push(`Edge ${edge.id} trajectory control point weights must be positive finite numbers.`);
        break;
      }
    }
  }
  return issues;
}

export function quadraticBezierSvgPath(trajectory: EdgeTrajectory | null | undefined): string | null {
  if (!isSupportedQuadraticBezier(trajectory)) return null;
  const [start, handle, end] = trajectory.controlPoints;
  if (!start || !handle || !end) return null;
  return `M ${start.x} ${start.y} Q ${handle.x} ${handle.y} ${end.x} ${end.y}`;
}

export function getQuadraticBezierHandle(trajectory: EdgeTrajectory | null | undefined): TrajectoryPoint | null {
  if (!isSupportedQuadraticBezier(trajectory)) return null;
  const handle = trajectory.controlPoints[1];
  return handle ? { x: handle.x, y: handle.y } : null;
}

export function evaluateQuadraticBezier(trajectory: EdgeTrajectory, t: number): TrajectoryPose {
  const [start, handle, end] = trajectory.controlPoints;
  if (!start || !handle || !end) throw new Error("Quadratic trajectory must have three control points.");
  const clamped = clamp01(t);
  const inverse = 1 - clamped;
  const x = (inverse * inverse * start.x) + (2 * inverse * clamped * handle.x) + (clamped * clamped * end.x);
  const y = (inverse * inverse * start.y) + (2 * inverse * clamped * handle.y) + (clamped * clamped * end.y);
  const tangentX = 2 * inverse * (handle.x - start.x) + 2 * clamped * (end.x - handle.x);
  const tangentY = 2 * inverse * (handle.y - start.y) + 2 * clamped * (end.y - handle.y);
  return {
    x,
    y,
    theta: Math.atan2(tangentY, tangentX),
  };
}

export function sampleQuadraticBezier(trajectory: EdgeTrajectory, segments = 32): TrajectoryPose[] {
  const count = Math.max(1, Math.floor(segments));
  return Array.from({ length: count + 1 }, (_item, index) =>
    evaluateQuadraticBezier(trajectory, index / count)
  );
}

export function estimateQuadraticBezierLength(trajectory: EdgeTrajectory, segments = 32): number {
  const samples = sampleQuadraticBezier(trajectory, segments);
  return polylineLength(samples);
}

export function getQuadraticBezierPoseAtDistance(
  trajectory: EdgeTrajectory,
  distance: number,
  segments = 48
): TrajectoryPose & { totalLength: number } {
  const samples = sampleQuadraticBezier(trajectory, segments);
  const totalLength = polylineLength(samples);
  if (distance <= 0) return { ...samples[0]!, totalLength };
  if (distance >= totalLength) return { ...samples[samples.length - 1]!, totalLength };

  let traveled = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const segmentLength = distanceBetween(previous, current);
    if (traveled + segmentLength >= distance) {
      const ratio = segmentLength === 0 ? 0 : (distance - traveled) / segmentLength;
      return {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
        theta: Math.atan2(current.y - previous.y, current.x - previous.x),
        totalLength,
      };
    }
    traveled += segmentLength;
  }

  return { ...samples[samples.length - 1]!, totalLength };
}

/**
 * Splits a directed edge into two halves at its geometric midpoint, inserting a node there.
 * For a supported quadratic the curve is subdivided (each half keeps the original shape);
 * a straight edge yields two straight halves. Returns null if the edge carries a trajectory
 * that is not a supported quadratic. Pure: derives new node/edge ids from `map` without
 * mutating it.
 */
export function splitEdge(
  edge: MapEdge,
  from: MapNode,
  to: MapNode,
  map: MapDocument,
  options: {
    node?: MapNode;
    availableEdges?: MapEdge[];
  } = {}
): { node: MapNode; edges: [MapEdge, MapEdge] } | null {
  const syncedEdge = syncTrajectoryEndpoints(edge, from, to);

  if (syncedEdge.trajectory && !isSupportedQuadraticBezier(syncedEdge.trajectory)) {
    return null;
  }

  const newNodeId = options.node?.id || nextNodeId(map);
  const splitPoint = syncedEdge.trajectory
    ? evaluateQuadraticBezier(syncedEdge.trajectory, 0.5)
    : {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
      };
  const node: MapNode = options.node || {
    id: newNodeId,
    label: newNodeId,
    x: splitPoint.x,
    y: splitPoint.y,
  };
  const availableEdges = options.availableEdges ?? map.edges.filter((item) => item.id !== edge.id);
  const firstEdgeId = nextEdgeId(
    { ...map, nodes: [...map.nodes, node], edges: availableEdges },
    edge.from,
    newNodeId
  );
  const secondEdgeId = nextEdgeId(
    {
      ...map,
      nodes: [...map.nodes, node],
      edges: [
        ...availableEdges,
        { ...edge, id: firstEdgeId, from: edge.from, to: newNodeId },
      ],
    },
    newNodeId,
    edge.to
  );

  const baseEdge = copyBifurcatedEdgeProperties(edge);
  return {
    node,
    edges: [
      {
        ...baseEdge,
        id: firstEdgeId,
        label: `${edge.from} -> ${newNodeId}`,
        from: edge.from,
        to: newNodeId,
        trajectory: syncedEdge.trajectory
          ? splitQuadraticTrajectory(syncedEdge.trajectory, "first", node)
          : null,
      },
      {
        ...baseEdge,
        id: secondEdgeId,
        label: `${newNodeId} -> ${edge.to}`,
        from: newNodeId,
        to: edge.to,
        trajectory: syncedEdge.trajectory
          ? splitQuadraticTrajectory(syncedEdge.trajectory, "second", node)
          : null,
      },
    ],
  };
}

/**
 * Copies the edge attributes that should carry over when an edge is bifurcated, deliberately
 * dropping identity/geometry (`id`, `label`, `from`, `to`, `trajectory`) so the caller assigns
 * fresh values. Optional numeric fields are omitted entirely when undefined.
 */
export function copyBifurcatedEdgeProperties(
  edge: MapEdge
): Omit<MapEdge, "id" | "label" | "from" | "to" | "trajectory"> {
  return {
    ...(edge.maxSpeed !== undefined ? { maxSpeed: edge.maxSpeed } : {}),
    ...(edge.orientation !== undefined ? { orientation: edge.orientation } : {}),
    orientationType: edge.orientationType,
    rotationAllowed: edge.rotationAllowed,
  };
}

/**
 * Subdivides a quadratic Bézier at its midpoint (de Casteljau t=0.5), returning the requested
 * half as a new trajectory anchored at `splitPointNode`. Returns null if the trajectory lacks
 * the three control points of a quadratic.
 */
export function splitQuadraticTrajectory(
  trajectory: NonNullable<MapEdge["trajectory"]>,
  segment: "first" | "second",
  splitPointNode: MapNode
): EdgeTrajectory | null {
  const [start, handle, end] = trajectory.controlPoints;
  if (!start || !handle || !end) return null;
  const startHandle = midpoint(start, handle);
  const endHandle = midpoint(handle, end);
  return segment === "first"
    ? createQuadraticBezierTrajectory(start, splitPointNode, startHandle)
    : createQuadraticBezierTrajectory(splitPointNode, end, endHandle);
}

/**
 * Resets a reverse edge to mirror the selected edge's curve: when the selection is a supported
 * quadratic, the reverse edge reuses its handle (so both directions share one control handle);
 * otherwise it falls back to a default-handle quadratic between `from` and `to`.
 */
export function resetReverseEdgeToSelectedCurvePath(
  reverseEdge: MapEdge,
  from: MapNode,
  to: MapNode,
  selectedEdge: MapEdge
): MapEdge {
  if (!isSupportedQuadraticBezier(selectedEdge.trajectory)) {
    return resetEdgeToQuadraticBezier(reverseEdge, from, to);
  }
  const handle = selectedEdge.trajectory.controlPoints[1];
  if (!handle) return resetEdgeToQuadraticBezier(reverseEdge, from, to);
  return {
    ...reverseEdge,
    trajectory: createQuadraticBezierTrajectory(from, to, handle),
  };
}

/** True when both edges are supported quadratics whose control handles coincide. */
export function edgesShareQuadraticHandle(edge: MapEdge, reverseEdge: MapEdge): boolean {
  if (!isSupportedQuadraticBezier(edge.trajectory) || !isSupportedQuadraticBezier(reverseEdge.trajectory)) {
    return false;
  }
  const handle = edge.trajectory.controlPoints[1];
  const reverseHandle = reverseEdge.trajectory.controlPoints[1];
  return Boolean(handle && reverseHandle && pointsMatch(handle, reverseHandle));
}

/** Coordinate equality within a 1e-6 tolerance (strict `<`). */
export function pointsMatch(
  left: TrajectoryPoint,
  right: TrajectoryPoint
): boolean {
  return Math.abs(left.x - right.x) < 0.000001 && Math.abs(left.y - right.y) < 0.000001;
}

function midpoint(left: TrajectoryPoint, right: TrajectoryPoint): TrajectoryPoint {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function defaultQuadraticHandle(from: TrajectoryPoint, to: TrajectoryPoint): TrajectoryPoint {
  const midpoint = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001) return { x: midpoint.x, y: midpoint.y + 1 };
  const offset = Math.min(Math.max(distance * 0.25, 0.75), 4);
  return {
    x: midpoint.x - (dy / distance) * offset,
    y: midpoint.y + (dx / distance) * offset,
  };
}

function polylineLength(points: TrajectoryPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distanceBetween(points[index - 1]!, points[index]!);
  }
  return length;
}

function distanceBetween(a: TrajectoryPoint, b: TrajectoryPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
