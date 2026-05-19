import { useFleetStore } from "../../stores/fleet-store";
import { FleetPanelView } from "./FleetPanelView";

export function FleetPanel() {
  const agvs = useFleetStore((state) => state.agvs);
  const selectedAgvSerial = useFleetStore((state) => state.selectedAgvSerial);
  const selectAgv = useFleetStore((state) => state.selectAgv);

  return (
    <FleetPanelView
      agvs={Object.values(agvs)}
      selectedAgvSerial={selectedAgvSerial}
      onSelectAgv={selectAgv}
    />
  );
}
