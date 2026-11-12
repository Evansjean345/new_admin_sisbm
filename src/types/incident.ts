import type { GeoLocation, HistoryEntry, PersonRef, Severity } from "./alerting";
import type { Attachment, OrganizationRef } from "./billing";

/**
 * Module 5 — Gestion des incidents (spécifications SuperAdmin §V).
 *
 * Cycle de vie : nouveau → assigné → en cours ↔ en attente → résolu → clôturé (→ réouvert).
 * Règles : référence unique, responsable ou file obligatoire, statut historisé, compte rendu
 * exigé à la clôture, incident clôturé non modifiable sans réouverture tracée.
 */

export const INCIDENT_STATUSES = ["new", "assigned", "in_progress", "on_hold", "resolved", "closed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_SOURCES = ["rule_engine", "gps_alert", "client_report", "manual"] as const;
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

/** Référentiel « catégories d'incidents » (Paramètres › Référentiels). */
export const INCIDENT_CATEGORIES = [
  "theft",
  "accident",
  "sos",
  "tamper",
  "device_failure",
  "connectivity",
  "speeding",
  "unauthorized_use",
  "other",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

/** Files d'affectation quand aucun responsable nominatif n'est désigné. */
export const INCIDENT_QUEUES = ["Support niveau 1", "Support technique", "Sécurité / SOC", "Service client"] as const;

export interface IncidentComment {
  id: string;
  at: string;
  author: string;
  text: string;
}

export interface IncidentAction {
  id: string;
  at: string;
  author: string;
  /** Intervention réalisée : appel client, envoi technicien, coupure moteur… */
  text: string;
}

export interface Incident {
  id: string;
  /** INC-AAAA-NNNNN, unique. */
  reference: string;
  organizationId: string;
  organization: OrganizationRef;
  vehicleId: string | null;
  vehicle: { id: string; registration: string; label: string | null } | null;
  driver: PersonRef | null;
  category: IncidentCategory;
  priority: Severity;
  occurredAt: string;
  description: string;
  source: IncidentSource;
  alertIds: string[];
  location: GeoLocation | null;
  attachments: Attachment[];
  status: IncidentStatus;
  assignee: PersonRef | null;
  queue: string | null;
  escalationLevel: number;
  comments: IncidentComment[];
  actions: IncidentAction[];
  history: HistoryEntry[];
  resolutionReport: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface IncidentListParams {
  page?: number;
  perPage?: number;
  search?: string;
  organizationId?: string;
  status?: IncidentStatus;
  priority?: Severity;
  category?: IncidentCategory;
}

export interface IncidentStats {
  total: number;
  new: number;
  critical: number;
  assigned: number;
  inProgress: number;
  onHold: number;
  resolved: number;
  closed: number;
}

export interface CreateIncidentPayload {
  organizationId: string;
  vehicleId?: string | null;
  driver?: PersonRef | null;
  category: IncidentCategory;
  priority: Severity;
  occurredAt: string;
  description: string;
  source: IncidentSource;
  alertIds: string[];
  location?: GeoLocation | null;
  attachments: Attachment[];
  assignee?: PersonRef | null;
  queue?: string | null;
}
