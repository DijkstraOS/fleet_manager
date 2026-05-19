import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Download,
  Link,
  MousePointer2,
  Play,
  Plus,
  Route,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createDemoMap,
  exportLifDocument,
  findEdge,
  importLifDocument,
  nextEdgeId,
  nextNodeId,
  slugify,
  validateRoute,
  type MapDocument,
  type MapEdge,
  type MapNode,
  type VdaState,
  type VdaVisualization,
} from "@agv/core";
import { exportLif, getMap, listMaps, saveMap, sendOrder, startSimulator } from "./api.js";

type Tool = "select" | "node" | "edge" | "route";
type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | null;

interface RealtimeAgv {
  serialNumber: string;
  manufacturer: string;
  state: VdaState | null;
  visualization: VdaVisualization | null;
}

const GRID = 1;
const API_WS = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

export default function App() {
  const [map, setMap] = useState<MapDocument>(() => createDemoMap());
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [edgeStartNodeId, setEdgeStartNodeId] = useState<string | null>(null);
  const [routeNodeIds, setRouteNodeIds] = useState<string[]>([]);
  const [agvs, setAgvs] = useState<Record<string, RealtimeAgv>>({});
  const [status, setStatus] = useState("Loading map...");
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let mounted = true;
    listMaps()
      .then(async (maps) => {
        const first = maps[0];
        if (!first) return createDemoMap();
        return getMap(first.id);
      })
      .then((loaded) => {
        if (!mounted) return;
        setMap(loaded);
        setStatus(`Loaded ${loaded.name}`);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "Could not load map."));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(API_WS);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as Record<string, unknown>;
      if (message.type === "agv_state") {
        const serialNumber = String(message.serialNumber);
        setAgvs((prev) => ({
          ...prev,
          [serialNumber]: {
            serialNumber,
            manufacturer: String(message.manufacturer || ""),
            state: message.state as VdaState,
            visualization: prev[serialNumber]?.visualization || null,
          },
        }));
      }
      if (message.type === "agv_visualization") {
        const serialNumber = String(message.serialNumber);
        setAgvs((prev) => ({
          ...prev,
          [serialNumber]: {
            serialNumber,
            manufacturer: String(message.manufacturer || ""),
            state: prev[serialNumber]?.state || null,
            visualization: message.visualization as VdaVisualization,
          },
        }));
      }
      if (message.type === "order_status") {
        setStatus(`${message.serialNumber || "AGV"} order ${message.orderId || ""}: ${message.status}`);
      }
    };
    ws.onopen = () => setStatus("Realtime connected.");
    ws.onclose = () => setStatus("Realtime disconnected.");
    return () => ws.close();
  }, []);

  const bounds = useMemo(() => getBounds(map), [map]);
  const selectedNode = selection?.type === "node" ? map.nodes.find((node) => node.id === selection.id) : null;
  const selectedEdge = selection?.type === "edge" ? map.edges.find((edge) => edge.id === selection.id) : null;
  const routeIssues = useMemo(() => validateRoute(map, routeNodeIds), [map, routeNodeIds]);

  const updateMap = useCallback((updater: (map: MapDocument) => MapDocument) => {
    setMap((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const screenToWorld = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: snap(transformed.x), y: snap(transformed.y) };
  }, []);

  const addNodeAt = (x: number, y: number) => {
    updateMap((current) => {
      const id = nextNodeId(current);
      return {
        ...current,
        nodes: [...current.nodes, { id, label: id, x, y }],
      };
    });
  };

  const onSvgPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return;
    if (tool === "node") {
      const point = screenToWorld(event);
      addNodeAt(point.x, point.y);
    } else {
      setSelection(null);
      setEdgeStartNodeId(null);
    }
  };

  const onNodePointerDown = (event: React.PointerEvent, node: MapNode) => {
    event.stopPropagation();
    if (tool === "edge") {
      if (!edgeStartNodeId) {
        setEdgeStartNodeId(node.id);
        setSelection({ type: "node", id: node.id });
        return;
      }
      if (edgeStartNodeId !== node.id && !findEdge(map, edgeStartNodeId, node.id)) {
        updateMap((current) => ({
          ...current,
          edges: [
            ...current.edges,
            {
              id: nextEdgeId(current, edgeStartNodeId, node.id),
              label: `${edgeStartNodeId} -> ${node.id}`,
              from: edgeStartNodeId,
              to: node.id,
              orientationType: "TANGENTIAL",
              rotationAllowed: true,
              trajectory: null,
            },
          ],
        }));
      }
      setEdgeStartNodeId(null);
      return;
    }

    if (tool === "route") {
      addRouteNode(node.id);
      return;
    }

    setSelection({ type: "node", id: node.id });
    setDragNodeId(node.id);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragNodeId || tool !== "select") return;
    const point = screenToWorld(event);
    updateMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === dragNodeId ? { ...node, x: point.x, y: point.y } : node
      ),
    }));
  };

  const addRouteNode = (nodeId: string) => {
    setRouteNodeIds((current) => {
      const last = current[current.length - 1];
      if (!last) return [nodeId];
      if (last === nodeId) return current;
      if (!findEdge(map, last, nodeId)) {
        setStatus(`No directed edge from ${last} to ${nodeId}.`);
        return current;
      }
      return [...current, nodeId];
    });
  };

  const deleteSelection = () => {
    if (!selection) return;
    updateMap((current) => {
      if (selection.type === "node") {
        return {
          ...current,
          nodes: current.nodes.filter((node) => node.id !== selection.id),
          edges: current.edges.filter((edge) => edge.from !== selection.id && edge.to !== selection.id),
        };
      }
      return {
        ...current,
        edges: current.edges.filter((edge) => edge.id !== selection.id),
      };
    });
    setSelection(null);
  };

  const handleSave = async () => {
    const saved = await saveMap(map);
    setMap(saved);
    setStatus(`Saved ${saved.name}.`);
  };

  const handleStartSimulator = async () => {
    const startNodeId = selectedNode?.id || map.nodes[0]?.id;
    if (!startNodeId) return setStatus("Add a node before starting the simulator.");
    const result = await startSimulator({ mapId: map.id, startNodeId });
    setStatus(`Started ${result.serialNumber} at ${startNodeId}.`);
  };

  const handleSendOrder = async () => {
    const agv = Object.values(agvs)[0];
    if (!agv) return setStatus("Start a simulator first.");
    if (routeIssues.length > 0) return setStatus(routeIssues[0]?.message || "Invalid route.");
    const response = await sendOrder({
      mapId: map.id,
      agvSerialNumber: agv.serialNumber,
      routeNodeIds,
    });
    setStatus(response.ok ? "Order sent." : "Order failed.");
    setRouteNodeIds([]);
  };

  const handleExport = async () => {
    const lif = await exportLif(map.id).catch(() => exportLifDocument(map));
    downloadJson(`${map.id}.lif.json`, lif);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const imported = importLifDocument(parsed);
    setMap(imported);
    setSelection(null);
    setRouteNodeIds([]);
    setStatus(`Imported ${imported.name}.`);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">AGV Map Simulator</div>
          <input
            className="map-title"
            value={map.name}
            onChange={(event) =>
              updateMap((current) => ({
                ...current,
                name: event.target.value,
                id: slugify(event.target.value) || current.id,
              }))
            }
          />
        </div>
        <div className="toolbar">
          <ToolButton active={tool === "select"} title="Select" onClick={() => setTool("select")} icon={<MousePointer2 />} />
          <ToolButton active={tool === "node"} title="Node" onClick={() => setTool("node")} icon={<Plus />} />
          <ToolButton active={tool === "edge"} title="Edge" onClick={() => setTool("edge")} icon={<Link />} />
          <ToolButton active={tool === "route"} title="Route" onClick={() => setTool("route")} icon={<Route />} />
          <button className="icon-button" title="Delete selected" onClick={deleteSelection}><Trash2 /></button>
          <button className="icon-button" title="Save map" onClick={handleSave}><Save /></button>
          <label className="icon-button" title="Import LIF">
            <Upload />
            <input
              type="file"
              accept="application/json,.json,.lif"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void handleImport(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button className="icon-button" title="Export LIF" onClick={handleExport}><Download /></button>
          <button className="action-button" onClick={handleStartSimulator}><Play /> Start Dummy</button>
          <button className="action-button primary" onClick={handleSendOrder} disabled={routeIssues.length > 0 || routeNodeIds.length < 2}>
            <Route /> Send Order
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-panel">
          <section>
            <h2>Route</h2>
            <div className="route-list">
              {routeNodeIds.length === 0 ? <span className="muted">No route selected.</span> : routeNodeIds.join(" -> ")}
            </div>
            <button className="secondary-button" onClick={() => setRouteNodeIds([])}>Clear route</button>
          </section>
          <section>
            <h2>Fleet</h2>
            {Object.values(agvs).length === 0 && <span className="muted">No simulator online.</span>}
            {Object.values(agvs).map((agv) => (
              <div className="agv-row" key={agv.serialNumber}>
                <Circle className={agv.state?.driving ? "moving" : "idle"} />
                <div>
                  <strong>{agv.serialNumber}</strong>
                  <span>{agv.state?.driving ? "Driving" : "Idle"} · {agv.state?.batteryState.batteryCharge ?? "--"}%</span>
                </div>
              </div>
            ))}
          </section>
          <section>
            <h2>Status</h2>
            <p className="status-text">{status}</p>
          </section>
        </aside>

        <section className="map-stage">
          <svg
            ref={svgRef}
            className="map-svg"
            viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragNodeId(null)}
            onPointerLeave={() => setDragNodeId(null)}
          >
            <defs>
              <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#d7dee8" strokeWidth="0.015" />
              </pattern>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="#f8fafc" />
            <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="url(#grid)" />

            {map.edges.map((edge) => {
              const from = map.nodes.find((node) => node.id === edge.from);
              const to = map.nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;
              const active = selection?.type === "edge" && selection.id === edge.id;
              const routeActive = routeContainsEdge(routeNodeIds, edge.from, edge.to);
              return (
                <g key={edge.id} onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelection({ type: "edge", id: edge.id });
                }}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={active ? "edge active" : routeActive ? "edge route" : "edge"}
                    markerEnd="url(#arrow)"
                  />
                  <text className="edge-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 0.2}>{edge.id}</text>
                </g>
              );
            })}

            {Object.values(agvs).map((agv) => {
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

            {map.nodes.map((node) => (
              <g key={node.id} onPointerDown={(event) => onNodePointerDown(event, node)}>
                <circle className={nodeClass(node.id, selection, edgeStartNodeId, routeNodeIds)} cx={node.x} cy={node.y} r="0.28" />
                <text className="node-label" x={node.x + 0.35} y={node.y - 0.35}>{node.label || node.id}</text>
              </g>
            ))}
          </svg>
        </section>

        <aside className="right-panel">
          <Inspector
            node={selectedNode}
            edge={selectedEdge}
            onNodeChange={(next) =>
              updateMap((current) => ({
                ...current,
                nodes: current.nodes.map((node) => node.id === selectedNode?.id ? next : node),
                edges: current.edges.map((edge) => ({
                  ...edge,
                  from: edge.from === selectedNode?.id ? next.id : edge.from,
                  to: edge.to === selectedNode?.id ? next.id : edge.to,
                })),
              }))
            }
            onEdgeChange={(next) =>
              updateMap((current) => ({
                ...current,
                edges: current.edges.map((edge) => edge.id === selectedEdge?.id ? next : edge),
              }))
            }
          />
        </aside>
      </main>
    </div>
  );
}

function Inspector(props: {
  node: MapNode | null | undefined;
  edge: MapEdge | null | undefined;
  onNodeChange: (node: MapNode) => void;
  onEdgeChange: (edge: MapEdge) => void;
}) {
  if (props.node) {
    const node = props.node;
    return (
      <section>
        <h2>Node</h2>
        <Field label="ID" value={node.id} onChange={(id) => props.onNodeChange({ ...node, id })} />
        <Field label="Label" value={node.label} onChange={(label) => props.onNodeChange({ ...node, label })} />
        <NumberField label="X" value={node.x} onChange={(x) => props.onNodeChange({ ...node, x })} />
        <NumberField label="Y" value={node.y} onChange={(y) => props.onNodeChange({ ...node, y })} />
        <NumberField label="Theta" value={node.theta ?? 0} onChange={(theta) => props.onNodeChange({ ...node, theta })} />
      </section>
    );
  }

  if (props.edge) {
    const edge = props.edge;
    return (
      <section>
        <h2>Edge</h2>
        <Field label="ID" value={edge.id} onChange={(id) => props.onEdgeChange({ ...edge, id })} />
        <Field label="Label" value={edge.label} onChange={(label) => props.onEdgeChange({ ...edge, label })} />
        <NumberField label="Max speed" value={edge.maxSpeed ?? 1.2} onChange={(maxSpeed) => props.onEdgeChange({ ...edge, maxSpeed })} />
        <NumberField label="Orientation" value={edge.orientation ?? 0} onChange={(orientation) => props.onEdgeChange({ ...edge, orientation })} />
        <label className="field">
          <span>Orientation type</span>
          <select value={edge.orientationType} onChange={(event) => props.onEdgeChange({ ...edge, orientationType: event.target.value as MapEdge["orientationType"] })}>
            <option value="TANGENTIAL">Tangential</option>
            <option value="GLOBAL">Global</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={edge.rotationAllowed} onChange={(event) => props.onEdgeChange({ ...edge, rotationAllowed: event.target.checked })} />
          Rotation allowed
        </label>
        <p className="muted">Trajectory data is preserved for LIF import/export, but editing curves is intentionally outside this MVP.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Inspector</h2>
      <p className="muted">Select a node or edge to edit properties.</p>
    </section>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function NumberField(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input type="number" step="0.1" value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} />
    </label>
  );
}

function ToolButton(props: { active: boolean; title: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button className={props.active ? "icon-button active" : "icon-button"} title={props.title} onClick={props.onClick}>
      {props.icon}
    </button>
  );
}

function getBounds(map: MapDocument) {
  if (map.nodes.length === 0) return { x: -2, y: -2, width: 20, height: 14 };
  const xs = map.nodes.map((node) => node.x);
  const ys = map.nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX - 2,
    y: minY - 2,
    width: Math.max(maxX - minX + 4, 12),
    height: Math.max(maxY - minY + 4, 8),
  };
}

function snap(value: number) {
  return Math.round(value / 0.5) * 0.5;
}

function nodeClass(id: string, selection: Selection, edgeStart: string | null, route: string[]) {
  const classes = ["node"];
  if (selection?.type === "node" && selection.id === id) classes.push("active");
  if (edgeStart === id) classes.push("edge-start");
  if (route.includes(id)) classes.push("route");
  return classes.join(" ");
}

function routeContainsEdge(route: string[], from: string, to: string) {
  for (let index = 0; index < route.length - 1; index += 1) {
    if (route[index] === from && route[index + 1] === to) return true;
  }
  return false;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
