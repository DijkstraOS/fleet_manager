import type { FastifyInstance } from "fastify";
import type { RouteDocument } from "@agv/core";
import type { RouteHandlers } from "../domain/ports";
import { isServiceError } from "../services/order-service";

export function registerRouteRoutes(fastify: FastifyInstance, routes: RouteHandlers) {
  fastify.get<{ Querystring: { mapId?: string } }>("/api/routes", async (request) => {
    return routes.listRoutes(request.query.mapId);
  });

  fastify.post<{ Body: RouteDocument }>("/api/routes", async (request, reply) => {
    try {
      return await routes.saveRoute(request.body);
    } catch (error) {
      if (isServiceError(error)) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid route.",
      });
    }
  });

  fastify.delete<{ Params: { id: string } }>("/api/routes/:id", async (request, reply) => {
    const deleted = await routes.deleteRoute(request.params.id);
    if (!deleted) return reply.code(404).send({ error: "Route not found." });
    return { ok: true };
  });
}
