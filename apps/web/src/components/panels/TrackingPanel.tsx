import { useMemo } from "react";
import { useFleetStore } from "../../stores/fleet-store";
import { TrackingPanelView } from "./TrackingPanelView";

export function TrackingPanel() {
  const agvs = useFleetStore((state) => state.agvs);
  const orderStatuses = useFleetStore((state) => state.orderStatuses);
  const realtimeStatus = useFleetStore((state) => state.realtimeStatus);
  const agvList = useMemo(() => Object.values(agvs), [agvs]);

  return (
    <TrackingPanelView
      agvs={agvList}
      orderStatuses={orderStatuses}
      realtimeStatus={realtimeStatus}
    />
  );
}
