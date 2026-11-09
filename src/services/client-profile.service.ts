import { mockClone, mockDelay, mockNow } from "@/lib/mock";
import type { ClientProfile, UpdateClientProfilePayload } from "@/types/client-profile";

/**
 * Fiches commerciales des clients — SERVICE SIMULÉ.
 *
 * Routes attendues : GET /admin/organizations/:id/profile, PATCH du même chemin,
 * et GET /admin/client-profiles?organizationIds= pour la liste. Une organisation
 * sans fiche renvoie une fiche par défaut (`completed: false`), jamais une 404.
 */

const store = new Map<string, ClientProfile>();

function blank(organizationId: string): ClientProfile {
  return {
    organizationId,
    legalName: null,
    tradeName: null,
    clientType: "owner",
    registrationNumber: null,
    address: null,
    city: null,
    country: null,
    manager: { name: null, position: null, phone: null, email: null },
    relationStartDate: null,
    salesRep: null,
    specialConditions: null,
    notes: null,
    status: "active",
    completed: false,
    updatedAt: null,
  };
}

const read = (organizationId: string) => store.get(organizationId) ?? blank(organizationId);

export const clientProfileService = {
  /** GET /admin/organizations/:id/profile */
  async get(organizationId: string): Promise<ClientProfile> {
    await mockDelay(200);
    return mockClone(read(organizationId));
  },

  /** GET /admin/client-profiles?organizationIds= — fiches des lignes affichées. */
  async many(organizationIds: string[]): Promise<Record<string, ClientProfile>> {
    await mockDelay(200);
    return Object.fromEntries(organizationIds.map((id) => [id, mockClone(read(id))]));
  },

  /** PATCH /admin/organizations/:id/profile */
  async update(organizationId: string, payload: UpdateClientProfilePayload): Promise<ClientProfile> {
    await mockDelay();
    const current = read(organizationId);
    const next: ClientProfile = {
      ...current,
      ...payload,
      manager: { ...current.manager, ...payload.manager },
      completed: true,
      updatedAt: mockNow(),
    };
    store.set(organizationId, next);
    return mockClone(next);
  },
};
