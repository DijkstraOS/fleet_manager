import { AgvRow } from "./AgvRow";
import type { PanelAgv } from "./types";

export function TrackingLeftPanelView(props: {
  agvs: PanelAgv[];
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
          <AgvRow
            key={agv.serialNumber}
            agv={agv}
            selected={props.trackedAgvSerial === agv.serialNumber}
            onSelect={props.onTrackAgv}
          />
        ))}
      </section>
      <section>
        <h2>Realtime</h2>
        <p className="status-subtext">{props.realtimeStatus}</p>
      </section>
    </aside>
  );
}
