import type { VdaState } from "@agv/core";

/** Declared in the panels layer, not imported from the store, so *View components stay store-free. */
export interface PanelAgv {
  serialNumber: string;
  state: VdaState | null;
}
