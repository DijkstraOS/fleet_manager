import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react() as unknown as never],
  resolve: {
    alias: {
      "@agv/core": resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4000",
      "/ws": {
        target: "ws://127.0.0.1:4000",
        ws: true,
      },
    },
  },
});
