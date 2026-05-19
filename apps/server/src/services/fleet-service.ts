import type { FleetGateway, FleetHandlers } from "../domain/ports";

export function createFleetHandlers(fleetGateway: FleetGateway): FleetHandlers {
  return {
    listAgvs: () => fleetGateway.listAgvs(),
  };
}
