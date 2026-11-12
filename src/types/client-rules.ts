import type { EventType, Severity } from "./alerting";
import type { OrganizationRef } from "./billing";

/**
 * Rubriques opérationnelles du client (plateforme Client, ouvertes aussi depuis la fiche client
 * du SuperAdmin) : zones géographiques, contrôle de vitesse, moteur de règles.
 * Entités du modèle de données : Geofence, GeofenceAssignment, SpeedPolicy, Rule, RuleCondition,
 * RuleAction.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type GeofenceShape = "circle" | "polygon";

export interface Geofence {
  id: string;
  organizationId: string;
  organization: OrganizationRef;
  name: string;
  description: string | null;
  shape: GeofenceShape;
  /** Cercle. */
  center: LatLng | null;
  radiusM: number | null;
  /** Polygone (3 sommets minimum). */
  points: LatLng[];
  /** Zone autorisée (alerte à la sortie) ou interdite (alerte à l'entrée). */
  kind: "authorized" | "forbidden";
  alertOnEntry: boolean;
  alertOnExit: boolean;
  /** GeofenceAssignment : véhicules surveillés (vide = tous ceux du client). */
  vehicleIds: string[];
  color: string;
  active: boolean;
  updatedAt: string;
}

export type GeofencePayload = Omit<Geofence, "id" | "organization" | "updatedAt">;

/** Portée d'une politique : la plus précise l'emporte (véhicule > zone > globale) — à valider (§15). */
export type SpeedScope = "global" | "zone" | "vehicle";

export interface SpeedPolicy {
  id: string;
  organizationId: string;
  organization: OrganizationRef;
  name: string;
  scope: SpeedScope;
  zoneId: string | null;
  vehicleIds: string[];
  limitKph: number;
  /** Tolérance avant alerte (km/h au-dessus de la limite). */
  toleranceKph: number;
  /** Durée minimale de dépassement avant alerte (secondes). */
  minDurationSeconds: number;
  severity: Severity;
  /** Bridage actif : nécessite un boîtier compatible (§III.6). */
  limiterEnabled: boolean;
  active: boolean;
  updatedAt: string;
}

export type SpeedPolicyPayload = Omit<SpeedPolicy, "id" | "organization" | "updatedAt">;

export const RULE_FIELDS = ["speed", "zone", "time", "duration", "ignition", "vehicle"] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export const RULE_OPERATORS = ["gt", "lt", "eq", "neq", "in", "outside"] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export interface RuleCondition {
  id: string;
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export const RULE_ACTION_TYPES = ["alert", "notify", "incident", "command"] as const;
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];

export interface RuleAction {
  id: string;
  type: RuleActionType;
  /** Gravité (alert), configuration (notify), file (incident), commande (command). */
  value: string;
}

export interface Rule {
  id: string;
  organizationId: string;
  organization: OrganizationRef;
  name: string;
  description: string | null;
  trigger: EventType;
  /** Toutes les conditions doivent être vraies (ET logique). */
  conditions: RuleCondition[];
  actions: RuleAction[];
  severity: Severity;
  active: boolean;
  triggerCount: number;
  lastTriggeredAt: string | null;
  updatedAt: string;
}

export type RulePayload = Omit<Rule, "id" | "organization" | "updatedAt" | "triggerCount" | "lastTriggeredAt">;
