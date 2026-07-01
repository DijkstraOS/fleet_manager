import { useMemo } from "react";
import { useFleetStore } from "../../stores/fleet-store";
import { useRenderTally } from "../../lib/render-tally";
import { TrackingLeftPanelView } from "./TrackingLeftPanelView";

export function TrackingLeftPanel() {
  useRenderTally("TrackingLeftPanel");
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
