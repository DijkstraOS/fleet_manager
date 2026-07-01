import { Repeat, Route } from "lucide-react";
import type { RouteDocument } from "@agv/core";
import { AgvRow } from "./AgvRow";
import type { PanelAgv } from "./types";

export function RouteLeftPanelView(props: {
  routes: RouteDocument[];
  selectedRouteId: string | null;
  onNewRoute: () => void;
  onSelectRoute: (routeId: string) => void;
  showActions: boolean;
  agvs: PanelAgv[];
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
            <AgvRow
              key={agv.serialNumber}
              agv={agv}
              selected={props.selectedAgvSerial === agv.serialNumber}
              onSelect={props.onSelectAgv}
            />
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
