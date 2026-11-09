import type { PaginationParams } from "./api";

/**
 * Catalogue des offres (spécifications SuperAdmin §III.2).
 *
 * Les fonctionnalités incluses ne sont PAS codées en dur dans les offres :
 * chaque offre porte la liste des clés de fonctionnalités qu'elle autorise
 * (matrice modules × offres), et le catalogue des fonctionnalités vient de l'API.
 */

export const OFFER_STATUSES = ["draft", "active", "retired"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_PERIODICITIES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type OfferPeriodicity = (typeof OFFER_PERIODICITIES)[number];

/** Une fonctionnalité activable par offre (ligne de la matrice). */
export interface OfferFeature {
  key: string;
  label: string;
  /** Module fonctionnel de rattachement, pour grouper les lignes de la matrice. */
  module: string;
  description: string | null;
  /** La capacité réelle dépend aussi du matériel (ex. relais pour l'immobilisation). */
  requiresHardware: boolean;
}

export interface OfferLimitations {
  /** null = illimité. */
  maxVehicles: number | null;
  /** Durée de conservation de l'historique GPS (décision §15 : configurable par offre). */
  historyDays: number | null;
  smsPerMonth: number | null;
}

export interface Offer {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** Tarif de référence par véhicule et par période, en `currency`. */
  referencePrice: number;
  currency: string;
  periodicity: OfferPeriodicity;
  featureKeys: string[];
  options: string | null;
  limitations: OfferLimitations;
  status: OfferStatus;
  launchDate: string | null;
  stats: {
    subscriptions: number;
    vehicles: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OfferListParams extends PaginationParams {
  search?: string;
  status?: OfferStatus;
}

export interface CreateOfferPayload {
  code: string;
  name: string;
  description?: string;
  referencePrice: number;
  currency?: string;
  periodicity: OfferPeriodicity;
  featureKeys: string[];
  options?: string;
  limitations: OfferLimitations;
  status: OfferStatus;
  launchDate?: string;
}

/** Le code n'est pas modifiable après création (référencé par les souscriptions). */
export type UpdateOfferPayload = Partial<Omit<CreateOfferPayload, "code">>;
