import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { RealtimeMessage, RealtimePublisher } from "../domain/ports";

export function createRealtimePublisher(server: HttpServer): RealtimePublisher {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }));
  });

  return {
    broadcast: (message: RealtimeMessage) => {
      const payload = JSON.stringify(message);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    },
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        wss.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
