import { createRequire } from "node:module";
import net from "node:net";
import type { createBroker as createBrokerType } from "aedes";

const require = createRequire(import.meta.url);
const createBroker = require("aedes") as typeof createBrokerType;

export interface LocalBrokerOptions {
  port?: number;
  host?: string;
  log?: Pick<Console, "log" | "error"> | false;
}

export interface LocalBrokerRuntime {
  brokerUrl: string;
  start: () => Promise<void>;
  close: () => Promise<void>;
}

export function createLocalBroker(options: LocalBrokerOptions = {}): LocalBrokerRuntime {
  const port = options.port ?? 1883;
  const host = options.host ?? "127.0.0.1";
  const brokerUrl = `mqtt://${host}:${port}`;
  const log = options.log === false ? null : options.log ?? console;
  const broker = createBroker();
  const server = net.createServer(broker.handle);
  let started = false;

  return {
    brokerUrl,
    start: async () => {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          started = true;
          log?.log(`[broker] MQTT broker listening on ${brokerUrl}`);
          resolve();
        });
      });
    },
    close: async () => {
      if (started) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else {
              started = false;
              resolve();
            }
          });
        });
      }
      await new Promise<void>((resolve) => broker.close(resolve));
    },
  };
}
