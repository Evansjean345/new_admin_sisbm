import { mockClone, mockDelay, mockId, mockNow, mockPaginate } from "@/lib/mock";
import { ApiError, type Paginated } from "@/types/api";
import type {
  CreateSubscriptionPayload,
  Subscription,
  SubscriptionListParams,
  SubscriptionStatus,
  UpdateSubscriptionPayload,
  VehicleAssignment,
  VehicleAvailability,
  VehicleSubscriptionHistoryEntry,
} from "@/types/subscription";
import type { Vehicle } from "@/types/vehicle";

import { offerService } from "./offer.service";
import { organizationService } from "./organization.service";
import { vehicleService } from "./vehicle.service";

/**
 * Souscriptions — SERVICE SIMULÉ.
 *
 * L'API n'expose pas encore `/admin/subscriptions`. Les clients et les véhicules,
 * eux, viennent de la VRAIE API : les souscriptions de démonstration pointent vers
 * des organisations et des véhicules existants. Seules les souscriptions sont en mémoire.
 *
 * Règles métier appliquées ici (§III.6) — le backend devra les appliquer côté serveur :
 *  - un véhicule n'a qu'une seule affectation active à un instant donné ;
 *  - un véhicule appartient au client de la souscription ;
 *  - le changement d'offre clôture l'ancienne affectation et en crée une nouvelle ;
 *  - l'historique des affectations n'est jamais supprimé ;
 *  - une souscription résiliée clôture toutes ses affectations.
 */

/** Identité de l'auteur : en production, c'est le serveur qui la renseigne. */
const ACTOR = "Vous (démo)";

let store: Subscription[] | null = null;
let seeding: Promise<Subscription[]> | null = null;

const today = () => new Date().toISOString().slice(0, 10);

function event(action: string, description: string, at = mockNow()) {
  return { id: mockId(), at, actor: ACTOR, action, description };
}

function openAssignment(vehicle: Pick<Vehicle, "id" | "registration" | "label">, startDate: string): VehicleAssignment {
  return {
    id: mockId(),
    vehicleId: vehicle.id,
    registration: vehicle.registration,
    label: vehicle.label ?? null,
    startDate,
    endDate: null,
    status: "active",
    closeReason: null,
    transferredTo: null,
    createdBy: ACTOR,
    createdAt: mockNow(),
  };
}

/** Données de démonstration construites à partir des vrais clients et véhicules. */
async function seed(): Promise<Subscription[]> {
  try {
    const [orgs, offers] = await Promise.all([
      organizationService.list({ perPage: 4, isActive: true }),
      offerService.list({ status: "active" }),
    ]);
    if (offers.data.length === 0) return [];
    const result: Subscription[] = [];
    let n = 1;
    for (const org of orgs.data) {
      const vehicles = (await vehicleService.list({ organizationId: org.id, perPage: 20 })).data;
      // Deux souscriptions par client pour illustrer le multi-offres (§13, test 1).
      const split = [vehicles.filter((_, i) => i % 2 === 0), vehicles.filter((_, i) => i % 2 === 1)];
      split.forEach((group, i) => {
        const offer = offers.data[(n + i) % offers.data.length];
        const start = "2026-03-01";
        result.push({
          id: mockId(),
          reference: `SUB-2026-${String(n).padStart(4, "0")}`,
          organizationId: org.id,
          organization: { id: org.id, name: org.name, code: org.code },
          offerId: offer.id,
          offer: { id: offer.id, code: offer.code, name: offer.name },
          startDate: start,
          endDate: "2027-02-28",
          periodicity: offer.periodicity,
          referencePrice: offer.referencePrice,
          negotiatedPrice: i === 0 ? null : Math.round(offer.referencePrice * 0.9),
          discountPercent: 0,
          currency: offer.currency,
          specialConditions: null,
          status: "active",
          assignments: group.map((v) => openAssignment(v, start)),
          history: [event("Création", `Souscription créée avec l'offre ${offer.name}.`, `${start}T08:00:00.000Z`)],
          documents: [],
          createdAt: `${start}T08:00:00.000Z`,
          updatedAt: `${start}T08:00:00.000Z`,
        });
        n += 1;
      });
    }
    return result;
  } catch {
    // API injoignable : on démarre avec une liste vide plutôt que de bloquer l'écran.
    return [];
  }
}

async function db(): Promise<Subscription[]> {
  if (store) return store;
  seeding ??= seed();
  store = await seeding;
  return store;
}

async function findOrThrow(id: string): Promise<Subscription> {
  const sub = (await db()).find((s) => s.id === id);
  if (!sub) throw new ApiError(404, "E_NOT_FOUND", "Souscription introuvable.");
  return sub;
}

/** Affectations actives de tous les véhicules, toutes souscriptions confondues. */
async function activeAssignments(): Promise<VehicleAvailability> {
  const map: VehicleAvailability = {};
  for (const sub of await db()) {
    for (const a of sub.assignments) {
      if (a.status === "active") {
        map[a.vehicleId] = { subscriptionId: sub.id, reference: sub.reference, offerName: sub.offer.name };
      }
    }
  }
  return map;
}

