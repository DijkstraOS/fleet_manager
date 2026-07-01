import type { ReactNode } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

/** Take the inspector as a ReactNode prop, not an import, to keep this view free of store/service imports. */
export function MapInspectorCardView(props: {
  inspector: ReactNode;
  canAddReverseEdge: boolean;
  hasReverseEdge: boolean;
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
            <RotateCcw /> {props.hasReverseEdge ? "Select reverse edge" : "Add reverse edge"}
          </button>
          <button className="secondary-button danger" type="button" onClick={props.onDeleteSelection}>
            <Trash2 /> Delete selection
          </button>
        </div>
      </section>
    </>
  );
}
