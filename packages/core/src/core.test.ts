import { describe, expect, it } from "vitest";
import { LIFParser } from "vdma-lif";
import {
  appendEdge,
  appendNode,
  applyMapOps,
  backfillCanvas,
  buildMapIndex,
  buildVdaOrder,
  clampViewportToFloor,
  retryUntil,
  copyBifurcatedEdgeProperties,
  createQuadraticBezierTrajectory,
  createDemoMap,
  createEmptyMap,
  DEFAULT_CANVAS_SIZE,
  edgesShareQuadraticHandle,
  emptyViewport,
  findEdgeById,
  fitViewportToContent,
  floorBounds,
  floorSizeForImageAspect,
  fitCanvasToContent,
  getQuadraticBezierPoseAtDistance,
  gridStepForViewport,
  MIN_VIEWPORT_WIDTH,
  recalibrateCanvas,
  recenterMapOnFloor,
  exportLifDocument,
  getStationNodeIds,
  getSupportNodeIds,
  nodeHasLabel,
  importLifDocument,
  nodeIdEditPolicy,
  isActionNode,
  isSupportNode,
  isSupportedQuadraticBezier,
  moveNode,
  nextRouteId,
  pointsMatch,
  edgeFromToKey,
  resolveRoute,
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
  type CanvasSize,
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

  it("keys directed edges without colliding on ids that contain the delimiter", () => {
    // Ids arrive verbatim from LIF import / the inspector, so they may contain spaces.
    expect(edgeFromToKey("a", "b c")).not.toBe(edgeFromToKey("a b", "c"));
  });

  it("resolves a route to the exact directed edge when node ids contain spaces", () => {
    const node = (id: string): MapNode => ({ id, label: "", x: 0, y: 0 });
    const edge = (id: string, from: string, to: string): MapEdge => ({
      id, label: "", from, to, orientationType: "TANGENTIAL", rotationAllowed: true, trajectory: null,
    });
    const map: MapDocument = {
      id: "collide", name: "collide", version: "1", createdAt: "t", updatedAt: "t",
      canvas: DEFAULT_CANVAS_SIZE,
      nodes: [node("a"), node("b c"), node("a b"), node("c")],
      // "a b"->"c" is listed first, so a colliding key would have first-match-wins hand it back.
      edges: [edge("wrong", "a b", "c"), edge("right", "a", "b c")],
    };

    const { edges, issues } = resolveRoute(map, ["a", "b c"]);
    expect(edges[0]?.id).toBe("right");
    expect(issues).toEqual([]);
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

  it("round-trips a blank-label support node so it survives export and re-import", () => {
    const map: MapDocument = {
      ...createEmptyMap("Support Round-trip"),
      nodes: [
        { id: "n1", label: "", x: 1, y: 2 },
        { id: "n2", label: "Dock", x: 3, y: 4 },
      ],
      edges: [{
        id: "n1-n2",
        label: "n1 -> n2",
        from: "n1",
        to: "n2",
        orientationType: "TANGENTIAL",
        rotationAllowed: true,
        trajectory: null,
      }],
    };

    const exported = exportLifDocument(map);
    expect(LIFParser.fromJson(JSON.stringify(exported))).not.toBeNull();

    const imported = importLifDocument(exported);
    const reimported = imported.nodes.find((node) => node.id === "n1");
    expect(reimported?.label).toBe("");
    const supportIds = imported.nodes
      .filter((node) => isSupportNode(node, getStationNodeIds(imported)))
      .map((node) => node.id);
    expect(supportIds).toEqual(["n1"]);
  });

  it("shifts off-floor plant coordinates onto the finite floor on import", () => {
    const imported = importLifDocument({
      metaInformation: { projectIdentification: "Plant", creator: "ext", exportTimestamp: "", lifVersion: "1.0.0" },
      layouts: [{
        layoutId: "plant",
        layoutName: "Plant",
        layoutVersion: "1",
        nodes: [
          { nodeId: "a", nodeName: "a", nodePosition: { x: -24.931, y: 3.06 }, vehicleTypeNodeProperties: [] },
          { nodeId: "b", nodeName: "b", nodePosition: { x: -15.3, y: 21.42 }, vehicleTypeNodeProperties: [] },
        ],
        edges: [],
        stations: [],
      }],
    });

    expect(imported.nodes.every((node) => node.x >= 0 && node.y >= 0)).toBe(true);
    expect(imported.nodes[0]!.x).toBeCloseTo(0, 3);
    expect(imported.nodes[1]!.x - imported.nodes[0]!.x).toBeCloseTo(9.631, 3);
  });

  it("rejects documents that do not match the vdma-lif model", () => {
    expect(() => importLifDocument({ layouts: [] })).toThrow(/Invalid LIF document/);
  });
});

describe("fitCanvasToContent", () => {
  const withNodes = (nodes: MapNode[], edges: MapEdge[] = []): MapDocument => ({
    ...createEmptyMap("Fit"),
    nodes,
    edges,
  });

  it("leaves content already within the floor untouched", () => {
    const map = withNodes([{ id: "a", label: "A", x: 10, y: 20 }]);
    expect(fitCanvasToContent(map)).toBe(map);
  });

  it("shifts negative coordinates into the positive quadrant without scaling", () => {
    const map = withNodes([
      { id: "a", label: "A", x: -30, y: 5 },
      { id: "b", label: "B", x: 10, y: 40 },
    ]);
    const fitted = fitCanvasToContent(map);
    expect(fitted.nodes.map((node) => [node.x, node.y])).toEqual([[0, 5], [40, 40]]);
    expect(fitted.canvas).toEqual(DEFAULT_CANVAS_SIZE);
  });

  it("grows the floor to contain oversized content, preserving coordinates", () => {
    const map = withNodes([
      { id: "a", label: "A", x: 0, y: 0 },
      { id: "b", label: "B", x: 500, y: 300 },
    ]);
    const fitted = fitCanvasToContent(map);
    expect(fitted.canvas).toEqual({ width: 500, height: 300 });
    expect(fitted.nodes.map((node) => [node.x, node.y])).toEqual([[0, 0], [500, 300]]);
  });

  it("translates edge trajectory control points alongside nodes", () => {
    const map = withNodes(
      [{ id: "a", label: "A", x: -10, y: 0 }, { id: "b", label: "B", x: 10, y: 0 }],
      [{
        id: "a-b",
        label: "a -> b",
        from: "a",
        to: "b",
        orientationType: "TANGENTIAL",
        rotationAllowed: true,
        trajectory: {
          degree: 2,
          knotVector: [0, 0, 0, 1, 1, 1],
          controlPoints: [{ x: -10, y: 0 }, { x: 0, y: -5 }, { x: 10, y: 0 }],
        },
      }],
    );
    const fitted = fitCanvasToContent(map);
    expect(fitted.nodes[0]!.x).toBe(0);
    expect(fitted.edges[0]!.trajectory!.controlPoints).toEqual([
      { x: 0, y: 5 },
      { x: 10, y: 0 },
      { x: 20, y: 5 },
    ]);
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
    // Endpoints sync to the demo nodes, now floor-centered (dock-a, corr-1).
    expect(order.edges[0]?.trajectory?.controlPoints[0]).toMatchObject({ x: 92.5, y: 95 });
    expect(order.edges[0]?.trajectory?.controlPoints[2]).toMatchObject({ x: 97.5, y: 95 });
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
    expect(pointsMatch({ x: 0, y: 0 }, { x: 0.0000005, y: -0.0000005 })).toBe(true);
    expect(pointsMatch({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(pointsMatch({ x: 0, y: 0 }, { x: 0.001, y: 0 })).toBe(false);
    expect(pointsMatch({ x: 0, y: 0 }, { x: 0.000001, y: 0 })).toBe(false);
  });

  it("subdivides a quadratic at its midpoint via de Casteljau", () => {
    const trajectory = createQuadraticBezierTrajectory(
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 4, y: 4 }
    );
    const splitPoint = { id: "m", label: "m", x: 4, y: 2 };

    const first = splitQuadraticTrajectory(trajectory, "first", splitPoint);
    expect(first?.controlPoints).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
    ]);

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
    expect(split!.node).toMatchObject({ id: "n-3", x: 2, y: 1 });
    expect(split!.node.label).toBe("");
    const [first, second] = split!.edges;
    expect(`${first.from}->${first.to}`).toBe("a->n-3");
    expect(`${second.from}->${second.to}`).toBe("n-3->b");
    expect(first.trajectory).toBeNull();
    expect(second.trajectory).toBeNull();
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

  // Every edge is incident to `b`, so removeNode("b") drops them all.
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

describe("station-node selector", () => {
  function node(id: string, unsupported?: MapNode["unsupported"]): MapNode {
    return { id, label: id, x: 0, y: 0, ...(unsupported ? { unsupported } : {}) };
  }

  function mapWith(nodes: MapNode[], unsupported?: MapDocument["unsupported"]): MapDocument {
    return {
      ...createEmptyMap("Stations"),
      nodes,
      edges: [],
      ...(unsupported ? { unsupported } : {}),
    };
  }

  it("includes a node referenced by a station's interactionNodeIds", () => {
    const map = mapWith(
      [node("station-node")],
      { stations: [{ stationId: "s1", interactionNodeIds: ["station-node"] }] }
    );
    expect([...getStationNodeIds(map)]).toEqual(["station-node"]);
  });

  it("excludes a node that merely carries its own actions but is not in any station", () => {
    const map = mapWith([
      node("act", { vehicleTypeNodeProperties: [{ vehicleTypeId: "default", actions: [{ actionType: "pick" }] }] }),
    ]);
    expect(getStationNodeIds(map).size).toBe(0);
  });

  it("returns an empty set when station data is missing or empty", () => {
    expect(getStationNodeIds(mapWith([node("a")])).size).toBe(0);
    expect(getStationNodeIds(mapWith([node("a")], {})).size).toBe(0);
    expect(getStationNodeIds(mapWith([node("a")], { stations: [] })).size).toBe(0);
  });
});

describe("node role predicates", () => {
  function node(id: string, label: string, unsupported?: MapNode["unsupported"]): MapNode {
    return { id, label, x: 0, y: 0, ...(unsupported ? { unsupported } : {}) };
  }
  const noStations: ReadonlySet<string> = new Set();

  it("isSupportNode: a plain unlabeled node with no role is a support node", () => {
    expect(isSupportNode(node("plain", ""), noStations)).toBe(true);
  });

  it("isSupportNode: a labeled node is not a support node", () => {
    expect(isSupportNode(node("labeled", "Dock A"), noStations)).toBe(false);
  });

  it("isActionNode: a node carrying its own actions is an action node, never support", () => {
    const withActions = node("act", "", {
      vehicleTypeNodeProperties: [{ vehicleTypeId: "default", actions: [{ actionType: "pick" }] }],
    });
    expect(isActionNode(withActions, noStations)).toBe(true);
    expect(isSupportNode(withActions, noStations)).toBe(false);
  });

  it("isActionNode: a station-referenced node is an action node via stationNodeIds, never support", () => {
    const stationNode = node("station-node", "");
    const stationNodeIds = new Set(["station-node"]);
    expect(isActionNode(stationNode, stationNodeIds)).toBe(true);
    expect(isSupportNode(stationNode, stationNodeIds)).toBe(false);
  });

  it("isActionNode: a node with an empty actions array and no station reference is not an action node", () => {
    const plain = node("plain", "plain", {
      vehicleTypeNodeProperties: [{ vehicleTypeId: "default", actions: [] }],
    });
    expect(isActionNode(plain, noStations)).toBe(false);
  });

  it("isActionNode: a node with no unsupported data is not an action node", () => {
    expect(isActionNode(node("bare", "bare"), noStations)).toBe(false);
  });
});

describe("buildMapIndex", () => {
  function node(id: string, unsupported?: MapNode["unsupported"]): MapNode {
    return { id, label: id, x: 0, y: 0, ...(unsupported ? { unsupported } : {}) };
  }
  function edge(id: string, from: string, to: string): MapEdge {
    return { id, label: `${from} -> ${to}`, from, to, orientationType: "TANGENTIAL", rotationAllowed: true, trajectory: null };
  }
  function mapWith(nodes: MapNode[], edges: MapEdge[], unsupported?: MapDocument["unsupported"]): MapDocument {
    return { ...createEmptyMap("Index"), nodes, edges, ...(unsupported ? { unsupported } : {}) };
  }

  it("resolves nodes and edges by id", () => {
    const index = buildMapIndex(mapWith([node("a"), node("b")], [edge("e1", "a", "b")]));
    expect(index.nodeById.get("a")?.id).toBe("a");
    expect(index.nodeById.get("missing")).toBeUndefined();
    expect(index.edgeById.get("e1")?.id).toBe("e1");
  });

  it("carries stationNodeIds equal to getStationNodeIds", () => {
    const map = mapWith([node("station-node")], [], {
      stations: [{ stationId: "s1", interactionNodeIds: ["station-node"] }],
    });
    const index = buildMapIndex(map);
    expect([...index.stationNodeIds]).toEqual([...getStationNodeIds(map)]);
    expect([...index.stationNodeIds]).toEqual(["station-node"]);
  });
});

describe("nodeHasLabel", () => {
  function node(label: string): MapNode {
    return { id: "n", label, x: 0, y: 0 };
  }

  it("is false for an empty or whitespace-only label", () => {
    expect(nodeHasLabel(node(""))).toBe(false);
    expect(nodeHasLabel(node("   "))).toBe(false);
  });

  it("is true for a non-empty label", () => {
    expect(nodeHasLabel(node("Dock A"))).toBe(true);
  });
});

describe("support-node selector", () => {
  function node(id: string, label: string, unsupported?: MapNode["unsupported"]): MapNode {
    return { id, label, x: 0, y: 0, ...(unsupported ? { unsupported } : {}) };
  }

  function mapWith(nodes: MapNode[], unsupported?: MapDocument["unsupported"]): MapDocument {
    return {
      ...createEmptyMap("Support"),
      nodes,
      edges: [],
      ...(unsupported ? { unsupported } : {}),
    };
  }

  it("includes a node with no label and no actions", () => {
    expect([...getSupportNodeIds(mapWith([node("plain", "")]))]).toEqual(["plain"]);
  });

  it("excludes a node with a non-empty label even when it has no actions", () => {
    expect(getSupportNodeIds(mapWith([node("labeled", "Dock A")])).size).toBe(0);
  });

  it("excludes a node with actions even when its label is blank", () => {
    const map = mapWith([
      node("act", "", { vehicleTypeNodeProperties: [{ vehicleTypeId: "default", actions: [{ actionType: "pick" }] }] }),
    ]);
    expect(getSupportNodeIds(map).size).toBe(0);
  });

  it("excludes a station-referenced node even when its label is blank", () => {
    const map = mapWith(
      [node("station-node", "")],
      { stations: [{ stationId: "s1", interactionNodeIds: ["station-node"] }] }
    );
    expect(getSupportNodeIds(map).size).toBe(0);
  });
});

describe("node id edit policy", () => {
  it("is editable when nothing references the node", () => {
    expect(
      nodeIdEditPolicy({ hasEdges: false, isStationReferenced: false, isRouteReferenced: false })
    ).toBe("editable");
  });

  it("warns about edges when the node only has edges", () => {
    expect(
      nodeIdEditPolicy({ hasEdges: true, isStationReferenced: false, isRouteReferenced: false })
    ).toBe("editable-with-edge-warning");
  });

  it("locks when a station or route references the node, even alongside edges", () => {
    expect(
      nodeIdEditPolicy({ hasEdges: false, isStationReferenced: true, isRouteReferenced: false })
    ).toBe("locked");
    expect(
      nodeIdEditPolicy({ hasEdges: false, isStationReferenced: false, isRouteReferenced: true })
    ).toBe("locked");
    expect(
      nodeIdEditPolicy({ hasEdges: true, isStationReferenced: true, isRouteReferenced: true })
    ).toBe("locked");
  });
});

describe("finite floor geometry", () => {
  const canvas = { width: 200, height: 200 };

  function floorMap(nodes: MapNode[], edges: MapEdge[] = []): MapDocument {
    return { ...createEmptyMap("Floor"), canvas, nodes, edges };
  }

  function node(id: string, x: number, y: number): MapNode {
    return { id, label: id, x, y };
  }

  it("defaults new maps to a 200x200 m floor", () => {
    expect(createEmptyMap().canvas).toEqual(DEFAULT_CANVAS_SIZE);
    expect(createDemoMap().canvas).toEqual({ width: 200, height: 200 });
  });

  it("centers the demo grid bounding box on the floor", () => {
    const demo = createDemoMap();
    const xs = demo.nodes.map((item) => item.x);
    const ys = demo.nodes.map((item) => item.y);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBe(100);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBe(100);
    // Every demo node is on the floor and the map validates with its canvas.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(demo.canvas.width);
    expect(Math.max(...ys)).toBeLessThanOrEqual(demo.canvas.height);
    expect(validateMap(demo)).toEqual([]);
  });

  it("derives the floor rectangle from the canvas size", () => {
    expect(floorBounds({ width: 120, height: 80 })).toEqual({ x: 0, y: 0, width: 120, height: 80 });
  });

  it("reshapes the floor to a background image aspect, keeping width", () => {
    expect(floorSizeForImageAspect(200, 2)).toEqual({ width: 200, height: 100 });
    expect(floorSizeForImageAspect(200, 0.5)).toEqual({ width: 200, height: 400 });
    expect(floorSizeForImageAspect(200, 1)).toEqual({ width: 200, height: 200 });
    expect(floorSizeForImageAspect(200, 0)).toEqual({ width: 200, height: 200 });
    expect(floorSizeForImageAspect(200, Number.NaN)).toEqual({ width: 200, height: 200 });
  });

  it("clamps zoom-in to the minimum viewport width, preserving aspect", () => {
    const clamped = clampViewportToFloor({ x: 100, y: 100, width: 1, height: 0.5 }, canvas);
    expect(clamped.width).toBe(MIN_VIEWPORT_WIDTH);
    expect(clamped.width / clamped.height).toBeCloseTo(2, 10);
  });

  it("zoom-out stops at the whole floor, centered with a breathing margin", () => {
    const clamped = clampViewportToFloor({ x: -500, y: -500, width: 5000, height: 5000 }, canvas);
    expect(clamped.width).toBeGreaterThan(200);
    expect(clamped.width).toBeLessThan(240);
    expect(clamped.x).toBeCloseTo((200 - clamped.width) / 2, 10);
    expect(clamped.y).toBeCloseTo((200 - clamped.height) / 2, 10);
  });

  it("hard-clamps pan so the viewport never shows past a floor edge", () => {
    const span = { width: 20, height: 20 };
    const past = clampViewportToFloor({ x: 500, y: 500, ...span }, canvas);
    expect(past.x).toBe(180);
    expect(past.y).toBe(180);
    const before = clampViewportToFloor({ x: -50, y: -50, ...span }, canvas);
    expect(before.x).toBe(0);
    expect(before.y).toBe(0);
  });

  it("centers a fully-visible axis instead of letting it pan", () => {
    const clamped = clampViewportToFloor({ x: 70, y: 90, width: 400, height: 10 }, canvas);
    expect(clamped.x).toBeLessThan(0);
    expect(clamped.x).toBeCloseTo((200 - clamped.width) / 2, 10);
    expect(clamped.y).toBe(90);
  });

  it("fits to content (bbox + padding), clamped to the floor", () => {
    const map = floorMap([node("a", 100, 100), node("b", 110, 104)]);
    const fit = fitViewportToContent(map, 2);
    expect(fit.x + fit.width / 2).toBeCloseTo(105, 6);
    expect(fit.y + fit.height / 2).toBeCloseTo(102, 6);
    expect(fit.width).toBeGreaterThanOrEqual(14);
    expect(fit.x).toBeGreaterThanOrEqual(0);
  });

  it("opens an empty map ~20 m wide centered on the floor center", () => {
    const fit = fitViewportToContent(floorMap([]), 1);
    expect(fit.width).toBe(20);
    expect(fit.x + fit.width / 2).toBe(100);
    expect(fit.y + fit.height / 2).toBe(100);
    expect(emptyViewport(canvas, 1)).toEqual(fit);
  });

  it("recenters a corner map onto the floor center, preserving every dx/dy", () => {
    const map = floorMap(
      [node("a", -10, -5), node("b", 0, 5)],
      [{
        id: "a-b",
        label: "a -> b",
        from: "a",
        to: "b",
        orientationType: "TANGENTIAL",
        rotationAllowed: true,
        trajectory: createQuadraticBezierTrajectory({ x: -10, y: -5 }, { x: 0, y: 5 }, { x: -5, y: 0 }),
      }],
    );

    const moved = recenterMapOnFloor(map);
    // bbox (-10,-5)->(0,5), center (-5,0) -> floor center (100,100): offset (+105,+100).
    expect(moved.nodes.map((item) => [item.x, item.y])).toEqual([[95, 95], [105, 105]]);
    expect(moved.edges[0]!.trajectory!.controlPoints.map((p) => [p.x, p.y])).toEqual([[95, 95], [100, 100], [105, 105]]);
    const xs = moved.nodes.map((item) => item.x);
    const ys = moved.nodes.map((item) => item.y);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBe(100);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBe(100);

    expect(headings(moved)).toEqual(headings(map));
  });

  it("preserves a trajectory tangent heading across the recenter translation", () => {
    const trajectory = createQuadraticBezierTrajectory({ x: -10, y: -5 }, { x: 0, y: 5 }, { x: -8, y: 4 });
    const map = floorMap(
      [node("a", -10, -5), node("b", 0, 5)],
      [{
        id: "a-b",
        label: "a -> b",
        from: "a",
        to: "b",
        orientationType: "TANGENTIAL",
        rotationAllowed: true,
        trajectory,
      }],
    );

    const tangentBefore = getQuadraticBezierPoseAtDistance(trajectory, 3).theta;
    const moved = recenterMapOnFloor(map);
    const tangentAfter = getQuadraticBezierPoseAtDistance(moved.edges[0]!.trajectory!, 3).theta;
    expect(tangentAfter).toBeCloseTo(tangentBefore, 12);
  });

  it("leaves an already-centered map untouched (same reference)", () => {
    const map = floorMap([node("a", 80, 80), node("b", 120, 120)]);
    expect(recenterMapOnFloor(map)).toBe(map);
  });

  it("backfills the default canvas and recenters a legacy corner map on load", () => {
    const legacy = {
      ...createEmptyMap("Legacy"),
      nodes: [node("a", 0, 0), node("b", 15, 10)],
    };
    delete (legacy as { canvas?: unknown }).canvas;

    const restored = backfillCanvas(legacy as MapDocument);
    expect(restored.canvas).toEqual(DEFAULT_CANVAS_SIZE);
    expect(restored.nodes.map((item) => [item.x, item.y])).toEqual([[92.5, 95], [107.5, 105]]);
    expect(validateMap(restored)).toEqual([]);
  });

  it("only backfills the canvas on a legacy empty map (nothing to center)", () => {
    const legacy = { ...createEmptyMap("Empty"), nodes: [] };
    delete (legacy as { canvas?: unknown }).canvas;
    const restored = backfillCanvas(legacy as MapDocument);
    expect(restored.canvas).toEqual(DEFAULT_CANVAS_SIZE);
    expect(restored.nodes).toEqual([]);
  });

  it("leaves a map that already has a canvas untouched on load (no re-center)", () => {
    const map = floorMap([node("a", 0, 0), node("b", 15, 10)]);
    expect(backfillCanvas(map)).toBe(map);
  });

  it("rejects a non-positive canvas in validation", () => {
    const bad = floorMap([node("a", 1, 1)]);
    bad.canvas = { width: 0, height: 200 };
    expect(validateMap(bad).map((issue) => issue.code)).toContain("map.canvas.invalid");
  });

  it("steps the grid 1 -> 5 -> 10 -> 25 m as the viewport widens", () => {
    expect(gridStepForViewport(3)).toBe(1);
    expect(gridStepForViewport(12)).toBe(1);
    expect(gridStepForViewport(20)).toBe(5);
    expect(gridStepForViewport(80)).toBe(10);
    expect(gridStepForViewport(180)).toBe(25);
  });
});

describe("recalibrate canvas to real-world meters", () => {
  function node(id: string, x: number, y: number): MapNode {
    return { id, label: id, x, y };
  }

  function calibMap(canvas: CanvasSize, nodes: MapNode[], edges: MapEdge[] = []): MapDocument {
    return { ...createEmptyMap("Calib"), canvas, nodes, edges };
  }

  it("scales node coordinates proportionally to a uniform (aspect-locked) width change", () => {
    const map = calibMap({ width: 200, height: 200 }, [node("a", 100, 100), node("b", 50, 150)]);
    const next = recalibrateCanvas(map, { width: 100, height: 100 });
    expect(next.canvas).toEqual({ width: 100, height: 100 });
    expect(next.nodes.map((item) => [item.x, item.y])).toEqual([[50, 50], [25, 75]]);
  });

  it("rescales edge trajectory control points alongside nodes", () => {
    const map = calibMap(
      { width: 200, height: 200 },
      [node("a", 0, 0), node("b", 100, 100)],
      [{
        id: "a-b",
        label: "a -> b",
        from: "a",
        to: "b",
        orientationType: "TANGENTIAL",
        rotationAllowed: true,
        trajectory: createQuadraticBezierTrajectory({ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 40, y: 60 }),
      }],
    );
    const next = recalibrateCanvas(map, { width: 100, height: 100 });
    expect(next.edges[0]!.trajectory!.controlPoints.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [20, 30],
      [50, 50],
    ]);
  });

  it("scales y but not x for an independent (non-uniform) height change", () => {
    const map = calibMap({ width: 200, height: 200 }, [node("a", 80, 100)]);
    const next = recalibrateCanvas(map, { width: 200, height: 400 });
    expect(next.canvas).toEqual({ width: 200, height: 400 });
    expect(next.nodes.map((item) => [item.x, item.y])).toEqual([[80, 200]]);
  });

  it("anchors content to plan-fractions across recalibration", () => {
    const map = calibMap({ width: 150, height: 90 }, [node("a", 0.3 * 150, 0.7 * 90)]);
    const next = recalibrateCanvas(map, { width: 42.5, height: 17 });
    const out = next.nodes[0]!;
    expect(out.x / next.canvas.width).toBeCloseTo(0.3, 12);
    expect(out.y / next.canvas.height).toBeCloseTo(0.7, 12);
  });

  it("handles an empty map (only the canvas changes)", () => {
    const map = calibMap({ width: 200, height: 200 }, []);
    const next = recalibrateCanvas(map, { width: 30, height: 20 });
    expect(next.canvas).toEqual({ width: 30, height: 20 });
    expect(next.nodes).toEqual([]);
  });

  it("handles a single node and leaves the origin fixed", () => {
    const map = calibMap({ width: 200, height: 200 }, [node("origin", 0, 0), node("a", 20, 20)]);
    const next = recalibrateCanvas(map, { width: 400, height: 400 });
    expect(next.nodes.map((item) => [item.x, item.y])).toEqual([[0, 0], [40, 40]]);
  });

  it("is immutable and never mutates the input map", () => {
    const map = calibMap({ width: 200, height: 200 }, [node("a", 10, 10)]);
    const next = recalibrateCanvas(map, { width: 100, height: 100 });
    expect(map.canvas).toEqual({ width: 200, height: 200 });
    expect(map.nodes[0]).toEqual({ id: "a", label: "a", x: 10, y: 10 });
    expect(next).not.toBe(map);
  });
});

function headings(map: MapDocument): number[] {
  return map.edges.map((edge) => {
    const from = map.nodes.find((item) => item.id === edge.from)!;
    const to = map.nodes.find((item) => item.id === edge.to)!;
    return Math.atan2(to.y - from.y, to.x - from.x);
  });
}

describe("retryUntil", () => {
  it("returns the first success without retrying", async () => {
    let calls = 0;
    const result = await retryUntil(
      async () => {
        calls += 1;
        return "ok";
      },
      { timeoutMs: 1000, delayMs: 1, describe: "should not fail" },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries until the operation succeeds", async () => {
    let calls = 0;
    const result = await retryUntil(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("not yet");
        return calls;
      },
      { timeoutMs: 1000, delayMs: 1, describe: "load thing" },
    );
    expect(result).toBe(3);
    expect(calls).toBe(3);
  });

  it("throws a describe-tagged error carrying the last failure on timeout", async () => {
    await expect(
      retryUntil(
        async () => {
          throw new Error("still down");
        },
        { timeoutMs: 5, delayMs: 1, describe: "Broker unreachable" },
      ),
    ).rejects.toThrow("Broker unreachable within 5ms: still down");
  });
});
