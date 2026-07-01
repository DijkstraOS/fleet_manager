import { X } from "lucide-react";
import type { ReactNode } from "react";

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
