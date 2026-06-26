import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Presentational floating card that overlays the map's right edge (the "right zone"
 * of the shared 3-zone panel layout). It renders nothing when `open` is false or it
 * has no `children`, so callers can mount it unconditionally and let the card collapse
 * when there is nothing to show. Reused across the Map/Route/Tracking tabs (PANEL-1..3).
 *
 * Pass `onClose` to render a header close button (used where the card has no canvas
 * deselect of its own, e.g. the route editor). Pure props -> JSX (no store/service
 * imports), per the container/view split: a container subscribes to the relevant store
 * and decides what to render inside.
 */
export function FloatingCard(props: { open: boolean; title?: string; onClose?: () => void; children: ReactNode }) {
  if (!props.open || props.children == null) return null;
  return (
    <aside className="floating-card">
      {(props.title || props.onClose) && (
        <header className="floating-card-header">
          {props.title && <h2>{props.title}</h2>}
          {props.onClose && (
            <button type="button" className="floating-card-close" onClick={props.onClose} aria-label="Close editor" title="Close editor">
              <X />
            </button>
          )}
        </header>
      )}
      <div className="floating-card-body">{props.children}</div>
    </aside>
  );
}
