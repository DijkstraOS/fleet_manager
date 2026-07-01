import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/** Displays whole meters (precision isn't meaningful at floor scale) but commits the exact typed value. */
export function CalibrationField(props: {
  label: string;
  value: number;
  readOnly?: boolean;
  onCommit: (value: number) => void;
  action?: ReactNode;
}) {
  const [draft, setDraft] = useState(() => format(props.value));

  useEffect(() => {
    setDraft(format(props.value));
  }, [props.value]);

  function commit() {
    const next = Number(draft);
    if (!Number.isFinite(next) || next <= 0) {
      setDraft(format(props.value));
      return;
    }
    // Display unchanged: don't commit, or the rounded value would clobber the exact one.
    if (format(next) === format(props.value)) {
      setDraft(format(props.value));
      return;
    }
    props.onCommit(next);
    setDraft(format(next));
  }

  const input = (
    <input
      type="number"
      min="0"
      step="1"
      inputMode="numeric"
      readOnly={props.readOnly}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );

  return (
    <label className="field">
      <span>{props.label}</span>
      {props.action ? (
        <div className="field-with-action">
          {input}
          {props.action}
        </div>
      ) : (
        input
      )}
    </label>
  );
}

function format(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : "";
}
