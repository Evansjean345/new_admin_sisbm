import type { StatusTone } from "@/components/status-badge";
import type {
  AlertStatus,
  EventType,
  NotificationChannel,
  Severity,
  SmsDelivery,
  SmsTransmission,
} from "@/types/alerting";
import type { IncidentCategory, IncidentSource, IncidentStatus } from "@/types/incident";

type Meta = { label: string; tone: StatusTone };

export const eventTypeLabels: Record<EventType, string> = {
  overspeed: "Excès de vitesse",
  geofence_exit: "Sortie de zone",
  geofence_entry: "Entrée en zone",
  schedule_violation: "Circulation hors horaires",
  power_cut: "Coupure d'alimentation",
  disconnection: "Perte de connexion",
  sos: "Bouton SOS",
  jamming: "Brouillage GPS/GSM",
  towing: "Remorquage",
  tamper: "Ouverture / sabotage du boîtier",
  harsh_driving: "Conduite brusque",
  engine_start: "Démarrage moteur",
  engine_stop: "Arrêt moteur",
};

export const severityMeta: Record<Severity, Meta> = {
  critical: { label: "Critique", tone: "danger" },
  high: { label: "Haute", tone: "orange" },
  medium: { label: "Moyenne", tone: "warning" },
  low: { label: "Basse", tone: "info" },
};

export const alertStatusMeta: Record<AlertStatus, Meta> = {
  new: { label: "Nouvelle", tone: "danger" },
  acknowledged: { label: "Prise en compte", tone: "warning" },
  assigned: { label: "Assignée", tone: "info" },
  escalated: { label: "Incident ouvert", tone: "orange" },
  resolved: { label: "Traitée", tone: "success" },
};

export const channelLabels: Record<NotificationChannel, string> = {
  sms: "SMS",
  email: "E-mail",
  push: "Notification application",
};

export const smsTransmissionMeta: Record<SmsTransmission, Meta> = {
  pending: { label: "En attente", tone: "neutral" },
  sent: { label: "Transmis", tone: "success" },
  failed: { label: "Échec", tone: "danger" },
};

export const smsDeliveryMeta: Record<SmsDelivery, Meta> = {
  delivered: { label: "Livré", tone: "success" },
  undelivered: { label: "Non livré", tone: "danger" },
  unknown: { label: "Inconnu", tone: "neutral" },
};

export const incidentStatusMeta: Record<IncidentStatus, Meta> = {
  new: { label: "Nouveau", tone: "danger" },
  assigned: { label: "Assigné", tone: "info" },
  in_progress: { label: "En cours", tone: "warning" },
  on_hold: { label: "En attente", tone: "orange" },
  resolved: { label: "Résolu", tone: "success" },
  closed: { label: "Clôturé", tone: "neutral" },
};

export const incidentSourceLabels: Record<IncidentSource, string> = {
  rule_engine: "Automatique (moteur de règles)",
  gps_alert: "Alerte GPS",
  client_report: "Signalement client",
  manual: "Création manuelle SISBM",
};

export const incidentCategoryLabels: Record<IncidentCategory, string> = {
  theft: "Vol ou tentative de vol",
  accident: "Accident",
  sos: "Détresse (SOS)",
  tamper: "Sabotage du boîtier",
  device_failure: "Panne du boîtier GPS",
  connectivity: "Perte de communication",
  speeding: "Excès de vitesse répétés",
  unauthorized_use: "Utilisation non autorisée",
  other: "Autre",
};

export const weekDayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
