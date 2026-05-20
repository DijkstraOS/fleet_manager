import { validateRouteDocument } from "@agv/core";
import type { MapRepository, RealtimePublisher, RouteHandlers, RouteRepository } from "../domain/ports";
import { createServiceError } from "./order-service";

export function createRouteHandlers(
  routes: RouteRepository,
  maps: MapRepository,
  realtime: RealtimePublisher
): RouteHandlers {
  return {
    listRoutes: (mapId) => routes.list(mapId),

    saveRoute: async (route) => {
      const issues = validateRouteDocument(maps.get(route.mapId), route);
      if (issues.length > 0) {
        throw createServiceError(400, issues.map((issue) => issue.message).join(" "));
      }
      const saved = await routes.upsert(route);
      realtime.broadcast({ type: "route_updated", route: saved });
      return saved;
    },

    deleteRoute: async (id) => {
      const deleted = await routes.delete(id);
      if (deleted) realtime.broadcast({ type: "route_deleted", routeId: id });
      return deleted;
    },
  };
}
