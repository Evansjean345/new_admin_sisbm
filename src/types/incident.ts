import type { EventType, GeoLocation, HistoryEntry, PersonRef, Severity } from "./alerting";
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

/** Familles d'événements du référentiel GPS fourni. */
export const INCIDENT_EVENT_CATEGORIES = [
  "security",
  "geolocation",
  "driving",
  "engine",
  "immobilization",
  "technical",
  "maintenance",
  "business",
  "supervision",
  "other",
] as const;
export type IncidentEventCategory = (typeof INCIDENT_EVENT_CATEGORIES)[number];

export const INCIDENT_EVENTS = [
  "sos_button_activated",
  "gsm_jamming_detected",
  "tracker_disconnected",
  "device_tamper_detected",
  "main_power_cut",
  "vehicle_towed",
  "forbidden_zone_entry",
  "authorized_zone_exit",
  "poi_arrival",
  "overspeed",
  "impact_detected",
  "off_hours_driving",
  "harsh_driving",
  "ignition_on",
  "ignition_off",
  "engine_started",
  "engine_stopped",
  "engine_outside_allowed_hours",
  "stop_started",
  "prolonged_stop",
  "unauthorized_stop",
  "vehicle_battery_low",
  "abnormal_supply_voltage",
  "gps_satellite_signal_lost",
  "gps_unavailable",
  "gps_antenna_disconnected",
  "gsm_communication_lost",
  "tracker_offline",
  "server_communication_lost",
  "technical_visit_due",
  "preventive_maintenance_due",
  "inspection_overdue",
  "oil_change_due",
  "vehicle_used_outside_hours",
  "vehicle_inactive_days",
  "supervision_tracker_offline",
  "data_loss",
  "transmission_error",
  "remote_command_failed",
  "other_event",
] as const;
export type IncidentEvent = (typeof INCIDENT_EVENTS)[number];

export const INCIDENT_EVENTS_BY_CATEGORY: Record<IncidentEventCategory, readonly IncidentEvent[]> = {
  security: [
    "sos_button_activated",
    "gsm_jamming_detected",
    "tracker_disconnected",
    "device_tamper_detected",
    "main_power_cut",
    "vehicle_towed",
  ],
  geolocation: ["forbidden_zone_entry", "authorized_zone_exit", "poi_arrival"],
  driving: ["overspeed", "impact_detected", "off_hours_driving", "harsh_driving"],
  engine: [
    "ignition_on",
    "ignition_off",
    "engine_started",
    "engine_stopped",
    "engine_outside_allowed_hours",
  ],
  immobilization: ["stop_started", "prolonged_stop", "unauthorized_stop"],
  technical: [
    "vehicle_battery_low",
    "abnormal_supply_voltage",
    "gps_satellite_signal_lost",
    "gps_unavailable",
    "gps_antenna_disconnected",
    "gsm_communication_lost",
    "tracker_offline",
    "server_communication_lost",
  ],
  maintenance: ["technical_visit_due", "preventive_maintenance_due", "inspection_overdue", "oil_change_due"],
  business: ["vehicle_used_outside_hours", "vehicle_inactive_days"],
  supervision: ["supervision_tracker_offline", "data_loss", "transmission_error", "remote_command_failed"],
  other: ["other_event"],
};

/** Nature opérationnelle retenue pour le dossier incident. */
export const INCIDENT_TYPES = [
  "theft",
  "accident",
  "sos",
  "tamper",
  "device_failure",
  "connectivity",
  "speeding",
  "unauthorized_use",
  "dangerous_driving",
  "immobilization",
  "maintenance",
  "supervision",
  "other",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_CLASSIFICATION_BY_ALERT_EVENT: Record<
  EventType,
  { eventCategory: IncidentEventCategory; event: IncidentEvent; incidentType: IncidentType }
> = {
  sos: { eventCategory: "security", event: "sos_button_activated", incidentType: "sos" },
  jamming: { eventCategory: "security", event: "gsm_jamming_detected", incidentType: "theft" },
  disconnection: { eventCategory: "technical", event: "tracker_offline", incidentType: "connectivity" },
  power_cut: { eventCategory: "security", event: "main_power_cut", incidentType: "tamper" },
  tamper: { eventCategory: "security", event: "device_tamper_detected", incidentType: "tamper" },
  towing: { eventCategory: "security", event: "vehicle_towed", incidentType: "theft" },
  geofence_entry: { eventCategory: "geolocation", event: "forbidden_zone_entry", incidentType: "unauthorized_use" },
  geofence_exit: { eventCategory: "geolocation", event: "authorized_zone_exit", incidentType: "unauthorized_use" },
  overspeed: { eventCategory: "driving", event: "overspeed", incidentType: "speeding" },
  schedule_violation: {
    eventCategory: "business",
    event: "vehicle_used_outside_hours",
    incidentType: "unauthorized_use",
  },
  harsh_driving: { eventCategory: "driving", event: "harsh_driving", incidentType: "dangerous_driving" },
  engine_start: { eventCategory: "engine", event: "engine_started", incidentType: "other" },
  engine_stop: { eventCategory: "engine", event: "engine_stopped", incidentType: "other" },
};

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
  eventCategory: IncidentEventCategory;
  event: IncidentEvent;
  incidentType: IncidentType;
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
  status?: IncidentStatus | "open";
  priority?: Severity;
  eventCategory?: IncidentEventCategory;
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
  eventCategory: IncidentEventCategory;
  event: IncidentEvent;
  incidentType: IncidentType;
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