/** Vérifie que les véhicules existent, appartiennent au client et sont libres. */
async function resolveFreeVehicles(organizationId: string, vehicleIds: string[]) {
  if (vehicleIds.length === 0) return [];
  // 100 = plafond de pagination de l'API réelle (au-delà, la requête est refusée).
  const owned = (await vehicleService.list({ organizationId, perPage: 100 })).data;
  const taken = await activeAssignments();
  return vehicleIds.map((id) => {
    const vehicle = owned.find((v) => v.id === id);
    if (!vehicle) {
      throw new ApiError(422, "E_VEHICLE_NOT_OWNED", "Un véhicule n'appartient pas au client de la souscription.");
    }
    const busy = taken[id];
    if (busy) {
      throw new ApiError(
        409,
        "E_VEHICLE_ALREADY_ASSIGNED",
        `${vehicle.registration} est déjà affecté à ${busy.reference} (${busy.offerName}).`,
      );
    }
    return vehicle;
  });
}

function closeAssignment(a: VehicleAssignment, reason: string, endDate = today()) {
  a.status = "closed";
  a.endDate = endDate;
  a.closeReason = reason;
}

export const subscriptionService = {
  /** GET /admin/subscriptions?search=&organizationId=&offerId=&status= */
  async list(params: SubscriptionListParams = {}): Promise<Paginated<Subscription>> {
    await mockDelay();
    const search = params.search?.toLowerCase();
    const rows = (await db()).filter(
      (s) =>
        (!params.status || s.status === params.status) &&
        (!params.organizationId || s.organizationId === params.organizationId) &&
        (!params.offerId || s.offerId === params.offerId) &&
        (!search || s.reference.toLowerCase().includes(search) || s.organization.name.toLowerCase().includes(search)),
    );
    const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mockPaginate(sorted, params);
  },

  /** GET /admin/subscriptions/:id */
  async get(id: string): Promise<Subscription> {
    await mockDelay();
    return mockClone(await findOrThrow(id));
  },

  /** GET /admin/subscriptions/vehicle-availability — véhicules déjà affectés. */
  async availability(): Promise<VehicleAvailability> {
    await mockDelay(150);
    return activeAssignments();
  },

  /** GET /admin/vehicles/:id/subscriptions — toutes les affectations du véhicule, la plus récente d'abord. */
  async vehicleHistory(vehicleId: string): Promise<VehicleSubscriptionHistoryEntry[]> {
    await mockDelay(200);
    const entries: VehicleSubscriptionHistoryEntry[] = [];
    for (const sub of await db()) {
      for (const a of sub.assignments) {
        if (a.vehicleId !== vehicleId) continue;
        entries.push({
          ...mockClone(a),
          subscription: {
            id: sub.id,
            reference: sub.reference,
            status: sub.status,
            offerName: sub.offer.name,
            organizationName: sub.organization.name,
          },
        });
      }
    }
    // Active en tête, puis par date de début décroissante.
    return entries.sort(
      (x, y) => Number(y.status === "active") - Number(x.status === "active") || y.startDate.localeCompare(x.startDate),
    );
  },

  /** POST /admin/subscriptions */
  async create(payload: CreateSubscriptionPayload): Promise<Subscription> {
    await mockDelay();
    const all = await db();
    const reference = payload.reference.trim().toUpperCase();
    if (all.some((s) => s.reference === reference)) {
      throw new ApiError(409, "E_SUBSCRIPTION_REFERENCE_TAKEN", `La référence « ${reference} » existe déjà.`);
    }
    const [organization, offer] = await Promise.all([
      organizationService.get(payload.organizationId),
      offerService.get(payload.offerId),
    ]);
    if (offer.status !== "active") {
      throw new ApiError(422, "E_OFFER_NOT_AVAILABLE", `L'offre ${offer.name} n'est pas commercialisée.`);
    }
    const vehicles = await resolveFreeVehicles(payload.organizationId, payload.vehicleIds);
    const now = mockNow();
    const sub: Subscription = {
      id: mockId(),
      reference,
      organizationId: organization.id,
      organization: { id: organization.id, name: organization.name, code: organization.code },
      offerId: offer.id,
      offer: { id: offer.id, code: offer.code, name: offer.name },
      startDate: payload.startDate,
      endDate: payload.endDate ?? null,
      periodicity: payload.periodicity,
      referencePrice: offer.referencePrice,
      negotiatedPrice: payload.negotiatedPrice ?? null,
      discountPercent: payload.discountPercent ?? 0,
      currency: offer.currency,
      specialConditions: payload.specialConditions ?? null,
      status: payload.status,
      assignments: vehicles.map((v) => openAssignment(v, payload.startDate)),
      history: [
        event("Création", `Souscription créée avec l'offre ${offer.name} et ${vehicles.length} véhicule(s).`, now),
      ],
      documents: [],
      createdAt: now,
      updatedAt: now,
    };
    all.push(sub);
    return mockClone(sub);
  },

  /** PATCH /admin/subscriptions/:id */
  async update(id: string, payload: UpdateSubscriptionPayload): Promise<Subscription> {
    await mockDelay();
    const sub = await findOrThrow(id);
    if (sub.status === "terminated") {
      throw new ApiError(409, "E_SUBSCRIPTION_TERMINATED", "Une souscription résiliée ne peut plus être modifiée.");
    }
    Object.assign(sub, payload, { updatedAt: mockNow() });
    sub.history.unshift(event("Modification", "Informations générales ou tarification mises à jour."));
    return mockClone(sub);
  },

  /** POST /admin/subscriptions/:id/status — activer, suspendre, réactiver ou résilier. */
  async setStatus(id: string, status: SubscriptionStatus, reason: string): Promise<Subscription> {
    await mockDelay();
    const sub = await findOrThrow(id);
    if (sub.status === "terminated") {
      throw new ApiError(409, "E_SUBSCRIPTION_TERMINATED", "Une souscription résiliée est définitive.");
    }
    const labels: Record<SubscriptionStatus, string> = {
      draft: "Brouillon",
      active: "Activation",
      suspended: "Suspension",
      terminated: "Résiliation",
    };
    if (status === "terminated") {
      for (const a of sub.assignments) if (a.status === "active") closeAssignment(a, "Résiliation de la souscription");
      sub.endDate = today();
    }
    sub.status = status;
    sub.updatedAt = mockNow();
    sub.history.unshift(event(labels[status], reason));
    return mockClone(sub);
  },

  /** POST /admin/subscriptions/:id/vehicles — affectation datée de nouveaux véhicules. */
  async assignVehicles(id: string, vehicleIds: string[]): Promise<Subscription> {
    await mockDelay();
    const sub = await findOrThrow(id);
    if (sub.status === "terminated") {
      throw new ApiError(
        409,
        "E_SUBSCRIPTION_TERMINATED",
        "Impossible d'affecter un véhicule à une souscription résiliée.",
      );
    }
    const vehicles = await resolveFreeVehicles(sub.organizationId, vehicleIds);
    sub.assignments.push(...vehicles.map((v) => openAssignment(v, today())));
    sub.updatedAt = mockNow();
    sub.history.unshift(
      event("Affectation", `${vehicles.map((v) => v.registration).join(", ")} affecté(s) à la souscription.`),
    );
    return mockClone(sub);
  },

  /** DELETE /admin/subscriptions/:id/vehicles/:vehicleId — clôture, sans suppression. */
  async removeVehicle(id: string, vehicleId: string, reason: string): Promise<Subscription> {
    await mockDelay();
    const sub = await findOrThrow(id);
    const a = sub.assignments.find((x) => x.vehicleId === vehicleId && x.status === "active");
    if (!a) throw new ApiError(404, "E_NOT_FOUND", "Ce véhicule n'a pas d'affectation active ici.");
    closeAssignment(a, reason);
    sub.updatedAt = mockNow();
    sub.history.unshift(event("Retrait", `${a.registration} retiré : ${reason}`));
    return mockClone(sub);
  },

  /**
   * POST /admin/subscriptions/:id/vehicles/:vehicleId/transfer — changement d'offre (§VI.3).
   * Clôture l'affectation actuelle et en ouvre une nouvelle sur la souscription cible.
   */
  async transferVehicle(id: string, vehicleId: string, targetId: string, effectiveDate: string): Promise<Subscription> {
    await mockDelay();
    const [source, target] = await Promise.all([findOrThrow(id), findOrThrow(targetId)]);
    if (source.organizationId !== target.organizationId) {
      throw new ApiError(422, "E_OTHER_CLIENT", "La souscription cible appartient à un autre client.");
    }
    if (target.status !== "active") {
      throw new ApiError(422, "E_SUBSCRIPTION_NOT_ACTIVE", `${target.reference} n'est pas active.`);
    }
    const current = source.assignments.find((x) => x.vehicleId === vehicleId && x.status === "active");
    if (!current) throw new ApiError(404, "E_NOT_FOUND", "Ce véhicule n'a pas d'affectation active ici.");

    closeAssignment(current, `Changement d'offre vers ${target.offer.name}`, effectiveDate);
    current.transferredTo = { id: target.id, reference: target.reference };
    const next = openAssignment(
      { id: vehicleId, registration: current.registration, label: current.label },
      effectiveDate,
    );
    next.transferredTo = { id: source.id, reference: source.reference };
    target.assignments.push(next);

    const now = mockNow();
    source.updatedAt = now;
    target.updatedAt = now;
    source.history.unshift(
      event("Changement d'offre", `${current.registration} transféré vers ${target.reference} (${target.offer.name}).`),
    );
    target.history.unshift(
      event("Changement d'offre", `${current.registration} reçu depuis ${source.reference} (${source.offer.name}).`),
    );
    return mockClone(source);
  },
};
