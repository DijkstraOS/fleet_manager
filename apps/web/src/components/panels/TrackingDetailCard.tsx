import { useFleetStore } from "../../stores/fleet-store";
import { FloatingCard } from "./FloatingCard";
import { TrackingDetailCardView } from "./TrackingDetailCardView";

/**
 * Right-zone container for the Tracking tab. Floats the selected AGV's detail and collapses
 * to nothing when no AGV is tracked. The selected AGV is derived from *live* fleet state, so
 * a tracked AGV that drops off the fleet makes the card close gracefully rather than showing
 * stale detail. The header close button (FloatingCard `onClose`) clears the selection — the
 * Tracking selection is list-driven, so there is no canvas deselect of its own. The card is
 * an absolute overlay over the map's right edge, so mounting it never reflows the canvas.
 */
export function TrackingDetailCard() {
  const agvs = useFleetStore((state) => state.agvs);
  const trackedAgvSerial = useFleetStore((state) => state.trackedAgvSerial);
  const orderStatuses = useFleetStore((state) => state.orderStatuses);
  const clearTrackedAgv = useFleetStore((state) => state.clearTrackedAgv);
  const agv = trackedAgvSerial ? agvs[trackedAgvSerial] : undefined;

  return (
    <FloatingCard open={agv != null} title="AGV Detail" onClose={clearTrackedAgv}>
      {agv && (
        <TrackingDetailCardView agv={agv} order={orderStatuses[agv.serialNumber] || null} />
      )}
    </FloatingCard>
  );
}
