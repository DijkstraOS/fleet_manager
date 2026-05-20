import type { MapEdge, MapNode } from "@agv/core";

export function InspectorView(props: {
  node: MapNode | null;
  edge: MapEdge | null;
  onChangeNode: (node: MapNode) => void;
  onChangeEdge: (edge: MapEdge) => void;
}) {
  if (props.node) return <NodeInspector node={props.node} onChange={props.onChangeNode} />;
  if (props.edge) return <EdgeInspector edge={props.edge} onChange={props.onChangeEdge} />;

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

function EdgeInspector(props: { edge: MapEdge; onChange: (edge: MapEdge) => void }) {
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
      <p className="muted">Trajectory data is preserved for LIF import/export, but editing curves is intentionally outside this MVP.</p>
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
