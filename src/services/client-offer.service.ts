import { mockClone, mockDelay, mockNow } from "@/lib/mock";
import { ApiError } from "@/types/api";
import type { AssignClientOfferPayload, ClientOfferAssignment, ClientOfferListParams } from "@/types/client-offer";

import { offerService } from "./offer.service";
import { subscriptionService } from "./subscription.service";
import { userService } from "./user.service";

/**
 * Attribution d'une offre à un client — SERVICE SIMULÉ.
 *
 * Routes attendues : GET /admin/client-offers, GET /admin/users/:id/offer,
 * PUT /admin/users/:id/offer, DELETE /admin/users/:id/offer.
 *
 * Règles (le serveur devra les appliquer) :
 *  - le client appartient à l'organisation de la souscription ;
 *  - la souscription est ACTIVE et porte l'offre choisie ;
 *  - sans souscription existante, une souscription active est créée pour l'organisation ;
 *  - un client a une seule offre à la fois (réattribuer remplace la précédente) ;
 *  - les permissions du client sont ensuite limitées aux fonctionnalités de l'offre.
 */

const ACTOR = "Vous (démo)";

type Stored = Omit<ClientOfferAssignment, "featureKeys">;
const store = new Map<string, Stored>();

async function hydrate(a: Stored): Promise<ClientOfferAssignment> {
  let featureKeys: string[] = [];
  try {
    featureKeys = (await offerService.get(a.offer.id)).featureKeys;
  } catch {
    // Offre supprimée du catalogue : plus aucune fonctionnalité.
  }
  return { ...mockClone(a), featureKeys };
}

function newReference(): string {
  return `SUB-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export const clientOfferService = {
  /** GET /admin/client-offers?organizationId=&search= */
  async list(params: ClientOfferListParams = {}): Promise<ClientOfferAssignment[]> {
    await mockDelay();
    const q = params.search?.trim().toLowerCase();
    const rows = [...store.values()]
      .filter(
        (a) =>
          (!params.organizationId || a.organizationId === params.organizationId) &&
          (!q ||
            a.userName.toLowerCase().includes(q) ||
            a.userEmail.toLowerCase().includes(q) ||
            a.organization.name.toLowerCase().includes(q) ||
            a.offer.name.toLowerCase().includes(q)),
      )
      .sort((x, y) => y.assignedAt.localeCompare(x.assignedAt));
    return Promise.all(rows.map(hydrate));
  },

  /** GET /admin/users/:id/offer — null tant qu'aucune offre n'est attribuée. */
  async get(userId: string): Promise<ClientOfferAssignment | null> {
    await mockDelay(150);
    const a = store.get(userId);
    return a ? hydrate(a) : null;
  },

  /** PUT /admin/users/:id/offer */
  async assign(payload: AssignClientOfferPayload): Promise<ClientOfferAssignment> {
    await mockDelay();
    const user = await userService.get(payload.userId);
    if (user.role?.code === "super_admin") {
      throw new ApiError(422, "E_PLATFORM_USER", "Un collaborateur SISBM n'a pas d'offre : il a accès à tout.");
    }
    const offer = await offerService.get(payload.offerId);
    if (offer.status !== "active") {
      throw new ApiError(422, "E_OFFER_NOT_AVAILABLE", `L'offre ${offer.name} n'est pas commercialisée.`);
    }

    let subscription = payload.subscriptionId ? await subscriptionService.get(payload.subscriptionId) : null;
    if (subscription) {
      if (subscription.organizationId !== user.organizationId) {
        throw new ApiError(422, "E_SUBSCRIPTION_OTHER_ORG", "La souscription appartient à une autre organisation.");
      }
      if (subscription.offerId !== offer.id) {
        throw new ApiError(422, "E_SUBSCRIPTION_OTHER_OFFER", "La souscription ne porte pas l'offre choisie.");
      }
      if (subscription.status !== "active") {
        throw new ApiError(
          422,
          "E_SUBSCRIPTION_INACTIVE",
          `La souscription ${subscription.reference} n'est pas active.`,
        );
      }
    } else {
      // Réutilise la souscription active de l'organisation sur cette offre, sinon la crée.
      const existing = (
        await subscriptionService.list({
          organizationId: user.organizationId,
          offerId: offer.id,
          status: "active",
          perPage: 1,
        })
      ).data[0];
      subscription =
        existing ??
        (await subscriptionService.create({
          organizationId: user.organizationId,
          offerId: offer.id,
          reference: newReference(),
          startDate: new Date().toISOString().slice(0, 10),
          periodicity: offer.periodicity,
          vehicleIds: [],
          status: "active",
        }));
    }

    const organization = user.organization ?? subscription.organization;
    const assignment: Stored = {
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      roleName: user.role?.name ?? null,
      organizationId: user.organizationId,
      organization: { id: organization.id, name: organization.name, code: organization.code },
      subscriptionId: subscription.id,
      subscriptionReference: subscription.reference,
      offer: { id: offer.id, code: offer.code, name: offer.name },
      assignedAt: mockNow(),
      assignedBy: ACTOR,
    };
    store.set(user.id, assignment);
    return hydrate(assignment);
  },

  /** DELETE /admin/users/:id/offer — le client perd ses permissions fonctionnelles. */
  async unassign(userId: string): Promise<void> {
    await mockDelay();
    if (!store.delete(userId)) throw new ApiError(404, "E_NOT_FOUND", "Aucune offre attribuée à ce client.");
  },
};
