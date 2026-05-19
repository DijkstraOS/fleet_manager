# AGV Map Simulator MVP

Lean TypeScript MVP for creating a VDA-shaped AGV map, running a dummy AGV, sending an order, and watching the AGV move.

## Run

```bash
npm install
npm run build
npm run dev
```

Open `http://localhost:5173`.

The server runs on `http://localhost:4000`, WebSocket on `/ws`, and the embedded MQTT broker on `mqtt://127.0.0.1:1883`.

## Workspace

- `apps/web`: React/Vite SVG map editor and live simulator view.
- `apps/server`: Fastify API, WebSocket hub, and embedded MQTT broker.
- `apps/simulator`: dummy VDA AGV client.
- `packages/core`: map, LIF, VDA order, and simulator domain logic.

## Verify

```bash
npm run build
npm test
npm run test:e2e
npm run license:check
```

If this is the first Playwright run on a machine, install Chromium once with `npx playwright install chromium`.

## Scope

- Custom SVG grid map editor.
- Directed nodes and edges.
- LIF import/export with trajectory data preserved but not edited.
- Dummy AGV simulator over MQTT.
- REST order creation and WebSocket realtime updates.

The GPL-3.0 LIF editor is not used or embedded.
