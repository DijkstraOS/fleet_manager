import { Circle } from "lucide-react";
import type { VdaState } from "@agv/core";

export interface TrackingAgvRow {
  serialNumber: string;
  state: VdaState | null;
}

/**
 * Persistent left column of the Tracking tab — where you browse the fleet. A compact,
 * selectable row per AGV (serial · driving/idle · battery) plus the realtime status. The
 * selected AGV's full detail is a separate concern and lives in the floating card on the
 * right (TrackingDetailCard). Presentational; no store/service imports.
 */
export function TrackingLeftPanelView(props: {
  agvs: TrackingAgvRow[];
  trackedAgvSerial: string | null;
  realtimeStatus: string;
  onTrackAgv: (serialNumber: string) => void;
}) {
  return (
    <aside className="left-panel tracking-panel">
      <section>
        <h2>Fleet Tracking</h2>
        {props.agvs.length === 0 && <span className="muted">No AGV online. Start the simulator app or connect an AGV.</span>}
        {props.agvs.map((agv) => (
          <button
            className={props.trackedAgvSerial === agv.serialNumber ? "agv-row selected" : "agv-row"}
            key={agv.serialNumber}
            onClick={() => props.onTrackAgv(agv.serialNumber)}
            type="button"
          >
            <Circle className={agv.state?.driving ? "moving" : "idle"} />
            <div>
              <strong>{agv.serialNumber}</strong>
              <span>{agv.state?.driving ? "Driving" : "Idle"} · {agv.state?.batteryState.batteryCharge ?? "--"}%</span>
            </div>
          </button>
        ))}
      </section>
      <section>
        <h2>Realtime</h2>
        <p className="status-subtext">{props.realtimeStatus}</p>
      </section>
    </aside>
  );
}
