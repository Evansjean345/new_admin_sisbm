/**
 * Fiche commerciale d'un client (spécifications SuperAdmin §III.3).
 *
 * Complète l'organisation (`/organizations`) avec les champs commerciaux que l'API
 * n'expose pas encore. Une fiche par organisation, même identifiant.
 *
 * Le statut commercial est DISTINCT de `organization.isActive` (blocage des comptes) :
 * le lien entre les deux attend la décision SISBM « suspension commerciale, technique
 * ou les deux » (§15).
 */

export const CLIENT_TYPES = ["owner", "operator"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_STATUSES = ["prospect", "active", "suspended", "terminated", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export interface ClientContact {
  name: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
}

export interface ClientProfile {
  organizationId: string;
  /** Raison sociale (nom légal) ; le nom de l'organisation sert de nom commercial. */
  legalName: string | null;
  tradeName: string | null;
  clientType: ClientType;
  /** Numéro RCCM ou identifiant applicable. */
  registrationNumber: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  manager: ClientContact;
  relationStartDate: string | null;
  salesRep: string | null;
  specialConditions: string | null;
  notes: string | null;
  status: ClientStatus;
  /** false = fiche jamais remplie (valeurs par défaut). */
  completed: boolean;
  updatedAt: string | null;
}

export type UpdateClientProfilePayload = Partial<Omit<ClientProfile, "organizationId" | "completed" | "updatedAt">>;
