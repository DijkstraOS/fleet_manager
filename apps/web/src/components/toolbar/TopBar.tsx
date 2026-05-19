import {
  Download,
  Link,
  MousePointer2,
  Plus,
  Route,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { ToolButton } from "./ToolButton";

export type ToolMode = "select" | "node" | "edge" | "route";

export function TopBar(props: {
  mapName: string;
  tool: ToolMode;
  canSendOrder: boolean;
  onRenameMap: (name: string) => void;
  onSetTool: (tool: ToolMode) => void;
  onDeleteSelection: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onSendOrder: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">AGV Map Simulator</div>
        <input
          className="map-title"
          value={props.mapName}
          onChange={(event) => props.onRenameMap(event.target.value)}
        />
      </div>
      <div className="toolbar">
        <ToolButton active={props.tool === "select"} title="Select" onClick={() => props.onSetTool("select")} icon={<MousePointer2 />} />
        <ToolButton active={props.tool === "node"} title="Node" onClick={() => props.onSetTool("node")} icon={<Plus />} />
        <ToolButton active={props.tool === "edge"} title="Edge" onClick={() => props.onSetTool("edge")} icon={<Link />} />
        <ToolButton active={props.tool === "route"} title="Route" onClick={() => props.onSetTool("route")} icon={<Route />} />
        <button className="icon-button" title="Delete selected" onClick={props.onDeleteSelection}><Trash2 /></button>
        <button className="icon-button" title="Save map" onClick={props.onSave}><Save /></button>
        <label className="icon-button" title="Import LIF">
          <Upload />
          <input
            type="file"
            accept="application/json,.json,.lif"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) props.onImport(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button className="icon-button" title="Export LIF" onClick={props.onExport}><Download /></button>
        <button className="action-button primary" onClick={props.onSendOrder} disabled={!props.canSendOrder}>
          <Route /> Send Order
        </button>
      </div>
    </header>
  );
}
