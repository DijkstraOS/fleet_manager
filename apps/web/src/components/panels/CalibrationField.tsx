import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * A meters number field for floor calibration. The value is displayed rounded to
 * whole meters (precision isn't meaningful at floor scale) while the underlying
 * value stays exact. The input holds its own draft string so a partially-typed
 * value (e.g. "12.") isn't clobbered mid-edit, and only a valid positive number
 * is committed (on blur / Enter). Invalid or empty input — or a blur that didn't
 * change the displayed whole-meter value — reverts to the last committed value,
 * leaving the exact underlying value untouched. An optional trailing `action`
 * (e.g. the aspect lock toggle) renders beside the input.
 */
export function CalibrationField(props: {
  label: string;
  value: number;
  readOnly?: boolean;
  onCommit: (value: number) => void;
  action?: ReactNode;
}) {
  const [draft, setDraft] = useState(() => format(props.value));

  // Keep the draft in sync when the committed value changes from elsewhere
  // (e.g. an aspect-locked width change updating the height).
  useEffect(() => {
    setDraft(format(props.value));
  }, [props.value]);

  function commit() {
    const next = Number(draft);
    if (!Number.isFinite(next) || next <= 0) {
      setDraft(format(props.value));
      return;
    }
    // The field shows whole meters; a blur that didn't change the displayed
    // value must not round-clobber the exact underlying value.
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
