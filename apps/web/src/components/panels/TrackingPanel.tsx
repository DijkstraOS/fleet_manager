import { Circle } from "lucide-react";
import type { RealtimeAgv, TrackedOrderStatus } from "../../stores/fleet-store";

export function TrackingPanel(props: {
  agvs: RealtimeAgv[];
  orderStatuses: Record<string, TrackedOrderStatus>;
  realtimeStatus: string;
}) {
  return (
    <aside className="left-panel tracking-panel">
      <section>
        <h2>Fleet Tracking</h2>
        {props.agvs.length === 0 && <span className="muted">No AGV online. Start the simulator app or connect an AGV.</span>}
        {props.agvs.map((agv) => {
          const order = props.orderStatuses[agv.serialNumber];
          const currentOrderId = agv.state?.orderId || order?.orderId || "";
          return (
            <div className="tracking-row" key={agv.serialNumber}>
              <div className="tracking-title">
                <Circle className={agv.state?.driving ? "moving" : "idle"} />
                <strong>{agv.serialNumber}</strong>
              </div>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{agv.state?.driving ? "Driving" : "Idle"}</dd>
                </div>
                <div>
                  <dt>Battery</dt>
                  <dd>{agv.state?.batteryState.batteryCharge ?? "--"}%</dd>
                </div>
                <div>
                  <dt>Route</dt>
                  <dd>{order?.routeName || "--"}</dd>
                </div>
                <div>
                  <dt>Order</dt>
                  <dd>{currentOrderId || "--"}</dd>
                </div>
                <div>
                  <dt>Order status</dt>
                  <dd>{order?.status || "--"}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </section>
      <section>
        <h2>Realtime</h2>
        <p className="status-subtext">{props.realtimeStatus}</p>
      </section>
    </aside>
  );
}
