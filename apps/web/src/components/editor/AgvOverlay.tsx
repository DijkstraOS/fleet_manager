import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFleetStore } from "../../stores/fleet-store";
import { useRenderTally } from "../../lib/render-tally";

/** The canvas's only high-frequency fleet subscriber; mount only outside map mode and never re-subscribe the static canvas to fleet churn. */
export const AgvOverlay = memo(function AgvOverlay() {
  useRenderTally("AgvOverlay");
  const serials = useFleetStore(useShallow((state) => Object.keys(state.agvs)));
  return (
    <g className="agv-layer" pointerEvents="none">
      {serials.map((serial) => (
        <AgvMarker key={serial} serial={serial} />
      ))}
    </g>
  );
});

const AgvMarker = memo(function AgvMarker({ serial }: { serial: string }) {
  useRenderTally(`AgvMarker:${serial}`);
  const agv = useFleetStore((state) => state.agvs[serial]);
  const pos = agv?.visualization?.agvPosition || agv?.state?.agvPosition;
  if (!pos) return null;
  return (
    <g className="agv-marker" transform={`translate(${pos.x} ${pos.y}) rotate(${(pos.theta * 180) / Math.PI})`}>
      <rect x="-0.35" y="-0.22" width="0.7" height="0.44" rx="0.07" className="agv-body" />
      <path d="M 0.35 0 L 0.58 0.16 L 0.58 -0.16 z" className="agv-nose" />
      <text className="agv-label" x="-0.45" y="-0.45">{serial}</text>
    </g>
  );
});
