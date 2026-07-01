// @vitest-environment jsdom
import { Profiler, type ReactNode } from "react";
import { act, cleanup as rtlCleanup, render } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { MapDocument } from "@agv/core";
import { makeMap } from "@perf/corpus";
import App from "../../../App";
import { useEditorStore } from "../../../stores/editor-store";
import { useFleetStore } from "../../../stores/fleet-store";
import { useRouteStore } from "../../../stores/route-store";
import type { WorkspaceMode } from "../../../types";
import {
  renderTallySnapshot,
  resetRenderTally,
  setRenderTallyEnabled,
} from "../../../lib/render-tally";

vi.mock("../../../services/api", () => ({
  listMaps: vi.fn(async () => []),
  listRoutes: vi.fn(async () => []),
  getMap: vi.fn(async () => null),
  saveMap: vi.fn(async () => {}),
}));

vi.mock("../../../services/realtime", () => ({
  connectRealtime: vi.fn(() => () => {}),
}));

const PROFILE_MAP: MapDocument = makeMap({ nodes: 300, topology: "grid" });
const SUPPORT_NODE = "n0"; // index % 3 === 0 → unlabelled support node
const FULL_NODE = "n1"; // labelled, full node
const EDGE_ID = "n0->n1";

let commitCount = 0;

function Tree({ children }: { children: ReactNode }) {
  return <Profiler id="app" onRender={() => { commitCount += 1; }}>{children}</Profiler>;
}

