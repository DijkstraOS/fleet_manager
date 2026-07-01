import { Save, Trash2, Undo2 } from "lucide-react";
import type { ValidationIssue } from "@agv/core";

export function RouteEditorCardView(props: {
  selectedRouteId: string | null;
  draftRouteName: string;
  draftRouteNodeIds: string[];
  routeIssues: ValidationIssue[];
  routeStatus: string;
  canSaveRoute: boolean;
  onDraftName: (name: string) => void;
  onRemoveLastNode: () => void;
  onClearRoute: () => void;
  onSaveRoute: () => void;
  onDeleteRoute: () => void;
}) {
  return (
    <section>
      <label className="field">
        <span>Name</span>
        <input value={props.draftRouteName} onChange={(event) => props.onDraftName(event.target.value)} />
      </label>
      <div className="route-list">
        {props.draftRouteNodeIds.length === 0 ? <span className="muted">Click nodes on the map in travel order.</span> : props.draftRouteNodeIds.join(" -> ")}
      </div>
      {props.routeIssues.length > 0 && <p className="error-text">{props.routeIssues[0]?.message}</p>}
      <div className="command-stack">
        <button type="button" className="secondary-button" onClick={props.onRemoveLastNode} disabled={props.draftRouteNodeIds.length === 0}>
          <Undo2 /> Remove last node
        </button>
        <button type="button" className="secondary-button" onClick={props.onClearRoute} disabled={props.draftRouteNodeIds.length === 0}>
          Clear route
        </button>
        <button type="button" className="secondary-button" onClick={props.onSaveRoute} disabled={!props.canSaveRoute}>
          <Save /> Save route
        </button>
        <button type="button" className="secondary-button danger" onClick={props.onDeleteRoute} disabled={!props.selectedRouteId}>
          <Trash2 /> Delete route
        </button>
      </div>
      <p className="status-subtext">{props.routeStatus}</p>
    </section>
  );
}
