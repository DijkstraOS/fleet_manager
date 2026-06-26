import type { ReactNode } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

/**
 * Body of the Map tab's right floating card: the selection Inspector (node/edge
 * properties + curve actions) followed by the selection-scoped commands that travel
 * with the detail — delete and add-reverse-edge. Presentational; the inspector is
 * supplied as a node so this view stays free of store/service imports.
 */
export function MapInspectorCardView(props: {
  inspector: ReactNode;
  canAddReverseEdge: boolean;
  onDeleteSelection: () => void;
  onAddReverseEdge: () => void;
}) {
  return (
    <>
      {props.inspector}
      <section>
        <h2>Selection</h2>
        <div className="command-stack">
          <button className="secondary-button" type="button" onClick={props.onAddReverseEdge} disabled={!props.canAddReverseEdge}>
            <RotateCcw /> Add reverse edge
          </button>
          <button className="secondary-button danger" type="button" onClick={props.onDeleteSelection}>
            <Trash2 /> Delete selection
          </button>
        </div>
      </section>
    </>
  );
}