async function flushLifecycle(): Promise<void> {
  // Drain microtask ticks so the mount's async chain settles before we zero the tally.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

interface Scenario {
  name: string;
  mode: WorkspaceMode;
  /** Runs after mount+flush, before the tally is zeroed — selection/track/viewport priming. */
  setup?: () => void;
  /** The measured interaction — exactly the store write(s) the gesture performs. */
  run: () => void;
}

interface ProfileRow {
  name: string;
  mode: WorkspaceMode;
  commits: number;
  totalRenders: number;
  components: Array<[string, number]>;
}

function seed(mode: WorkspaceMode, fleet?: Partial<ReturnType<typeof useFleetStore.getState>>): void {
  useEditorStore.setState({
    map: PROFILE_MAP,
    workspaceMode: mode,
    tool: "select",
    selection: null,
    edgeStartNodeId: null,
    viewport: null,
  });
  useFleetStore.setState({ agvs: {}, orderStatuses: {}, selectedAgvSerial: null, trackedAgvSerial: null, ...fleet });
  useRouteStore.setState({ routes: [], draftNodeIds: [], selectedRouteId: null, draftActive: false });
}

async function runScenario(scenario: Scenario): Promise<ProfileRow> {
  seed(scenario.mode);
  setRenderTallyEnabled(true);
  render(<Tree><App /></Tree>);
  await flushLifecycle();
  if (scenario.setup) act(() => scenario.setup!());

  resetRenderTally();
  commitCount = 0;
  act(() => scenario.run());

  const components = Object.entries(renderTallySnapshot())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const totalRenders = components.reduce((sum, [, count]) => sum + count, 0);
  const row: ProfileRow = { name: scenario.name, mode: scenario.mode, commits: commitCount, totalRenders, components };

  rtlCleanup();
  setRenderTallyEnabled(false);
  resetRenderTally();
  return row;
}

function agvFrame(serial: string) {
  return () => useFleetStore.getState().handleRealtimeMessage({
    type: "agv_visualization",
    serialNumber: serial,
    manufacturer: "perf",
    visualization: { agvPosition: { x: 1, y: 1, theta: 0, mapId: "perf", positionInitialized: true } },
  });
}

const SCENARIOS: Scenario[] = [
  // ── AGV telemetry frame (the realtime firehose) in each mode ───────────────
  { name: "AGV frame", mode: "map", run: agvFrame("SIM1") },
  { name: "AGV frame", mode: "routes", run: agvFrame("SIM1") },
  { name: "AGV frame (none tracked)", mode: "tracking", run: agvFrame("SIM1") },
  {
    name: "AGV frame (tracked AGV moves)", mode: "tracking",
    setup: () => { useFleetStore.getState().handleRealtimeMessage(frameMsg("SIM1")); useFleetStore.setState({ trackedAgvSerial: "SIM1" }); },
    run: agvFrame("SIM1"),
  },
  {
    name: "AGV frame (other AGV moves)", mode: "tracking",
    setup: () => { useFleetStore.getState().handleRealtimeMessage(frameMsg("SIM1")); useFleetStore.setState({ trackedAgvSerial: "SIM1" }); },
    run: agvFrame("SIM2"),
  },
  // ── Canvas navigation ──────────────────────────────────────────────────────
  { name: "Pan", mode: "map", run: () => panBy(2, 2) },
  { name: "Zoom", mode: "map", run: () => zoomBy(0.85) },
  // ── Map editing ────────────────────────────────────────────────────────────
  { name: "Drag node (1 frame)", mode: "map", setup: () => useEditorStore.getState().beginDragNode(FULL_NODE), run: () => useEditorStore.getState().dragNodeTo(5, 5) },
  { name: "Select node", mode: "map", run: () => useEditorStore.getState().selectNode(FULL_NODE) },
  { name: "Select edge", mode: "map", run: () => useEditorStore.getState().selectEdge(EDGE_ID) },
  {
    name: "Curve-handle drag (1 frame)", mode: "map",
    setup: () => useEditorStore.getState().selectEdge(EDGE_ID),
    run: () => useEditorStore.getState().updateSelectedEdgeCurveHandle(0.5, 0.5),
  },
  {
    name: "Field edit (node X)", mode: "map",
    setup: () => useEditorStore.getState().selectNode(FULL_NODE),
    run: () => { const n = PROFILE_MAP.nodes.find((node) => node.id === FULL_NODE)!; useEditorStore.getState().updateNode({ ...n, x: 7 }); },
  },
  { name: "Rename map (1 keystroke)", mode: "map", run: () => useEditorStore.getState().renameMap("Renamed") },
  // ── Tab switches ───────────────────────────────────────────────────────────
  { name: "Tab switch → routes", mode: "map", run: () => useEditorStore.getState().setWorkspaceMode("routes") },
  { name: "Tab switch → tracking", mode: "routes", run: () => useEditorStore.getState().setWorkspaceMode("tracking") },
  { name: "Tab switch → map", mode: "tracking", run: () => useEditorStore.getState().setWorkspaceMode("map") },
];

function frameMsg(serial: string): Record<string, unknown> {
  return { type: "agv_visualization", serialNumber: serial, manufacturer: "perf", visualization: { agvPosition: { x: 1, y: 1, theta: 0, mapId: "perf", positionInitialized: true } } };
}
function currentViewport() {
  const { viewport, map } = useEditorStore.getState();
  return viewport ?? { x: 0, y: 0, width: map.canvas.width, height: map.canvas.height };
}
function panBy(dx: number, dy: number) {
  const v = currentViewport();
  useEditorStore.getState().setViewport({ ...v, x: v.x + dx, y: v.y + dy });
}
function zoomBy(scale: number) {
  const v = currentViewport();
  useEditorStore.getState().setViewport({ x: v.x, y: v.y, width: v.width * scale, height: v.height * scale });
}

function formatRow(row: ProfileRow): string {
  const parts = row.components.map(([label, count]) => `${label}×${count}`).join(", ");
  const head = `${row.name} [${row.mode}]`.padEnd(34);
  return `${head} commits=${row.commits}  renders=${row.totalRenders}  | ${parts || "(nothing)"}`;
}

describe("render profile: what the running app re-renders, per interaction", () => {
  afterEach(() => { rtlCleanup(); setRenderTallyEnabled(false); resetRenderTally(); });
  afterAll(() => vi.restoreAllMocks());

  it("captures and prints the full per-interaction render profile", async () => {
    const rows: ProfileRow[] = [];
    for (const scenario of SCENARIOS) rows.push(await runScenario(scenario));

    // eslint-disable-next-line no-console
    console.log(["", "═══ RENDER PROFILE (300-node grid; counts are size-independent) ═══", ...rows.map(formatRow), ""].join("\n"));

    expect(rows).toHaveLength(SCENARIOS.length);

    const byName = (name: string, mode: WorkspaceMode) => rows.find((r) => r.name === name && r.mode === mode)!;
    const count = (row: ProfileRow, label: string) => row.components.find(([l]) => l === label)?.[1] ?? 0;

    const agvMap = byName("AGV frame", "map");
    expect(agvMap.totalRenders).toBe(0);

    // Markers self-subscribe in <AgvOverlay>; keep the controller off `agvs` so telemetry never reaches the static canvas.
    const agvTracking = byName("AGV frame (none tracked)", "tracking");
    expect(count(agvTracking, "MapCanvas")).toBe(0);
    expect(count(agvTracking, "NodeLayer")).toBe(0);
    expect(count(agvTracking, "EdgeLayer")).toBe(0);

    // StaticGraph's props are viewport-independent, so its memo must bail on a pan.
    const pan = byName("Pan", "map");
    expect(count(pan, "MapCanvasView")).toBe(1);
    expect(count(pan, "StaticGraph")).toBe(0);
    expect(count(pan, "NodeLayer")).toBe(0);
    expect(count(pan, "EdgeLayer")).toBe(0);
    expect(count(pan, "MapLeftPanel")).toBe(0);

    // Teeth: fails if the shell re-subscribes to selection (useAppLifecycle must read it via getState).
    const selectNode = byName("Select node", "map");
    expect(count(selectNode, "App")).toBe(0);
    expect(count(selectNode, "TopBar")).toBe(0);
    expect(count(selectNode, "MapLeftPanel")).toBe(0);

    // useMapCommands must read `map` via getState() in its command closures, not subscribe — else a drag frame re-renders MapLeftPanel.
    const drag = byName("Drag node (1 frame)", "map");
    expect(count(drag, "MapLeftPanel")).toBe(0);

    // Keep TrackingDetailCard selecting only s.agvs[trackedSerial] + its order, so an unrelated serial's upsert leaves its refs untouched.
    const otherAgv = byName("AGV frame (other AGV moves)", "tracking");
    expect(count(otherAgv, "TrackingDetailCard")).toBe(0);

    // Why 1, not 0: StaticGraph's memo guards only the viewport seam, so one select/drag rebuilds the whole graph. Reducing to 0 needs per-item React.memo NodeItem/EdgeItem keyed by id.
    expect(count(selectNode, "StaticGraph")).toBe(1);
    expect(count(selectNode, "NodeLayer")).toBe(1);
    expect(count(drag, "NodeLayer")).toBe(1);
  });
});
