import { getQuadraticBezierHandle, isSupportedQuadraticBezier, type MapEdge, type MapNode } from "@agv/core";
import { Scissors } from "lucide-react";

export function InspectorView(props: {
  node: MapNode | null;
  edge: MapEdge | null;
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
  if (props.node) return <NodeInspector node={props.node} onChange={props.onChangeNode} />;
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

function NodeInspector(props: { node: MapNode; onChange: (node: MapNode) => void }) {
  return (
    <section>
      <h2>Node</h2>
      <Field label="ID" value={props.node.id} onChange={(id) => props.onChange({ ...props.node, id })} />
      <Field label="Label" value={props.node.label} onChange={(label) => props.onChange({ ...props.node, label })} />
      <NumberField label="X" value={props.node.x} onChange={(x) => props.onChange({ ...props.node, x })} />
      <NumberField label="Y" value={props.node.y} onChange={(y) => props.onChange({ ...props.node, y })} />
      <NumberField label="Theta" value={props.node.theta ?? 0} onChange={(theta) => props.onChange({ ...props.node, theta })} />
    </section>
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
