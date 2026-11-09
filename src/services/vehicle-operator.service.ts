import { mockDelay, mockNow } from "@/lib/mock";

/**
 * Client exploitant d'un véhicule (§III.5) — SERVICE SIMULÉ.
 *
 * Le client propriétaire est `vehicle.organizationId` (API réelle). Le client
 * exploitant, quand il diffère (location, sous-traitance), n'existe pas encore
 * côté API : routes attendues GET / PUT /admin/vehicles/:id/operator.
 * null = le propriétaire exploite lui-même le véhicule.
 */

export interface VehicleOperator {
  vehicleId: string;
  organizationId: string | null;
  organizationName: string | null;
  updatedAt: string | null;
}

const store = new Map<string, VehicleOperator>();

export const vehicleOperatorService = {
  async get(vehicleId: string): Promise<VehicleOperator> {
    await mockDelay(150);
    return store.get(vehicleId) ?? { vehicleId, organizationId: null, organizationName: null, updatedAt: null };
  },

  async set(
    vehicleId: string,
    operator: { organizationId: string; organizationName: string } | null,
  ): Promise<VehicleOperator> {
    await mockDelay();
    const next: VehicleOperator = {
      vehicleId,
      organizationId: operator?.organizationId ?? null,
      organizationName: operator?.organizationName ?? null,
      updatedAt: mockNow(),
    };
    store.set(vehicleId, next);
    return next;
  },
};
