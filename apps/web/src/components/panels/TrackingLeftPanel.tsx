import { useMemo } from "react";
import { useFleetStore } from "../../stores/fleet-store";
import { TrackingLeftPanelView } from "./TrackingLeftPanelView";

/**
 * Left-zone container for the Tracking tab. Owns the fleet browse-list: a selectable row
 * per AGV plus the realtime status. Selecting an AGV floats its detail in the right card
 * (TrackingDetailCard); tapping the already-tracked AGV toggles it back off.
 */
export function TrackingLeftPanel() {
  const agvs = useFleetStore((state) => state.agvs);
  const trackedAgvSerial = useFleetStore((state) => state.trackedAgvSerial);
  const realtimeStatus = useFleetStore((state) => state.realtimeStatus);
  const trackAgv = useFleetStore((state) => state.trackAgv);
  const clearTrackedAgv = useFleetStore((state) => state.clearTrackedAgv);
  const agvList = useMemo(() => Object.values(agvs), [agvs]);

  const toggleAgv = (serialNumber: string) =>
    serialNumber === trackedAgvSerial ? clearTrackedAgv() : trackAgv(serialNumber);

  return (
    <TrackingLeftPanelView
      agvs={agvList}
      trackedAgvSerial={trackedAgvSerial}
      realtimeStatus={realtimeStatus}
      onTrackAgv={toggleAgv}
    />
  );
}
