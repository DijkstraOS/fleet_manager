import {
  Download,
  Link,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import type { Selection } from "../../stores/editor-store";
import type { Tool } from "../../types";
import { ToolButton } from "../toolbar/ToolButton";
import { InspectorPanel } from "./Inspector";

export function MapCommandPanel(props: {
  tool: Tool;
  selection: Selection;
  canAddReverseEdge: boolean;
  onSetTool: (tool: Tool) => void;
  onDeleteSelection: () => void;
  onAddReverseEdge: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  return (
    <aside className="right-panel command-panel">
      <section>
        <h2>Map Tools</h2>
        <div className="tool-grid">
          <ToolButton active={props.tool === "select"} title="Select and move nodes" onClick={() => props.onSetTool("select")} icon={<MousePointer2 />} />
          <ToolButton active={props.tool === "node"} title="Add node" onClick={() => props.onSetTool("node")} icon={<Plus />} />
          <ToolButton active={props.tool === "edge"} title="Add one-way edge" onClick={() => props.onSetTool("edge")} icon={<Link />} />
          <ToolButton active={false} title="Add reverse edge" onClick={props.onAddReverseEdge} icon={<RotateCcw />} disabled={!props.canAddReverseEdge} />
        </div>
      </section>

      <section>
        <h2>Map Commands</h2>
        <div className="command-stack">
          <button className="secondary-button" type="button" onClick={props.onDeleteSelection} disabled={!props.selection}>
            <Trash2 /> Delete selection
          </button>
          <button className="secondary-button" type="button" onClick={props.onSave}>
            <Save /> Save map
          </button>
          <label className="secondary-button file-command">
            <Upload /> Import LIF
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
          <button className="secondary-button" type="button" onClick={props.onExport}>
            <Download /> Export LIF
          </button>
        </div>
      </section>

      <InspectorPanel />
    </aside>
  );
}
