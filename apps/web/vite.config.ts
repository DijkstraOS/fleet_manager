import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const webPort = Number(process.env.VITE_WEB_PORT || 5173);
const apiTarget = process.env.VITE_API_TARGET || "http://127.0.0.1:4000";

export default defineConfig({
  plugins: [react() as unknown as never],
  resolve: {
    alias: {
      "@agv/core": resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
  server: {
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": apiTarget,
      "/ws": {
        target: apiTarget.replace(/^http/, "ws"),
        ws: true,
      },
    },
  },
});
