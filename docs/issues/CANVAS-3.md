# CANVAS-3 — Persist the calibrated basemap

**Area:** Canvas · **Effort:** L · **Risk:** Med

Make the basemap survive reload and open on other devices. Today background + calibration are
ephemeral; `MapDocument` (`packages/core/src/map/types.ts`) has no canvas/background fields, and maps
save to a single `data/maps.json` (`apps/server/src/infra/file-map-repository.ts`). See
[design](../design/ui-panels-and-canvas.md).

**Fix:** Add optional `canvas` (width/height meters, aspect, origin) + `background` (asset ref,
opacity) to `MapDocument` — absent → auto-fit, so existing maps stay back-compatible. Add a server
endpoint to upload/serve/delete the image as a file asset (kept out of `maps.json`), referenced by
the document; clean it up on map delete. Wire web upload/load/save through the asset ref instead of
an in-memory data URL.

**Done when:** calibrate a map, reload (or open elsewhere), and the to-scale basemap is restored;
`data/maps.json` stays free of image bytes; deleting a map removes its asset. Then delete this file.
