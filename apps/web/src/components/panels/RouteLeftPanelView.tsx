import { Circle, Repeat, Route } from "lucide-react";
import type { RouteDocument, VdaState } from "@agv/core";

export interface RouteActionAgv {
  serialNumber: string;
  state: VdaState | null;
}

/**
 * Persistent left column of the Route tab — where you find a route and act on it. The
 * saved-routes list (browse/create) is always shown; the route *actions* (Assign-AGV, the
 * loop toggle, and Send / Start-Loop / Stop-Loop) appear below it while a route is active
 * (`showActions`). Editing the route's geometry — name and node sequence — is a separate
 * concern and lives in the floating editor card on the right (RouteEditorCard).
 * Presentational; no store/service imports.
 */
export function RouteLeftPanelView(props: {
  routes: RouteDocument[];
  selectedRouteId: string | null;
  onNewRoute: () => void;
  onSelectRoute: (routeId: string) => void;
  showActions: boolean;
  agvs: RouteActionAgv[];
  selectedAgvSerial: string | null;
  loopRoute: boolean;
  canLoopRoute: boolean;
  draftRouteNodeIds: string[];
  canSendRoute: boolean;
  canStopLoop: boolean;
  onSelectAgv: (serialNumber: string) => void;
  onLoopRouteChange: (loopRoute: boolean) => void;
  onSendRoute: () => void;
  onStopLoop: () => void;
}) {
  return (
    <aside className="left-panel route-library-panel">
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

      {props.showActions && (
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
      )}
    </aside>
  );
}
