import type { FastifyInstance } from "fastify";
import type { MapDocument } from "@agv/core";
import type { MapHandlers } from "../domain/ports";

export function registerMapRoutes(fastify: FastifyInstance, maps: MapHandlers) {
  fastify.get("/api/maps", async () => maps.listMaps());

  fastify.get<{ Params: { id: string } }>("/api/maps/:id", async (request, reply) => {
    const map = maps.getMap(request.params.id);
    if (!map) return reply.code(404).send({ error: "Map not found." });
    return map;
  });

  fastify.post<{ Body: MapDocument }>("/api/maps", async (request, reply) => {
    try {
      return await maps.saveMap(request.body);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid map.",
      });
    }
  });

  fastify.post<{ Params: { id: string } }>("/api/maps/:id/export-lif", async (request, reply) => {
    const lif = maps.exportLif(request.params.id);
    if (!lif) return reply.code(404).send({ error: "Map not found." });
    return lif;
  });
}
