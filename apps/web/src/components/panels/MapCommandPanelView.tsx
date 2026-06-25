import type { ReactNode } from "react";
import {
  Download,
  Image,
  Link,
  Lock,
  Maximize2,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import type { EditorBackgroundImage, Selection, Tool } from "../../types";
import { ToolButton } from "../toolbar/ToolButton";

export function MapCommandPanelView(props: {
  tool: Tool;
  selection: Selection;
  backgroundImage: EditorBackgroundImage | null;
  canAddReverseEdge: boolean;
  inspector: ReactNode;
  onSetTool: (tool: Tool) => void;
  onDeleteSelection: () => void;
  onAddReverseEdge: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onUploadBackground: (file: File) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onFitBackground: () => void;
  onSetBackgroundLocked: (locked: boolean) => void;
  onRemoveBackground: () => void;
}) {
  return (
    <aside className="right-panel command-panel">
      <section>
        <h2>Map Tools</h2>
        <div className="tool-grid">
          <ToolButton active={props.tool === "select"} title="Select and move nodes" onClick={() => props.onSetTool("select")} icon={<MousePointer2 />} />
          <ToolButton active={props.tool === "node"} title="Add node" onClick={() => props.onSetTool("node")} icon={<Plus />} />
          <ToolButton active={props.tool === "edge"} title="Add one-way edge" onClick={() => props.onSetTool("edge")} icon={<Link />} />
          <ToolButton active={props.tool === "background"} title="Move and scale background" onClick={() => props.onSetTool("background")} icon={<Image />} disabled={!props.backgroundImage} />
          <ToolButton active={false} title="Add reverse edge" onClick={props.onAddReverseEdge} icon={<RotateCcw />} disabled={!props.canAddReverseEdge} />
        </div>
      </section>

      <section>
        <h2>Background</h2>
        <div className="command-stack">
          <label className="secondary-button file-command">
            <Upload /> Upload image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) props.onUploadBackground(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {props.backgroundImage && (
            <>
              <div className="background-summary">
                <Image />
                <span>{props.backgroundImage.fileName}</span>
              </div>
              <label className="range-field">
                <span>Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(props.backgroundImage.opacity * 100)}
                  onChange={(event) => props.onSetBackgroundOpacity(Number(event.currentTarget.value) / 100)}
                />
              </label>
              <button className="secondary-button" type="button" onClick={props.onFitBackground}>
                <Maximize2 /> Fit to map
              </button>
              <button className="secondary-button" type="button" onClick={() => props.onSetBackgroundLocked(!props.backgroundImage?.locked)}>
                {props.backgroundImage.locked ? <Unlock /> : <Lock />}
                {props.backgroundImage.locked ? "Unlock background" : "Lock background"}
              </button>
              <button className="secondary-button danger" type="button" onClick={props.onRemoveBackground}>
                <Trash2 /> Remove background
              </button>
            </>
          )}
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

      {props.inspector}
    </aside>
  );
}
