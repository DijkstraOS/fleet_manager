import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

export type RealtimeMessage = {
  type: string;
  [key: string]: unknown;
};

export class RealtimeHub {
  private wss: WebSocketServer;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws) => {
      ws.send(JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }));
    });
  }

  broadcast(message: RealtimeMessage) {
    const payload = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  async close() {
    await new Promise<void>((resolve, reject) => {
      this.wss.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
