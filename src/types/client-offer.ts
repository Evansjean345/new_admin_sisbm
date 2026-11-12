import type { OrganizationRef } from "./billing";

/**
 * Offre attribuée à un client (utilisateur d'une organisation).
 *
 * Retour de la direction (12/11/2026) : un client doit avoir souscrit une offre AVANT qu'on lui
 * attribue des permissions, et l'éditeur de permissions ne propose que les fonctionnalités de
 * cette offre. L'offre passe par une souscription de son organisation (facturation, véhicules) :
 * l'attribution relie le client à l'une de ces souscriptions.
 */
export interface ClientOfferAssignment {
  userId: string;
  userName: string;
  userEmail: string;
  roleName: string | null;
  organizationId: string;
  organization: OrganizationRef;
  subscriptionId: string;
  subscriptionReference: string;
  offer: { id: string; code: string; name: string };
  /** Fonctionnalités de l'offre, relues à chaque lecture (une offre modifiée s'applique tout de suite). */
  featureKeys: string[];
  assignedAt: string;
  assignedBy: string;
}

export interface AssignClientOfferPayload {
  userId: string;
  offerId: string;
  /** Souscription existante de l'organisation ; absente = création d'une souscription active. */
  subscriptionId?: string;
}

export interface ClientOfferListParams {
  organizationId?: string;
  search?: string;
}
