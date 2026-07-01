import {
  Download,
  Image,
  Link,
  Lock,
  MousePointer2,
  Plus,
  Save,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import type { CanvasSize } from "@agv/core";
import type { EditorBackgroundImage, Tool } from "../../types";
import { ToolButton } from "../toolbar/ToolButton";
import { CalibrationField } from "./CalibrationField";

export function MapLeftPanelView(props: {
  tool: Tool;
  backgroundImage: EditorBackgroundImage | null;
  canvas: CanvasSize;
  heightAspectLocked: boolean;
  onSetTool: (tool: Tool) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onUploadBackground: (file: File) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onRemoveBackground: () => void;
  onSetCanvasWidth: (width: number) => void;
  onSetCanvasHeight: (height: number) => void;
  onSetHeightAspectLocked: (locked: boolean) => void;
}) {
  const heightLocked = props.backgroundImage !== null && props.heightAspectLocked;
  return (
    <aside className="left-panel command-panel">
      <section>
        <h2>Map Tools</h2>
        <div className="tool-grid">
          <ToolButton active={props.tool === "select"} title="Select and move nodes" onClick={() => props.onSetTool("select")} icon={<MousePointer2 />} />
          <ToolButton active={props.tool === "node"} title="Add node" onClick={() => props.onSetTool("node")} icon={<Plus />} />
          <ToolButton active={props.tool === "edge"} title="Add one-way edge" onClick={() => props.onSetTool("edge")} icon={<Link />} />
        </div>
      </section>

      <section>
        <h2>Background</h2>
        <div className="command-stack">
          <label className="secondary-button file-command">
            <Upload /> {props.backgroundImage ? "Replace image" : "Upload image"}
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
            <div className="background-summary">
              <Image />
              <span>{props.backgroundImage.fileName}</span>
            </div>
          )}

          <CalibrationField
            label="Width (m)"
            value={props.canvas.width}
            onCommit={props.onSetCanvasWidth}
          />
          <CalibrationField
            label="Height (m)"
            value={props.canvas.height}
            readOnly={heightLocked}
            onCommit={props.onSetCanvasHeight}
            action={
              props.backgroundImage && (
                <button
                  className="icon-button"
                  type="button"
                  title={props.heightAspectLocked ? "Unlock height (distorted scan)" : "Lock height to image aspect"}
                  onClick={() => props.onSetHeightAspectLocked(!props.heightAspectLocked)}
                >
                  {props.heightAspectLocked ? <Lock /> : <Unlock />}
                </button>
              )
            }
          />

          {props.backgroundImage && (
            <>
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
    </aside>
  );
}
