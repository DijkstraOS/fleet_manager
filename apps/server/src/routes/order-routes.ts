import type { FastifyInstance } from "fastify";
import type { OrderDraft } from "@agv/core";
import type { OrderHandlers } from "../domain/ports";
import { isServiceError } from "../services/order-service";

export function registerOrderRoutes(fastify: FastifyInstance, orders: OrderHandlers) {
  fastify.post<{ Body: OrderDraft }>("/api/orders", async (request, reply) => {
    try {
      const result = orders.sendOrder(request.body);
      return { ok: true, order: result.order };
    } catch (error) {
      if (isServiceError(error)) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      return reply.code(500).send({ error: "Could not send order." });
    }
  });
}
