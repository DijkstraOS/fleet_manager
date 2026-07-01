// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { renderCount, renderTallySnapshot } from "../../../lib/render-tally";
import { agvFrame, cleanup, mountCanvas, panFrame, seedStores } from "./render-harness";

/** Pillar B render-locality guards (see tests/perf/README.md). Counts are map-size-independent: a `1` against a layer means the whole-graph render ran once, not that it drew one item. */

afterEach(() => cleanup());

describe("render budget: AGV frame (the worst cascade)", () => {
  it("map mode: an AGV frame must not re-render the canvas graph", () => {
    seedStores("map");
    mountCanvas();
    agvFrame();
    // Fleet selectors are mode-gated to stable singletons in map mode → an AGV frame must trigger zero canvas re-renders.
    expect(renderCount("MapCanvasView")).toBe(0);
    expect(renderCount("EdgeLayer")).toBe(0);
    expect(renderCount("NodeLayer")).toBe(0);
  });

  it("tracking mode: an AGV frame re-renders only its marker, never the static graph", () => {
    seedStores("tracking");
    mountCanvas();
    agvFrame();
    // Markers self-subscribe in <AgvOverlay>/<AgvMarker>; the static canvas must not subscribe to fleet churn outside map mode.
    expect(renderCount("MapCanvasView")).toBe(0);
    expect(renderCount("EdgeLayer")).toBe(0);
    expect(renderCount("NodeLayer")).toBe(0);
    expect(renderCount("GridLayer")).toBe(0);
    expect(renderCount("AgvMarker:SIM1")).toBe(1);
    expect(renderTallySnapshot()).toMatchObject({ "AgvMarker:SIM1": 1 });
  });
});

describe("render budget: pan / zoom (the highest-frequency gesture)", () => {
  it("map mode: a pan frame does not re-render the node/edge graph", () => {
    seedStores("map");
    mountCanvas();
    panFrame();
    // StaticGraph's props are viewport-independent and referentially stable, so its memo MUST bail on a pan; only the shell (viewBox + FloorLayer letterbox) may re-render. Fails if the graph re-subscribes to the viewport.
    expect(renderCount("StaticGraph")).toBe(0);
    expect(renderCount("EdgeLayer")).toBe(0);
    expect(renderCount("NodeLayer")).toBe(0);
    expect(renderCount("MapCanvasView")).toBe(1);
    expect(renderCount("FloorLayer")).toBe(1);
  });
});
