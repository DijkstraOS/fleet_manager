import { useRenderTally } from "../../lib/render-tally";
import { MapCanvasView } from "./MapCanvasView";
import { useMapCanvasController } from "./useMapCanvasController";

export function MapCanvas() {
  useRenderTally("MapCanvas");
  return <MapCanvasView {...useMapCanvasController()} />;
}
