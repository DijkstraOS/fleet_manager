import { Circle } from "lucide-react";
import type { VdaState } from "@agv/core";

export interface FleetPanelAgv {
  serialNumber: string;
  state: VdaState | null;
}

export function FleetPanelView(props: {
  agvs: FleetPanelAgv[];
  selectedAgvSerial: string | null;
  onSelectAgv: (serialNumber: string) => void;
}) {
  return (
    <section>
      <h2>Fleet</h2>
      {props.agvs.length === 0 && (
        <span className="muted">No AGV online. Start the simulator app or connect an AGV.</span>
      )}
      {props.agvs.map((agv) => {
        const selected = props.selectedAgvSerial === agv.serialNumber;
        return (
          <button
            className={selected ? "agv-row selected" : "agv-row"}
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
        );
      })}
    </section>
  );
}
