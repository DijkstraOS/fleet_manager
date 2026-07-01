import { Circle } from "lucide-react";
import type { PanelAgv } from "./types";

export function AgvRow(props: {
  agv: PanelAgv;
  selected: boolean;
  onSelect: (serialNumber: string) => void;
}) {
  const { agv } = props;
  return (
    <button
      className={props.selected ? "agv-row selected" : "agv-row"}
      onClick={() => props.onSelect(agv.serialNumber)}
      type="button"
    >
      <Circle className={agv.state?.driving ? "moving" : "idle"} />
      <div>
        <strong>{agv.serialNumber}</strong>
        <span>{agv.state?.driving ? "Driving" : "Idle"} · {agv.state?.batteryState.batteryCharge ?? "--"}%</span>
      </div>
    </button>
  );
}
