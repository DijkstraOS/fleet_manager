import { MapCanvasView } from "./MapCanvasView";
import { useMapCanvasController } from "./useMapCanvasController";

export function MapCanvas() {
  return <MapCanvasView {...useMapCanvasController()} />;
}
