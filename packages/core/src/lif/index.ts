import type { EdgeTrajectory, MapDocument, MapEdge, MapNode } from "../map/index";
import { createEmptyMap, syncMapEdgeTrajectoryEndpoints } from "../map/index";
import { LIFParser } from "vdma-lif";
import type {
  LifDocument,
  LifEdge,
  LifLayout,
  LifNode,
  LifStation,
  LifVehicleTypeEdgeProperty,
  LifVehicleTypeNodeProperty,
} from "./types";

const LIF_VERSION = "1.0.0";
const LIF_DOCUMENT_EXTRAS_KEY = "lifDocumentExtras";
const LIF_META_INFORMATION_KEY = "lifMetaInformation";

export function importLifDocument(input: unknown): MapDocument {
  const lif = parseLifDocument(input);
  const layout = lif.layouts[0];
  if (!layout) throw new Error("LIF document has no layout.");

  const map = createEmptyMap(layout.layoutName || layout.layoutId || "Imported LIF");
  map.id = layout.layoutId || map.id;
  map.version = layout.layoutVersion || "1";
  map.name = layout.layoutName || layout.layoutId || map.name;
  const unsupported = {
    ...withOptionalRecord(LIF_DOCUMENT_EXTRAS_KEY, pickUnsupported(lif, ["metaInformation", "layouts"])),
    [LIF_META_INFORMATION_KEY]: lif.metaInformation,
    ...pickUnsupported(layout, ["layoutId", "layoutName", "layoutVersion", "nodes", "edges"]),
  };
  if (Object.keys(unsupported).length > 0) map.unsupported = unsupported;

  map.nodes = layout.nodes.map(importLifNode);
  map.edges = layout.edges.map(importLifEdge);

  return map;
}

export function exportLifDocument(map: MapDocument): LifDocument {
  const mapUnsupported = map.unsupported || {};
  const {
    [LIF_DOCUMENT_EXTRAS_KEY]: documentExtras,
    [LIF_META_INFORMATION_KEY]: lifMetaInformation,
    ...layoutExtras
  } = mapUnsupported;
  const preservedMeta = isRecord(lifMetaInformation) ? lifMetaInformation : {};
  const edges = syncMapEdgeTrajectoryEndpoints(map.edges, map.nodes);
  const layout: LifLayout = {
    ...layoutExtras,
    layoutId: map.id,
    layoutName: map.name,
    layoutVersion: map.version,
    nodes: map.nodes.map(exportLifNode),
    edges: edges.map(exportLifEdge),
    stations: toRecordArray(layoutExtras.stations) as LifStation[],
  };

  const lif: LifDocument = {
    ...(isRecord(documentExtras) ? documentExtras : {}),
    metaInformation: {
      ...preservedMeta,
      projectIdentification: map.name,
      creator: "agv-new",
      exportTimestamp: new Date(),
      lifVersion: stringOr(preservedMeta.lifVersion, LIF_VERSION),
    },
    layouts: [layout],
  };

  return parseLifDocument(LIFParser.toJson(lif));
}

function importLifNode(node: LifNode): MapNode {
  const vehicleProps = node.vehicleTypeNodeProperties[0];
  const unsupported = pickUnsupported(node, ["nodeId", "nodeName", "nodePosition"]);
  const theta = typeof vehicleProps?.theta === "number"
    ? vehicleProps.theta
    : typeof node.nodePosition.theta === "number"
      ? node.nodePosition.theta
      : undefined;
  const mapNode: MapNode = {
    id: node.nodeId,
    label: node.nodeName || node.nodeId,
    x: numberOr(node.nodePosition.x, 0),
    y: numberOr(node.nodePosition.y, 0),
    ...(theta !== undefined ? { theta } : {}),
  };
  if (unsupported) mapNode.unsupported = unsupported;
  return mapNode;
}

function exportLifNode(node: MapNode): LifNode {
  const unsupported = node.unsupported || {};
  const { vehicleTypeNodeProperties, nodePosition, ...nodeExtras } = unsupported;
  const preservedVehicleProps = toRecordArray(vehicleTypeNodeProperties) as LifVehicleTypeNodeProperty[];
  return {
    ...nodeExtras,
    nodeId: node.id,
    nodeName: node.label,
    nodePosition: {
      ...(isRecord(nodePosition) ? nodePosition : {}),
      x: node.x,
      y: node.y,
    },
    vehicleTypeNodeProperties: mergeNodeVehicleProperties(preservedVehicleProps, node),
  };
}

