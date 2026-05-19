import type { EdgeTrajectory, MapDocument, MapEdge, MapNode } from "../map/index";
import { createEmptyMap } from "../map/index";
import type {
  LifDocument,
  LifEdge,
  LifLayout,
  LifNode,
  LifVehicleTypeEdgeProperty,
} from "./types";

export function importLifDocument(input: unknown): MapDocument {
  if (!isRecord(input) || !Array.isArray(input.layouts) || input.layouts.length === 0) {
    throw new Error("LIF document must contain at least one layout.");
  }

  const lif = input as LifDocument;
  const layout = lif.layouts[0];
  if (!layout) throw new Error("LIF document has no layout.");

  const map = createEmptyMap(layout.layoutName || layout.layoutId || "Imported LIF");
  map.id = layout.layoutId || map.id;
  map.version = layout.layoutVersion || "1";
  map.name = layout.layoutName || layout.layoutId || map.name;
  const unsupported = pickUnsupported(layout, ["layoutId", "layoutName", "layoutVersion", "layoutDescription", "nodes", "edges"]);
  if (unsupported) map.unsupported = unsupported;

  map.nodes = (layout.nodes || []).map(importLifNode);
  map.edges = (layout.edges || []).map(importLifEdge);

  return map;
}

export function exportLifDocument(map: MapDocument): LifDocument {
  const layout: LifLayout = {
    layoutId: map.id,
    layoutName: map.name,
    layoutVersion: map.version,
    nodes: map.nodes.map(exportLifNode),
    edges: map.edges.map(exportLifEdge),
  };
  if (typeof map.unsupported?.layoutDescription === "string") {
    layout.layoutDescription = map.unsupported.layoutDescription;
  }

  return {
    metaInformation: {
      projectIdentification: map.name,
      creator: "agv-new",
      exportTimestamp: new Date().toISOString(),
      lifVersion: "1.0.0",
    },
    layouts: [layout],
  };
}

function importLifNode(node: LifNode): MapNode {
  const unsupported = pickUnsupported(node, ["nodeId", "nodeName", "mapId", "nodePosition", "vehicleTypeNodeProperties"]);
  const mapNode: MapNode = {
    id: node.nodeId,
    label: node.nodeName || node.nodeId,
    x: numberOr(node.nodePosition?.x, 0),
    y: numberOr(node.nodePosition?.y, 0),
    ...(typeof node.nodePosition?.theta === "number" ? { theta: node.nodePosition.theta } : {}),
  };
  if (unsupported) mapNode.unsupported = unsupported;
  return mapNode;
}

function exportLifNode(node: MapNode): LifNode {
  return {
    nodeId: node.id,
    nodeName: node.label,
    nodePosition: {
      x: node.x,
      y: node.y,
      ...(node.theta !== undefined ? { theta: node.theta } : {}),
    },
    vehicleTypeNodeProperties: [
      {
        vehicleTypeId: "default",
      },
    ],
    ...node.unsupported,
  };
}

function importLifEdge(edge: LifEdge): MapEdge {
  const vehicleProps = edge.vehicleTypeEdgeProperties?.[0];
  const unsupported = pickUnsupported(edge, ["edgeId", "edgeName", "edgeDescription", "startNodeId", "endNodeId", "vehicleTypeEdgeProperties"]);
  const mapEdge: MapEdge = {
    id: edge.edgeId,
    label: edge.edgeName || edge.edgeId,
    from: edge.startNodeId,
    to: edge.endNodeId,
    ...(typeof vehicleProps?.maxSpeed === "number" ? { maxSpeed: vehicleProps.maxSpeed } : {}),
    ...(typeof vehicleProps?.vehicleOrientation === "number" ? { orientation: vehicleProps.vehicleOrientation } : {}),
    orientationType: vehicleProps?.orientationType || "TANGENTIAL",
    rotationAllowed: vehicleProps?.rotationAllowed ?? true,
    trajectory: isTrajectory(vehicleProps?.trajectory) ? vehicleProps.trajectory : null,
  };
  if (unsupported) mapEdge.unsupported = unsupported;
  return mapEdge;
}

function exportLifEdge(edge: MapEdge): LifEdge {
  const vehicleTypeEdgeProperty: LifVehicleTypeEdgeProperty = {
    vehicleTypeId: "default",
    ...(edge.orientation !== undefined ? { vehicleOrientation: edge.orientation } : {}),
    orientationType: edge.orientationType,
    rotationAllowed: edge.rotationAllowed,
    ...(edge.maxSpeed !== undefined ? { maxSpeed: edge.maxSpeed } : {}),
    ...(edge.trajectory ? { trajectory: edge.trajectory } : {}),
  };

  return {
    edgeId: edge.id,
    edgeName: edge.label,
    startNodeId: edge.from,
    endNodeId: edge.to,
    vehicleTypeEdgeProperties: [vehicleTypeEdgeProperty],
    ...edge.unsupported,
  };
}

function pickUnsupported(value: Record<string, unknown>, knownKeys: string[]): Record<string, unknown> | undefined {
  const known = new Set(knownKeys);
  const unsupported = Object.fromEntries(
    Object.entries(value).filter(([key]) => !known.has(key))
  );
  return Object.keys(unsupported).length > 0 ? unsupported : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTrajectory(value: unknown): value is EdgeTrajectory {
  if (!isRecord(value)) return false;
  return (
    typeof value.degree === "number" &&
    Array.isArray(value.knotVector) &&
    Array.isArray(value.controlPoints)
  );
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export type { LifDocument, LifEdge, LifLayout, LifNode, LifVehicleTypeEdgeProperty } from "./types";
