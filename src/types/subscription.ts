import type { PaginationParams } from "./api";
import type { OfferPeriodicity } from "./offer";

/**
 * Souscriptions (spécifications SuperAdmin §III.4 et §III.6).
 *
 * Une souscription lie UN client à UNE offre et regroupe plusieurs véhicules.
 * Les affectations de véhicules sont historisées : on ne les supprime jamais,
 * on les clôture (`endDate` + statut `closed`).
 */

export const SUBSCRIPTION_STATUSES = ["draft", "active", "suspended", "terminated"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionRef {
  id: string;
  reference: string;
}

export interface VehicleAssignment {
  id: string;
  vehicleId: string;
  registration: string;
  label: string | null;
  startDate: string;
  /** null tant que l'affectation est active. */
  endDate: string | null;
  status: "active" | "closed";
  /** Motif de clôture : retrait, changement d'offre, résiliation… */
  closeReason: string | null;
  /** Souscription d'origine ou de destination lors d'un changement d'offre. */
  transferredTo: SubscriptionRef | null;
  createdBy: string;
  createdAt: string;
}

export interface SubscriptionEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  description: string;
}

export interface SubscriptionDocument {
  id: string;
  name: string;
  kind: string;
  sizeKb: number;
  uploadedAt: string;
}

export interface Subscription {
  id: string;
  reference: string;
  organizationId: string;
  organization: { id: string; name: string; code: string };
  offerId: string;
  offer: { id: string; code: string; name: string };
  startDate: string;
  endDate: string | null;
  periodicity: OfferPeriodicity;
  /** Tarif de l'offre au moment de la souscription (par véhicule et par période). */
  referencePrice: number;
  negotiatedPrice: number | null;
  /** Remise en pourcentage, appliquée après le tarif négocié. */
  discountPercent: number;
  currency: string;
  specialConditions: string | null;
  status: SubscriptionStatus;
  assignments: VehicleAssignment[];
  history: SubscriptionEvent[];
  documents: SubscriptionDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionListParams extends PaginationParams {
  search?: string;
  organizationId?: string;
  offerId?: string;
  status?: SubscriptionStatus;
}

export interface CreateSubscriptionPayload {
  organizationId: string;
  offerId: string;
  reference: string;
  startDate: string;
  endDate?: string;
  periodicity: OfferPeriodicity;
  negotiatedPrice?: number;
  discountPercent?: number;
  specialConditions?: string;
  vehicleIds: string[];
  status: Extract<SubscriptionStatus, "draft" | "active">;
}

/** Client et offre ne changent pas : un changement d'offre passe par une autre souscription. */
export type UpdateSubscriptionPayload = Partial<
  Pick<CreateSubscriptionPayload, "reference" | "startDate" | "periodicity" | "discountPercent">
> & {
  /** null = retirer la valeur. */
  endDate?: string | null;
  negotiatedPrice?: number | null;
  specialConditions?: string | null;
};

/** Une affectation vue depuis le véhicule, avec sa souscription (historique §III.5). */
export interface VehicleSubscriptionHistoryEntry extends VehicleAssignment {
  subscription: {
    id: string;
    reference: string;
    status: SubscriptionStatus;
    offerName: string;
    organizationName: string;
  };
}

/** Véhicule déjà affecté ailleurs : clé = id du véhicule. */
export type VehicleAvailability = Record<string, { subscriptionId: string; reference: string; offerName: string }>;