function importLifEdge(edge: LifEdge): MapEdge {
  const vehicleProps = edge.vehicleTypeEdgeProperties[0];
  const unsupported = pickUnsupported(edge, ["edgeId", "edgeName", "startNodeId", "endNodeId"]);
  const mapEdge: MapEdge = {
    id: edge.edgeId,
    label: edge.edgeName || edge.edgeId,
    from: edge.startNodeId,
    to: edge.endNodeId,
    ...(typeof vehicleProps?.maxSpeed === "number" ? { maxSpeed: vehicleProps.maxSpeed } : {}),
    ...(typeof vehicleProps?.vehicleOrientation === "number" ? { orientation: vehicleProps.vehicleOrientation } : {}),
    orientationType: toOrientationType(vehicleProps?.orientationType),
    rotationAllowed: vehicleProps?.rotationAllowed ?? true,
    trajectory: isTrajectory(vehicleProps?.trajectory) ? vehicleProps.trajectory : null,
  };
  if (unsupported) mapEdge.unsupported = unsupported;
  return mapEdge;
}

function exportLifEdge(edge: MapEdge): LifEdge {
  const unsupported = edge.unsupported || {};
  const { vehicleTypeEdgeProperties, ...edgeExtras } = unsupported;
  const preservedVehicleProps = toRecordArray(vehicleTypeEdgeProperties) as LifVehicleTypeEdgeProperty[];

  return {
    ...edgeExtras,
    edgeId: edge.id,
    edgeName: edge.label,
    startNodeId: edge.from,
    endNodeId: edge.to,
    vehicleTypeEdgeProperties: mergeEdgeVehicleProperties(preservedVehicleProps, edge),
  };
}

function parseLifDocument(input: unknown): LifDocument {
  try {
    const json = toLifJson(input);
    const lif = LIFParser.fromJson(json);
    if (!lif || !Array.isArray(lif.layouts) || lif.layouts.length === 0) {
      throw new Error("LIF document must contain at least one layout.");
    }
    return lif;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid LIF document: ${message}`);
  }
}

function toLifJson(input: unknown): string {
  const value = typeof input === "string" ? JSON.parse(input) : input;
  return JSON.stringify(normalizeLifInput(value));
}

function normalizeLifInput(input: unknown): unknown {
  if (!isRecord(input) || !isRecord(input.metaInformation)) return input;
  if (input.metaInformation.exportTimestamp !== "") return input;
  return {
    ...input,
    metaInformation: {
      ...input.metaInformation,
      exportTimestamp: null,
    },
  };
}

function mergeNodeVehicleProperties(preserved: LifVehicleTypeNodeProperty[], node: MapNode): LifVehicleTypeNodeProperty[] {
  const [first, ...rest] = preserved;
  return [
    {
      vehicleTypeId: "default",
      ...first,
      ...(node.theta !== undefined ? { theta: node.theta } : {}),
    },
    ...rest,
  ];
}

function mergeEdgeVehicleProperties(preserved: LifVehicleTypeEdgeProperty[], edge: MapEdge): LifVehicleTypeEdgeProperty[] {
  const [first, ...rest] = preserved;
  return [
    {
      vehicleTypeId: "default",
      ...first,
      ...(edge.orientation !== undefined ? { vehicleOrientation: edge.orientation } : {}),
      orientationType: edge.orientationType,
      rotationAllowed: edge.rotationAllowed,
      ...(edge.maxSpeed !== undefined ? { maxSpeed: edge.maxSpeed } : {}),
      ...(edge.trajectory ? { trajectory: edge.trajectory } : {}),
    },
    ...rest,
  ];
}

function toOrientationType(value: unknown): MapEdge["orientationType"] {
  return value === "GLOBAL" ? "GLOBAL" : "TANGENTIAL";
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

function withOptionalRecord(key: string, value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value ? { [key]: value } : {};
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord) ? value : [];
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

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export type { LifDocument, LifEdge, LifLayout, LifNode, LifStation, LifVehicleTypeEdgeProperty, LifVehicleTypeNodeProperty } from "./types";
