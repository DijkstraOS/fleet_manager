import type { EdgeTrajectory, MapEdge, MapNode } from "./types";

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
