import { useFleetStore } from "../../stores/fleet-store";
import { useRenderTally } from "../../lib/render-tally";
import { FloatingCard } from "./FloatingCard";
import { TrackingDetailCardView } from "./TrackingDetailCardView";

export function TrackingDetailCard() {
  useRenderTally("TrackingDetailCard");
  const trackedAgvSerial = useFleetStore((state) => state.trackedAgvSerial);
  // Subscribe to the per-serial slice, not the whole agvs/orderStatuses records — upsertAgv reallocates those every frame for any serial.
  const agv = useFleetStore((state) => (trackedAgvSerial ? state.agvs[trackedAgvSerial] : undefined));
  const order = useFleetStore((state) => (trackedAgvSerial ? state.orderStatuses[trackedAgvSerial] : undefined));
  const clearTrackedAgv = useFleetStore((state) => state.clearTrackedAgv);

  return (
    <FloatingCard open={agv != null} title="AGV Detail" onClose={clearTrackedAgv}>
      {agv && <TrackingDetailCardView agv={agv} order={order ?? null} />}
    </FloatingCard>
  );
}
