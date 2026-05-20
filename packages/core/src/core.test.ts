import { describe, expect, it } from "vitest";
import { LIFParser } from "vdma-lif";
import {
  buildVdaOrder,
  createDemoMap,
  exportLifDocument,
  importLifDocument,
  nextRouteId,
  validateMap,
  validateRoute,
  validateRouteDocument,
} from "./index";

describe("map validation", () => {
  it("accepts the demo map", () => {
    expect(validateMap(createDemoMap())).toEqual([]);
  });

  it("rejects disconnected routes", () => {
    const map = createDemoMap();
    const issues = validateRoute(map, ["dock-a", "mat-b"]);
    expect(issues[0]?.code).toBe("route.edge.missing");
  });

  it("validates saved route documents against directed map edges", () => {
    const map = createDemoMap();

    expect(validateRouteDocument(map, {
      id: "dock-run",
      mapId: map.id,
      name: "Dock Run",
      nodeIds: ["dock-a", "corr-1"],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })).toEqual([]);

    expect(validateRouteDocument(map, {
      id: "bad-run",
      mapId: map.id,
      name: "Bad Run",
      nodeIds: ["dock-a", "mat-b"],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })[0]?.code).toBe("route.edge.missing");
  });

  it("generates stable route ids from names", () => {
    expect(nextRouteId([{
      id: "dock-run",
      mapId: "demo-grid",
      name: "Dock Run",
      nodeIds: ["dock-a", "corr-1"],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }], "Dock Run")).toBe("dock-run-2");
  });
});

describe("LIF import/export", () => {
  it("exports documents accepted by the vdma-lif parser", () => {
    const lif = exportLifDocument(createDemoMap());
    const parsed = LIFParser.fromJson(JSON.stringify(lif));

    expect(parsed?.metaInformation.lifVersion).toBe("1.0.0");
    expect(parsed?.layouts[0]?.stations).toEqual([]);
    expect(parsed?.layouts[0]?.nodes[0]?.vehicleTypeNodeProperties[0]?.vehicleTypeId).toBe("default");
  });

  it("preserves edge trajectory shape", () => {
    const map = createDemoMap();
    map.edges[0]!.trajectory = {
      degree: 2,
      knotVector: [0, 0, 0, 1, 1, 1],
      controlPoints: [
        { x: 0, y: 0 },
        { x: 2, y: 2, weight: 1 },
        { x: 5, y: 0 },
      ],
    };

    const lif = exportLifDocument(map);
    const imported = importLifDocument(lif);
    expect(imported.edges[0]?.trajectory?.degree).toBe(2);
    expect(imported.edges[0]?.trajectory?.controlPoints).toHaveLength(3);
  });

  it("passively preserves unmodeled LIF stations and vehicle properties", () => {
    const imported = importLifDocument({
      metaInformation: {
        projectIdentification: "External Layout",
        creator: "external-editor",
        exportTimestamp: "2026-05-20T12:00:00.000Z",
        lifVersion: "1.0.0",
      },
      layouts: [{
        layoutId: "external-layout",
        layoutName: "External Layout",
        layoutVersion: "7",
        layoutLevelId: "floor-1",
        layoutDescription: "Imported from an external editor.",
        nodes: [{
          nodeId: "n1",
          nodeName: "Node 1",
          nodeDescription: "Entry node",
          mapId: "vendor-map",
          nodePosition: { x: 1, y: 2 },
          vehicleTypeNodeProperties: [{
            vehicleTypeId: "forklift",
            theta: 0.5,
            actions: [{ actionType: "load", blockingType: "HARD" }],
          }],
        }, {
          nodeId: "n2",
          nodePosition: { x: 3, y: 2 },
          vehicleTypeNodeProperties: [{ vehicleTypeId: "forklift" }],
        }],
        edges: [{
          edgeId: "e1",
          edgeName: "Edge 1",
          edgeDescription: "One-way aisle",
          startNodeId: "n1",
          endNodeId: "n2",
          vehicleTypeEdgeProperties: [{
            vehicleTypeId: "forklift",
            maxSpeed: 1.2,
            maxRotationSpeed: 0.4,
            loadRestriction: { loaded: true, unloaded: true, loadSetNames: ["pallet"] },
            trajectory: {
              degree: 2,
              knotVector: [0, 0, 0, 1, 1, 1],
              controlPoints: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 2 }],
            },
          }, {
            vehicleTypeId: "tugger",
            maxSpeed: 0.8,
          }],
        }],
        stations: [{
          stationId: "dock",
          stationName: "Dock",
          interactionNodeIds: ["n1"],
          stationPosition: { x: 1, y: 2, theta: 0 },
        }],
      }],
    });

    expect(imported.nodes[0]?.theta).toBe(0.5);

    const exported = exportLifDocument(imported);
    const layout = exported.layouts[0]!;
    expect(layout.layoutLevelId).toBe("floor-1");
    expect(layout.layoutDescription).toBe("Imported from an external editor.");
    expect(layout.stations[0]?.stationId).toBe("dock");
    expect(layout.nodes[0]?.mapId).toBe("vendor-map");
    expect(layout.nodes[0]?.nodeDescription).toBe("Entry node");
    expect(layout.nodes[0]?.vehicleTypeNodeProperties[0]?.vehicleTypeId).toBe("forklift");
    expect(layout.nodes[0]?.vehicleTypeNodeProperties[0]?.actions).toHaveLength(1);
    expect(layout.edges[0]?.edgeDescription).toBe("One-way aisle");
    expect(layout.edges[0]?.vehicleTypeEdgeProperties).toHaveLength(2);
    expect(layout.edges[0]?.vehicleTypeEdgeProperties[0]?.vehicleTypeId).toBe("forklift");
    expect(layout.edges[0]?.vehicleTypeEdgeProperties[0]?.maxRotationSpeed).toBe(0.4);
    expect(layout.edges[0]?.vehicleTypeEdgeProperties[1]?.vehicleTypeId).toBe("tugger");
  });

  it("rejects documents that do not match the vdma-lif model", () => {
    expect(() => importLifDocument({ layouts: [] })).toThrow(/Invalid LIF document/);
  });
});

describe("VDA order generation", () => {
  it("builds alternating node and edge sequence ids", () => {
    const map = createDemoMap();
    const order = buildVdaOrder(map, {
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1", "corr-2"],
    }, "order-test");

    expect(order.orderId).toBe("order-test");
    expect(order.nodes.map((node) => node.sequenceId)).toEqual([0, 2, 4]);
    expect(order.edges.map((edge) => edge.sequenceId)).toEqual([1, 3]);
  });
});
