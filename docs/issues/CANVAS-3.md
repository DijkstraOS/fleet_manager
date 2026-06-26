# CANVAS-3 — Persist the basemap image as a server asset

**Area:** Canvas · **Effort:** L · **Risk:** Med

The finite `canvas` (width/height meters) already persists in `MapDocument` (CANVAS-0); what's still
ephemeral is the **background image** itself — an in-memory data URL with no `MapDocument` field,
while maps save to a single `data/maps.json`
(`apps/server/src/infra/file-map-repository.ts`). See [design](../design/ui-panels-and-canvas.md).

**Fix:** Add an optional `background` (asset ref + opacity) to `MapDocument`
(`packages/core/src/map/types.ts`). Add a server endpoint to upload/serve/delete the image as a file
asset (kept out of `maps.json`), referenced by the document; clean it up on map delete. Wire web
upload/load/save through the asset ref instead of an in-memory data URL. Absent `background` → no
basemap (the finite floor still exists via CANVAS-0).

**Done when:** calibrate a map, reload (or open elsewhere), and the to-scale basemap is restored;
`data/maps.json` stays free of image bytes; and deleting a map removes its asset. Then delete this
file.
