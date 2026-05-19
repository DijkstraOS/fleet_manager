import type { ReactNode } from "react";

export function ToolButton(props: {
  active: boolean;
  title: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={props.active ? "icon-button active" : "icon-button"} title={props.title} onClick={props.onClick}>
      {props.icon}
    </button>
  );
}
