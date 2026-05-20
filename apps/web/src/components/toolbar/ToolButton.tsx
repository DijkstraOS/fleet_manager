import type { ReactNode } from "react";

export function ToolButton(props: {
  active: boolean;
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={props.active ? "icon-button active" : "icon-button"}
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.icon}
    </button>
  );
}
