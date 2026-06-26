import { describe, expect, it } from "vitest";
import { LIFParser } from "vdma-lif";
import {
  appendEdge,
  appendNode,
  applyMapOps,
  buildVdaOrder,
  copyBifurcatedEdgeProperties,
  createQuadraticBezierTrajectory,
  createDemoMap,
  createEmptyMap,
  edgesShareQuadraticHandle,
  findEdgeById,
  getQuadraticBezierPoseAtDistance,
  exportLifDocument,
  importLifDocument,
  isSupportedQuadraticBezier,
  moveNode,
  nextRouteId,
  pointsMatch,
  removeEdge,
  removeNode,
  replaceEdge,
  replaceEdgeWith,
  replaceNode,
  resetReverseEdgeToSelectedCurvePath,
  splitEdge,
  splitQuadraticTrajectory,
  validateMap,
  validateRoute,
  validateRouteDocument,
  type MapDocument,
  type MapEdge,
  type MapNode,
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

  it("accepts supported quadratic edge trajectories and rejects malformed trajectory values", () => {
    const map = createDemoMap();
    map.edges[0]!.trajectory = createQuadraticBezierTrajectory(
      map.nodes.find((node) => node.id === map.edges[0]!.from)!,
      map.nodes.find((node) => node.id === map.edges[0]!.to)!,
      { x: 2.5, y: 2 }
    );

    expect(isSupportedQuadraticBezier(map.edges[0]!.trajectory)).toBe(true);
    expect(validateMap(map)).toEqual([]);

    map.edges[0]!.trajectory = {
      degree: 2,
      knotVector: [0, 0, 0, 1, 1, 1],
      controlPoints: [{ x: 0, y: 0 }, { x: Number.NaN, y: 2 }, { x: 5, y: 0 }],
    };

    expect(validateMap(map)[0]?.code).toBe("edge.trajectory.invalid");
  });

  it("samples a quadratic trajectory midpoint and tangent", () => {
    const trajectory = createQuadraticBezierTrajectory(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 }
    );
    const pose = getQuadraticBezierPoseAtDistance(trajectory, 7.5);

    expect(pose.y).toBeGreaterThan(3);
    expect(pose.totalLength).toBeGreaterThan(10);
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

  it("imports external LIF files with blank export timestamps", () => {
    const imported = importLifDocument({
      metaInformation: {
        projectIdentification: "External Layout",
        creator: "",
        exportTimestamp: "",
        lifVersion: "1.0.0",
      },
      layouts: [{
        layoutId: "entry",
        layoutName: "Entry",
        layoutVersion: "1",
        nodes: [{
          nodeId: "n1",
          nodeName: "n1",
          nodePosition: { x: -24.931, y: 3.06 },
          vehicleTypeNodeProperties: [],
        }, {
          nodeId: "n2",
          nodeName: "n2",
          nodePosition: { x: -15.3, y: 21.42 },
          vehicleTypeNodeProperties: [],
        }],
        edges: [{
          edgeId: "n1_n2",
          edgeName: "n1_n2",
          startNodeId: "n1",
          endNodeId: "n2",
          vehicleTypeEdgeProperties: [],
        }],
        stations: [],
      }],
    });

    expect(imported.id).toBe("entry");
    expect(imported.nodes).toHaveLength(2);
    expect(imported.edges).toHaveLength(1);
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

  it("includes synced edge trajectories in VDA orders", () => {
    const map = createDemoMap();
    const edge = map.edges.find((item) => item.from === "dock-a" && item.to === "corr-1")!;
    edge.trajectory = createQuadraticBezierTrajectory(
      { x: -100, y: -100 },
      { x: 100, y: 100 },
      { x: 2.5, y: 2 }
    );

    const order = buildVdaOrder(map, {
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
    }, "order-test");

    expect(order.edges[0]?.trajectory?.degree).toBe(2);
    expect(order.edges[0]?.trajectory?.controlPoints[0]).toMatchObject({ x: 0, y: 0 });
    expect(order.edges[0]?.trajectory?.controlPoints[2]).toMatchObject({ x: 5, y: 0 });
  });
});

describe("edge bifurcation / trajectory geometry", () => {
  function makeEdge(overrides: Partial<MapEdge> = {}): MapEdge {
    return {
      id: "a-b",
      label: "A -> B",
      from: "a",
      to: "b",
      orientationType: "TANGENTIAL",
      rotationAllowed: true,
      trajectory: null,
      ...overrides,
    };
  }

  it("matches points within a 1e-6 tolerance", () => {
    // |Δ| strictly below 1e-6 on both axes counts as a match.
    expect(pointsMatch({ x: 0, y: 0 }, { x: 0.0000005, y: -0.0000005 })).toBe(true);
    expect(pointsMatch({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
    // A 1e-3 gap is far outside tolerance.
    expect(pointsMatch({ x: 0, y: 0 }, { x: 0.001, y: 0 })).toBe(false);
    // Exactly 1e-6 is NOT below the threshold (strict <), so it must not match.
    expect(pointsMatch({ x: 0, y: 0 }, { x: 0.000001, y: 0 })).toBe(false);
  });

  it("subdivides a quadratic at its midpoint via de Casteljau", () => {
    // Curve start={0,0}, handle={4,4}, end={8,0}; its t=0.5 point is {4,2}.
    const trajectory = createQuadraticBezierTrajectory(
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 4, y: 4 }
    );
    const splitPoint = { id: "m", label: "m", x: 4, y: 2 };

    // first half handle = midpoint(start, handle) = {2,2}; endpoint = split point.
    const first = splitQuadraticTrajectory(trajectory, "first", splitPoint);
    expect(first?.controlPoints).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
    ]);

    // second half handle = midpoint(handle, end) = {6,2}; start = split point.
    const second = splitQuadraticTrajectory(trajectory, "second", splitPoint);
    expect(second?.controlPoints).toEqual([
      { x: 4, y: 2 },
      { x: 6, y: 2 },
      { x: 8, y: 0 },
    ]);
  });

  it("returns null when subdividing a trajectory without three control points", () => {
    const degenerate = {
      degree: 2,
      knotVector: [0, 0, 1, 1],
      controlPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    expect(splitQuadraticTrajectory(degenerate, "first", { id: "m", label: "m", x: 0, y: 0 })).toBeNull();
  });

  it("copies only the bifurcation-relevant edge properties", () => {
    const copied = copyBifurcatedEdgeProperties(
      makeEdge({ maxSpeed: 1.2, orientation: 0.5, orientationType: "GLOBAL", rotationAllowed: false })
    );
    // Identity/geometry fields are intentionally dropped so the caller assigns fresh ones.
    expect(copied).toEqual({
      maxSpeed: 1.2,
      orientation: 0.5,
      orientationType: "GLOBAL",
      rotationAllowed: false,
    });
    expect("id" in copied).toBe(false);
    expect("trajectory" in copied).toBe(false);
  });

  it("omits optional edge properties that are undefined", () => {
    const copied = copyBifurcatedEdgeProperties(
      makeEdge({ maxSpeed: undefined, orientation: undefined })
    );
    // maxSpeed/orientation keys must be absent (not present-but-undefined).
    expect("maxSpeed" in copied).toBe(false);
    expect("orientation" in copied).toBe(false);
    expect(copied).toEqual({ orientationType: "TANGENTIAL", rotationAllowed: true });
  });

  it("detects when two edges share the same quadratic handle", () => {
    const edge = makeEdge({
      trajectory: createQuadraticBezierTrajectory({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 2.5, y: 1.25 }),
    });
    const sameHandle = makeEdge({
      trajectory: createQuadraticBezierTrajectory({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 2.5, y: 1.25 }),
    });
    const otherHandle = makeEdge({
      trajectory: createQuadraticBezierTrajectory({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 2.5, y: -3 }),
    });
    const straight = makeEdge({ trajectory: null });

    expect(edgesShareQuadraticHandle(edge, sameHandle)).toBe(true);
    expect(edgesShareQuadraticHandle(edge, otherHandle)).toBe(false);
    // A straight edge has no quadratic handle to share.
    expect(edgesShareQuadraticHandle(edge, straight)).toBe(false);
  });

  it("splits a straight edge at its geometric midpoint and copies properties", () => {
    const map = {
      ...createEmptyMap("Line"),
      nodes: [
        { id: "a", label: "A", x: 0, y: 0 },
        { id: "b", label: "B", x: 4, y: 2 },
      ],
      edges: [makeEdge({ from: "a", to: "b", maxSpeed: 1.5, orientationType: "GLOBAL", rotationAllowed: false })],
    };
    const edge = map.edges[0]!;
    const split = splitEdge(edge, map.nodes[0]!, map.nodes[1]!, map);

    expect(split).not.toBeNull();
    // Midpoint of {0,0}-{4,2}; first free n-id with two existing nodes is n-3.
    expect(split!.node).toMatchObject({ id: "n-3", x: 2, y: 1 });
    const [first, second] = split!.edges;
    expect(`${first.from}->${first.to}`).toBe("a->n-3");
    expect(`${second.from}->${second.to}`).toBe("n-3->b");
    // Straight edge -> both halves stay straight (null trajectory).
    expect(first.trajectory).toBeNull();
    expect(second.trajectory).toBeNull();
    // Copied properties propagate to both halves.
    expect(first.maxSpeed).toBe(1.5);
    expect(second.orientationType).toBe("GLOBAL");
    expect(second.rotationAllowed).toBe(false);
  });

  it("splits a curved edge so each half keeps the curve shape", () => {
    const map = {
      ...createEmptyMap("Curve"),
      nodes: [
        { id: "a", label: "A", x: 0, y: 0 },
        { id: "b", label: "B", x: 8, y: 0 },
      ],
      edges: [
        makeEdge({
          from: "a",
          to: "b",
          trajectory: createQuadraticBezierTrajectory({ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 4, y: 4 }),
        }),
      ],
    };
    const edge = map.edges[0]!;
    const split = splitEdge(edge, map.nodes[0]!, map.nodes[1]!, map);

    expect(split).not.toBeNull();
    // Split node sits at the curve's t=0.5 point {4,2}.
    expect(split!.node).toMatchObject({ x: 4, y: 2 });
    const [first, second] = split!.edges;
    expect(first.trajectory?.controlPoints).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
    ]);
    expect(second.trajectory?.controlPoints).toEqual([
      { x: 4, y: 2 },
      { x: 6, y: 2 },
      { x: 8, y: 0 },
    ]);
  });

  it("returns null when splitting an unsupported (non-quadratic) trajectory", () => {
    const map = {
      ...createEmptyMap("Cubic"),
      nodes: [
        { id: "a", label: "A", x: 0, y: 0 },
        { id: "b", label: "B", x: 5, y: 0 },
      ],
      edges: [
        makeEdge({
          from: "a",
          to: "b",
          trajectory: {
            degree: 3,
            knotVector: [0, 0, 0, 0, 1, 1, 1, 1],
            controlPoints: [{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 0 }],
          },
        }),
      ],
    };
    const edge = map.edges[0]!;
    expect(splitEdge(edge, map.nodes[0]!, map.nodes[1]!, map)).toBeNull();
  });

  it("resets a reverse edge to reuse the selected edge's quadratic handle", () => {
    const from = { id: "b", label: "B", x: 5, y: 0 };
    const to = { id: "a", label: "A", x: 0, y: 0 };
    const reverseEdge = makeEdge({ from: "b", to: "a", trajectory: null });
    const selectedEdge = makeEdge({
      from: "a",
      to: "b",
      trajectory: createQuadraticBezierTrajectory({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 2.5, y: 3 }),
    });

    const result = resetReverseEdgeToSelectedCurvePath(reverseEdge, from, to, selectedEdge);
    // Reverse edge spans b(5,0) -> a(0,0) but reuses the selected handle {2.5,3}.
    expect(result.trajectory?.controlPoints).toEqual([
      { x: 5, y: 0 },
      { x: 2.5, y: 3 },
      { x: 0, y: 0 },
    ]);
  });

  it("falls back to a default-handle curve when the selected edge is not a supported quadratic", () => {
    const from = { id: "b", label: "B", x: 5, y: 0 };
    const to = { id: "a", label: "A", x: 0, y: 0 };
    const reverseEdge = makeEdge({ from: "b", to: "a", trajectory: null });
    const selectedEdge = makeEdge({ from: "a", to: "b", trajectory: null });

    const result = resetReverseEdgeToSelectedCurvePath(reverseEdge, from, to, selectedEdge);
    expect(isSupportedQuadraticBezier(result.trajectory)).toBe(true);
    // Endpoints follow from/to; the handle is the auto-generated default, not {2.5,3}.
    expect(result.trajectory?.controlPoints[0]).toMatchObject({ x: 5, y: 0 });
    expect(result.trajectory?.controlPoints[2]).toMatchObject({ x: 0, y: 0 });
    expect(result.trajectory?.controlPoints[1]).not.toMatchObject({ x: 2.5, y: 3 });
  });
});

describe("map operations", () => {
  function node(id: string, x: number, y: number): MapNode {
    return { id, label: id, x, y };
  }

  function straightEdge(from: string, to: string): MapEdge {
    return {
      id: `${from}-${to}`,
      label: `${from} -> ${to}`,
      from,
      to,
      orientationType: "TANGENTIAL",
      rotationAllowed: true,
      trajectory: null,
    };
  }

  // Line a→b→c with a back-edge b→a, so every edge is incident to `b`.
  function baseMap(): MapDocument {
    return {
      ...createEmptyMap("Ops"),
      nodes: [node("a", 0, 0), node("b", 4, 0), node("c", 8, 0)],
      edges: [straightEdge("a", "b"), straightEdge("b", "c"), straightEdge("b", "a")],
    };
  }

  it("appends nodes and edges without mutating the source map", () => {
    const map = baseMap();
    const withNode = appendNode(node("d", 1, 1))(map);
    const withEdge = appendEdge(straightEdge("a", "c"))(map);

    expect(withNode.nodes.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(findEdgeById(withEdge, "a-c")).toBeTruthy();
    expect(map.nodes).toHaveLength(3);
    expect(map.edges).toHaveLength(3);
  });

  it("removes a node together with every incident edge", () => {
    const next = removeNode("b")(baseMap());
    expect(next.nodes.some((item) => item.id === "b")).toBe(false);
    expect(next.edges).toHaveLength(0);
  });

  it("removes a single edge by id", () => {
    const next = removeEdge("a-b")(baseMap());
    expect(findEdgeById(next, "a-b")).toBeUndefined();
    expect(next.edges.map((item) => item.id)).toEqual(["b-c", "b-a"]);
  });

  it("moves a node and re-syncs the endpoints of incident curves", () => {
    const map = baseMap();
    const [a, b] = [map.nodes[0]!, map.nodes[1]!];
    map.edges[0] = { ...map.edges[0]!, trajectory: createQuadraticBezierTrajectory(a, b, { x: 2, y: 2 }) };

    const next = moveNode("a", -1, -1)(map);

    expect(next.nodes.find((item) => item.id === "a")).toMatchObject({ x: -1, y: -1 });
    expect(findEdgeById(next, "a-b")?.trajectory?.controlPoints[0]).toMatchObject({ x: -1, y: -1 });
    // source map untouched
    expect(map.nodes.find((item) => item.id === "a")).toMatchObject({ x: 0, y: 0 });
  });

  it("replaces a node, rewriting edge references and syncing endpoints when the id changes", () => {
    const map = baseMap();
    const [a, b] = [map.nodes[0]!, map.nodes[1]!];
    map.edges[0] = { ...map.edges[0]!, trajectory: createQuadraticBezierTrajectory(a, b, { x: 2, y: 2 }) };

    const next = replaceNode("a", node("alpha", -2, -2))(map);

    expect(next.nodes.map((item) => item.id)).toEqual(["alpha", "b", "c"]);
    expect(findEdgeById(next, "a-b")?.from).toBe("alpha");
    expect(next.edges.find((edge) => edge.to === "alpha")).toBeTruthy();
    expect(findEdgeById(next, "a-b")?.trajectory?.controlPoints[0]).toMatchObject({ x: -2, y: -2 });
  });

  it("replaces one edge by id", () => {
    const map = baseMap();
    const next = replaceEdge("a-b", { ...map.edges[0]!, label: "renamed" })(map);
    expect(findEdgeById(next, "a-b")?.label).toBe("renamed");
    expect(findEdgeById(next, "b-c")?.label).toBe("b -> c");
  });

  it("splices replacements in place, ignoring an absent target id", () => {
    const map = baseMap();
    const spliced = replaceEdgeWith("a-b", [straightEdge("a", "m"), straightEdge("m", "b")])(map);
    expect(spliced.edges.map((item) => item.id)).toEqual(["a-m", "m-b", "b-c", "b-a"]);

    const unchanged = replaceEdgeWith("absent", [straightEdge("a", "c")])(map);
    expect(unchanged.edges.map((item) => item.id)).toEqual(["a-b", "b-c", "b-a"]);
  });

  it("composes operations left-to-right, skips falsy entries, and never stamps updatedAt", () => {
    const map = baseMap();
    const next = applyMapOps(map, [appendNode(node("d", 1, 1)), false, removeEdge("b-a"), null]);

    expect(next.nodes.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(findEdgeById(next, "b-a")).toBeUndefined();
    expect(next.updatedAt).toBe(map.updatedAt);
  });
});
