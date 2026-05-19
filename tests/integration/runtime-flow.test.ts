import net from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDemoMap } from "@agv/core";
import { expect, test } from "vitest";
import { createAgvServer } from "../../apps/server/src/app.js";
import { createSimulatorClient } from "../../apps/simulator/src/runtime.js";

test("creates a map, starts a dummy AGV, sends an order, and completes it", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "agv-new-runtime-"));
  const port = await getFreePort();
  const mqttPort = await getFreePort();
  const interfaceName = `agv-test-${Date.now()}`;
  const server = await createAgvServer({
    port,
    mqttPort,
    interfaceName,
    mapStorePath: join(tempDir, "maps.json"),
    logger: false,
  });
  const simulator = createSimulatorClient({
    mqttBroker: `mqtt://127.0.0.1:${mqttPort}`,
    interfaceName,
    log: false,
  });

  try {
    await server.start();
    await simulator.start();

    const apiBase = `http://127.0.0.1:${port}`;
    const map = { ...createDemoMap(), id: "integration-map", name: "Integration Map" };
    await postJson(`${apiBase}/api/maps`, map);
    await postJson(`${apiBase}/api/sim/agvs`, {
      serialNumber: "SIM-IT",
      manufacturer: "DijkstraSim",
      mapId: map.id,
      startNodeId: "dock-a",
      speedMetersPerSecond: 20,
    });

    const idle = await waitForAgv(apiBase, (agv) => agv.state?.driving === false);
    expect(idle.state?.lastNodeId).toBe("dock-a");

    await postJson(`${apiBase}/api/orders`, {
      mapId: map.id,
      agvSerialNumber: "SIM-IT",
      routeNodeIds: ["dock-a", "corr-1", "corr-2"],
    });

    const driving = await waitForAgv(apiBase, (agv) => agv.state?.driving === true);
    expect(driving.state?.orderId).toContain("order-");

    const completed = await waitForAgv(
      apiBase,
      (agv) => agv.state?.driving === false && agv.state?.lastNodeId === "corr-2"
    );
    expect(completed.state?.orderId).toBe("");
  } finally {
    await simulator.stop();
    await server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}, 15_000);

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<unknown>;
}

async function waitForAgv(
  apiBase: string,
  predicate: (agv: RuntimeAgv) => boolean,
  timeoutMs = 8_000
) {
  const startedAt = Date.now();
  let lastAgv: RuntimeAgv | undefined;
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${apiBase}/api/agvs`);
    const agvs = (await response.json()) as RuntimeAgv[];
    lastAgv = agvs.find((agv) => agv.serialNumber === "SIM-IT");
    if (lastAgv && predicate(lastAgv)) return lastAgv;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for AGV state. Last state: ${JSON.stringify(lastAgv)}`);
}

async function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a port.")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

interface RuntimeAgv {
  serialNumber: string;
  state?: {
    orderId: string;
    lastNodeId: string;
    driving: boolean;
  };
}
