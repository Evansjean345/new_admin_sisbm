import type { OrganizationRef } from "./billing";

/**
 * Module 4 — Alertes & Notifications (spécifications SuperAdmin §IV).
 *
 * Une alerte naît d'un événement GPS normalisé évalué par le moteur de règles (§III.2 technique).
 * Elle a une référence unique, un client, une date et une source ; une alerte véhicule a un véhicule.
 * Elle n'est jamais supprimée : on la traite, on la clôt, et tout est historisé.
 */

/** Événements GPS pris en charge (§III.3 technique) — référentiel « catégories d'événements ». */
export const EVENT_TYPES = [
  "overspeed",
  "geofence_exit",
  "geofence_entry",
  "schedule_violation",
  "power_cut",
  "disconnection",
  "sos",
  "jamming",
  "towing",
  "tamper",
  "harsh_driving",
  "engine_start",
  "engine_stop",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ALERT_STATUSES = ["new", "acknowledged", "assigned", "escalated", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export interface PersonRef {
  id: string;
  name: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  address: string | null;
}

export interface HistoryEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  description: string;
}

export interface Alert {
  id: string;
  /** ALT-AAAA-NNNNNN, unique. */
  reference: string;
  occurredAt: string;
  organizationId: string;
  organization: OrganizationRef;
  vehicleId: string | null;
  vehicle: { id: string; registration: string; label: string | null } | null;
  eventType: EventType;
  severity: Severity;
  location: GeoLocation | null;
  status: AlertStatus;
  /** Règle du moteur de règles qui a déclenché l'alerte. */
  ruleName: string | null;
  source: "gps" | "rule_engine" | "system";
  /** Valeur mesurée utile au lecteur (vitesse, durée hors zone…). */
  detail: string | null;
  assignee: PersonRef | null;
  incidentId: string | null;
  incidentReference: string | null;
  acknowledgedAt: string | null;
  history: HistoryEntry[];
}

export interface AlertListParams {
  page?: number;
  perPage?: number;
  search?: string;
  organizationId?: string;
  vehicleId?: string;
  eventType?: EventType;
  severity?: Severity;
  status?: AlertStatus;
  from?: string;
  to?: string;
}

export interface AlertStats {
  total: number;
  critical: number;
  untreated: number;
  last24h: number;
}

// ── Notifications ────────────────────────────────────────────────────────────

export const NOTIFICATION_CHANNELS = ["sms", "email", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface Recipient {
  kind: "user" | "email" | "phone";
  value: string;
  label: string;
}

export interface SendingWindow {
  /** true = 24 h/24, 7 j/7. */
  always: boolean;
  /** 1 = lundi … 7 = dimanche. */
  days: number[];
  from: string;
  to: string;
}

export interface NotificationConfig {
  id: string;
  name: string;
  trigger: EventType;
  /** null = tous les clients. */
  organizationId: string | null;
  organization: OrganizationRef | null;
  /** Vide = tous les véhicules du client. */
  vehicleIds: string[];
  recipients: Recipient[];
  channels: NotificationChannel[];
  templateId: string | null;
  priority: Severity;
  window: SendingWindow;
  /** Anti-répétition (§IV.4) : pas deux envois pour le même véhicule et le même événement dans ce délai. */
  cooldownMinutes: number;
  active: boolean;
  updatedAt: string;
}

export type NotificationConfigPayload = Omit<NotificationConfig, "id" | "organization" | "updatedAt">;

// ── SMS ──────────────────────────────────────────────────────────────────────

export type SmsTransmission = "pending" | "sent" | "failed";
export type SmsDelivery = "delivered" | "undelivered" | "unknown";

export interface SmsMessage {
  id: string;
  gateway: string;
  to: string;
  content: string;
  sentAt: string;
  /** Coût en XOF. */
  cost: number;
  providerId: string | null;
  transmission: SmsTransmission;
  delivery: SmsDelivery;
  failureReason: string | null;
  organization: OrganizationRef | null;
  alertReference: string | null;
}

export interface SmsListParams {
  page?: number;
  perPage?: number;
  search?: string;
  transmission?: SmsTransmission;
  organizationId?: string;
}

export interface SmsStats {
  sent: number;
  failed: number;
  delivered: number;
  cost: number;
}

// ── Modèles ──────────────────────────────────────────────────────────────────

export const TEMPLATE_VARIABLES = [
  "client",
  "vehicule",
  "immatriculation",
  "date",
  "heure",
  "localisation",
  "evenement",
  "vitesse",
] as const;

export interface NotificationTemplate {
  id: string;
  name: string;
  /** Événement concerné, ou « general ». */
  type: EventType | "general";
  subject: string;
  content: string;
  channel: NotificationChannel;
  active: boolean;
  updatedAt: string;
}

export type NotificationTemplatePayload = Omit<NotificationTemplate, "id" | "updatedAt">;

export interface SendNotificationPayload {
  alertId: string;
  channel: NotificationChannel;
  recipients: Recipient[];
  templateId: string | null;
  message: string;
}
