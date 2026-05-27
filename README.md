# AGV Map Simulator MVP

Lean TypeScript MVP for creating a VDA 5050 v2.1 AGV map flow, running a dummy AGV, sending an order, and watching the AGV move.

## Run

First-time setup:

```bash
npm install
```

Run the system:

```bash
npm start
```

Open `http://localhost:5173`.

After setup, `npm start` is the single command to run the system.

That command starts the web app, API server, standalone local MQTT broker, and dummy AGV simulator together. The server runs on `http://localhost:4000`, WebSocket on `/ws`, and the broker on `mqtt://127.0.0.1:1883`.

## Workspace

- `apps/web`: React/Vite SVG map editor and live simulator view.
- `apps/broker`: local Aedes MQTT broker process for development.
- `apps/server`: Fastify API, WebSocket hub, and `vda-5050-lib` master-control client.
- `apps/simulator`: dummy AGV runtime using `vda-5050-lib` AGV clients plus simulator motion/state logic.
- `packages/core`: map, `vdma-lif`-validated LIF import/export, and VDA 5050 v2.1 order domain logic.

## Verify

```bash
npm run build
npm test
npm run test:e2e
```

If this is the first Playwright run on a machine, install Chromium once with `npx playwright install chromium`.

## Scope

- Custom SVG grid map editor.
- Directed nodes and edges.
- LIF import/export validated with `vdma-lif`; trajectory and unmodeled external fields are preserved where possible but not fully edited.
- Dummy AGV simulator over MQTT.
- REST order creation and WebSocket realtime updates.

The GPL-3.0 LIF editor is not used or embedded.
