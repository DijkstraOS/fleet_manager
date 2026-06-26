import { Circle } from "lucide-react";
import type { VdaState } from "@agv/core";

export interface TrackingDetailAgv {
  serialNumber: string;
  state: VdaState | null;
}

export interface TrackingDetailOrderStatus {
  orderId: string;
  status: string;
  routeName?: string;
  loop?: boolean;
  loopIteration?: number;
  reason?: string;
}

/**
 * Body of the Tracking tab's right floating card: the selected AGV's detail — Status,
 * Battery, Route, Order, and Order status. Relocated as-is from the old left panel; the
 * card title and close button are supplied by the FloatingCard shell. Presentational; no
 * store/service imports.
 */
export function TrackingDetailCardView(props: {
  agv: TrackingDetailAgv;
  order: TrackingDetailOrderStatus | null;
}) {
  const currentOrderId = props.agv.state?.orderId || props.order?.orderId || "";
  return (
    <div className="tracking-row">
      <div className="tracking-title">
        <Circle className={props.agv.state?.driving ? "moving" : "idle"} />
        <strong>{props.agv.serialNumber}</strong>
      </div>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{props.agv.state?.driving ? "Driving" : "Idle"}</dd>
        </div>
        <div>
          <dt>Battery</dt>
          <dd>{props.agv.state?.batteryState.batteryCharge ?? "--"}%</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>{props.order?.routeName || "--"}</dd>
        </div>
        <div>
          <dt>Order</dt>
          <dd>{currentOrderId || "--"}</dd>
        </div>
        <div>
          <dt>Order status</dt>
          <dd>{props.order ? formatOrderStatus(props.order) : "--"}</dd>
        </div>
      </dl>
    </div>
  );
}

function formatOrderStatus(order: TrackingDetailOrderStatus) {
  const base = order.loop && order.loopIteration
    ? `${order.status} · loop ${order.loopIteration}`
    : order.status;
  return order.reason ? `${base} — ${order.reason}` : base;
}
