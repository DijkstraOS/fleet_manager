import type { FastifyInstance } from "fastify";
import type { FleetHandlers } from "../domain/ports";

export function registerFleetRoutes(fastify: FastifyInstance, fleet: FleetHandlers) {
  fastify.get("/api/agvs", async () => fleet.listAgvs());
}
