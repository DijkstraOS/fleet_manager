import { Circle, Repeat, Route, Save, Trash2, Undo2 } from "lucide-react";
import type { RouteDocument, ValidationIssue, VdaState } from "@agv/core";

export interface RouteWorkspaceAgv {
  serialNumber: string;
  state: VdaState | null;
}

export function RouteWorkspacePanelView(props: {
  routes: RouteDocument[];
  selectedRouteId: string | null;
  draftRouteName: string;
  draftRouteNodeIds: string[];
  routeIssues: ValidationIssue[];
  routeStatus: string;
  agvs: RouteWorkspaceAgv[];
  selectedAgvSerial: string | null;
  loopRoute: boolean;
  canLoopRoute: boolean;
  canSaveRoute: boolean;
  canSendRoute: boolean;
  canStopLoop: boolean;
  onNewRoute: () => void;
  onSelectRoute: (routeId: string) => void;
  onDraftName: (name: string) => void;
  onRemoveLastNode: () => void;
  onClearRoute: () => void;
  onSaveRoute: () => void;
  onDeleteRoute: () => void;
  onSelectAgv: (serialNumber: string) => void;
  onLoopRouteChange: (loopRoute: boolean) => void;
  onSendRoute: () => void;
  onStopLoop: () => void;
}) {
  return (
    <aside className="left-panel route-workbench">
      <section>
        <div className="section-heading">
          <h2>Routes</h2>
          <button type="button" className="compact-button" onClick={props.onNewRoute}>New</button>
        </div>
        <div className="route-library">
          {props.routes.length === 0 && <span className="muted">No saved routes for this map.</span>}
          {props.routes.map((route) => (
            <button
              type="button"
              className={props.selectedRouteId === route.id ? "route-row selected" : "route-row"}
              key={route.id}
              onClick={() => props.onSelectRoute(route.id)}
            >
              <Route />
              <span>{route.name}</span>
              <small>{route.nodeIds.length} nodes</small>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Route Editor</h2>
        <label className="field">
          <span>Name</span>
          <input value={props.draftRouteName} onChange={(event) => props.onDraftName(event.target.value)} />
        </label>
        <div className="route-list">
          {props.draftRouteNodeIds.length === 0 ? <span className="muted">Click nodes on the map in travel order.</span> : props.draftRouteNodeIds.join(" -> ")}
        </div>
        {props.routeIssues.length > 0 && <p className="error-text">{props.routeIssues[0]?.message}</p>}
        <div className="command-stack">
          <button type="button" className="secondary-button" onClick={props.onRemoveLastNode} disabled={props.draftRouteNodeIds.length === 0}>
            <Undo2 /> Remove last node
          </button>
          <button type="button" className="secondary-button" onClick={props.onClearRoute} disabled={props.draftRouteNodeIds.length === 0}>
            Clear route
          </button>
          <button type="button" className="secondary-button" onClick={props.onSaveRoute} disabled={!props.canSaveRoute}>
            <Save /> Save route
          </button>
          <button type="button" className="secondary-button danger" onClick={props.onDeleteRoute} disabled={!props.selectedRouteId}>
            <Trash2 /> Delete route
          </button>
        </div>
        <p className="status-subtext">{props.routeStatus}</p>
      </section>

      <section>
        <h2>Assign AGV</h2>
        {props.agvs.length === 0 && <span className="muted">No AGV online. Start the simulator app or connect an AGV.</span>}
        {props.agvs.map((agv) => (
          <button
            className={props.selectedAgvSerial === agv.serialNumber ? "agv-row selected" : "agv-row"}
            key={agv.serialNumber}
            onClick={() => props.onSelectAgv(agv.serialNumber)}
            type="button"
          >
            <Circle className={agv.state?.driving ? "moving" : "idle"} />
            <div>
              <strong>{agv.serialNumber}</strong>
              <span>{agv.state?.driving ? "Driving" : "Idle"} · {agv.state?.batteryState.batteryCharge ?? "--"}%</span>
            </div>
          </button>
        ))}
        <label className="checkbox-row route-loop-toggle">
          <input
            type="checkbox"
            checked={props.loopRoute}
            onChange={(event) => props.onLoopRouteChange(event.target.checked)}
          />
          <span>Loop route</span>
        </label>
        {props.loopRoute && props.draftRouteNodeIds.length >= 2 && !props.canLoopRoute && (
          <p className="error-text">Looping route must end at its starting node.</p>
        )}
        <button type="button" className="action-button primary full-width" onClick={props.onSendRoute} disabled={!props.canSendRoute}>
          {props.loopRoute ? <Repeat /> : <Route />} {props.loopRoute ? "Start Loop" : "Send Route"}
        </button>
        <button type="button" className="secondary-button full-width" onClick={props.onStopLoop} disabled={!props.canStopLoop}>
          <Repeat /> Stop Loop
        </button>
      </section>
    </aside>
  );
}
