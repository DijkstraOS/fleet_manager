import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { renderTallySnapshot, setRenderTallyEnabled } from "./lib/render-tally";
import "./styles.css";

// Dev-only: expose render counts as window.__renderTally(). Cast import.meta.env rather than pull in vite/client types this app doesn't reference.
const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
if (env?.DEV) {
  setRenderTallyEnabled(true);
  (window as unknown as { __renderTally: () => Record<string, number> }).__renderTally =
    renderTallySnapshot;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
