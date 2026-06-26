import { getQuadraticBezierHandle, isSupportedQuadraticBezier, type MapEdge, type MapNode, type NodeIdEditPolicy } from "@agv/core";
import { Pencil, Scissors } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function InspectorView(props: {
  node: MapNode | null;
  edge: MapEdge | null;
  nodeIdEditPolicy: NodeIdEditPolicy;
  onChangeNode: (node: MapNode) => void;
  onChangeEdge: (edge: MapEdge) => void;
  onMakeEdgeCurve: () => void;
  onResetEdgeCurve: () => void;
  onStraightenEdge: () => void;
  hasReverseEdge: boolean;
  includeReverseEdge: boolean;
  onIncludeReverseEdgeChange: (includeReverseEdge: boolean) => void;
  onBifurcateEdge: () => void;
  onChangeCurveHandle: (x: number, y: number) => void;
}) {
  if (props.node) return <NodeInspector node={props.node} idEditPolicy={props.nodeIdEditPolicy} onChange={props.onChangeNode} />;
  if (props.edge) {
    return (
      <EdgeInspector
        edge={props.edge}
        onChange={props.onChangeEdge}
        onMakeCurve={props.onMakeEdgeCurve}
        onResetCurve={props.onResetEdgeCurve}
        onStraighten={props.onStraightenEdge}
        hasReverseEdge={props.hasReverseEdge}
        includeReverseEdge={props.includeReverseEdge}
        onIncludeReverseEdgeChange={props.onIncludeReverseEdgeChange}
        onBifurcate={props.onBifurcateEdge}
        onChangeCurveHandle={props.onChangeCurveHandle}
      />
    );
  }

  return (
    <section>
      <h2>Inspector</h2>
      <p className="muted">Select a node or edge to edit properties.</p>
    </section>
  );
}

function NodeInspector(props: { node: MapNode; idEditPolicy: NodeIdEditPolicy; onChange: (node: MapNode) => void }) {
  return (
    <section>
      <h2>Node</h2>
      <NodeIdField node={props.node} policy={props.idEditPolicy} onChange={props.onChange} />
      <Field label="Label" value={props.node.label} onChange={(label) => props.onChange({ ...props.node, label })} />
      <NumberField label="X" value={props.node.x} onChange={(x) => props.onChange({ ...props.node, x })} />
      <NumberField label="Y" value={props.node.y} onChange={(y) => props.onChange({ ...props.node, y })} />
      <NumberField label="Theta" value={props.node.theta ?? 0} onChange={(theta) => props.onChange({ ...props.node, theta })} />
    </section>
  );
}

/**
 * The node ID is read-only by default. A pencil opts into editing, gated by the
 * live policy: `"locked"` shows no pencil at all; `"editable-with-edge-warning"`
 * requires confirming a warning first; `"editable"` unlocks on the first tap.
 * `isEditing` is transient UI state only — it resets when the selected node
 * changes, so each selection starts read-only.
 */
function NodeIdField(props: { node: MapNode; policy: NodeIdEditPolicy; onChange: (node: MapNode) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const locked = props.policy === "locked";

  // Each new node selection starts read-only. The selected node's id mutates on
  // every keystroke while editing (the rename cascades through `updateNode`), so
  // we can't relock on any id change — that would drop focus mid-rename. We mark
  // self-inflicted id changes (our own `onChange`) and relock only when the id
  // changes WITHOUT that mark, i.e. a different node was selected.
  const previousIdRef = useRef(props.node.id);
  const selfRenamedRef = useRef(false);
  useEffect(() => {
    if (previousIdRef.current !== props.node.id && !selfRenamedRef.current) {
      setIsEditing(false);
    }
    previousIdRef.current = props.node.id;
    selfRenamedRef.current = false;
  });

  function onPencilClick() {
    if (props.policy === "editable-with-edge-warning") {
      const confirmed = window.confirm("You're about to edit the ID of a node that has edges.");
      if (!confirmed) return;
    }
    setIsEditing(true);
  }

  function onIdChange(id: string) {
    selfRenamedRef.current = true;
    props.onChange({ ...props.node, id });
  }

  return (
    <label className="field">
      <span>ID</span>
      <div className="field-with-action">
        <input
          value={props.node.id}
          disabled={locked || !isEditing}
          onChange={(event) => onIdChange(event.target.value)}
        />
        {!locked && !isEditing && (
          <button type="button" className="icon-button" aria-label="Edit ID" onClick={onPencilClick}>
            <Pencil />
          </button>
        )}
      </div>
      {locked && <span className="muted">ID is referenced by a route or station and can't be edited.</span>}
    </label>
  );
}

function EdgeInspector(props: {
  edge: MapEdge;
  onChange: (edge: MapEdge) => void;
  onMakeCurve: () => void;
  onResetCurve: () => void;
  onStraighten: () => void;
  hasReverseEdge: boolean;
  includeReverseEdge: boolean;
  onIncludeReverseEdgeChange: (includeReverseEdge: boolean) => void;
  onBifurcate: () => void;
  onChangeCurveHandle: (x: number, y: number) => void;
}) {
  const supportedCurve = isSupportedQuadraticBezier(props.edge.trajectory);
  const handle = getQuadraticBezierHandle(props.edge.trajectory);
  return (
    <section>
      <h2>Edge</h2>
      <div className="property-row">
        <span>Direction</span>
        <strong>{props.edge.from} {"->"} {props.edge.to}</strong>
      </div>
      <NumberField label="Max speed" value={props.edge.maxSpeed ?? 1.2} onChange={(maxSpeed) => props.onChange({ ...props.edge, maxSpeed })} />
      <NumberField label="Orientation" value={props.edge.orientation ?? 0} onChange={(orientation) => props.onChange({ ...props.edge, orientation })} />
      <label className="field">
        <span>Orientation type</span>
        <select value={props.edge.orientationType} onChange={(event) => props.onChange({ ...props.edge, orientationType: event.target.value as MapEdge["orientationType"] })}>
          <option value="TANGENTIAL">Tangential</option>
          <option value="GLOBAL">Global</option>
        </select>
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={props.edge.rotationAllowed} onChange={(event) => props.onChange({ ...props.edge, rotationAllowed: event.target.checked })} />
        Rotation allowed
      </label>
      {props.hasReverseEdge && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={props.includeReverseEdge}
            onChange={(event) => props.onIncludeReverseEdgeChange(event.target.checked)}
          />
          Include reverse edge
        </label>
      )}
      <div className="curve-actions">
        <button className="secondary-button" type="button" onClick={props.onBifurcate}>
          <Scissors /> Bifurcate edge
        </button>
        <button className="secondary-button" type="button" onClick={props.onMakeCurve} disabled={supportedCurve}>
          Make curve
        </button>
        <button className="secondary-button" type="button" onClick={props.onResetCurve}>
          Reset curve
        </button>
        <button className="secondary-button danger" type="button" onClick={props.onStraighten} disabled={!props.edge.trajectory}>
          Straighten
        </button>
      </div>
      {props.edge.trajectory && !supportedCurve && (
        <p className="muted">This imported trajectory is preserved, but reset it before editing as a quadratic curve.</p>
      )}
      {handle && (
        <>
          <NumberField label="Curve handle X" value={handle.x} onChange={(x) => props.onChangeCurveHandle(x, handle.y)} />
          <NumberField label="Curve handle Y" value={handle.y} onChange={(y) => props.onChangeCurveHandle(handle.x, y)} />
        </>
      )}
    </section>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function NumberField(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input type="number" step="0.1" value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} />
    </label>
  );
}
