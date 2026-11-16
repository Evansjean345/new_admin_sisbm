import type { StatusTone } from "@/components/status-badge";
import type {
  AlertStatus,
  EventType,
  NotificationChannel,
  Severity,
  SmsDelivery,
  SmsTransmission,
} from "@/types/alerting";
import type {
  IncidentEvent,
  IncidentEventCategory,
  IncidentSource,
  IncidentStatus,
  IncidentType,
} from "@/types/incident";

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

export const incidentCategoryLabels: Record<IncidentEventCategory, string> = {
  security: "Sécurité",
  geolocation: "Géolocalisation",
  driving: "Conduite",
  engine: "Moteur",
  immobilization: "Immobilisation",
  technical: "Technique",
  maintenance: "Maintenance",
  business: "Métier SISBM Core",
  supervision: "Supervision",
  other: "Autre",
};

export const incidentEventLabels: Record<IncidentEvent, string> = {
  sos_button_activated: "Bouton SOS activé",
  gsm_jamming_detected: "Détection de brouillage GSM (Jamming)",
  tracker_disconnected: "Déconnexion du tracker GPS",
  device_tamper_detected: "Événement physique ou électrique détecté sur le dispositif",
  main_power_cut: "Coupure de l'alimentation principale",
  vehicle_towed: "Remorquage du véhicule",
  forbidden_zone_entry: "Entrée dans une zone interdite",
  authorized_zone_exit: "Sortie d'une zone autorisée",
  poi_arrival: "Arrivée sur un site (point d'intérêt)",
  overspeed: "Excès de vitesse",
  impact_detected: "Choc détecté",
  off_hours_driving: "Conduite hors horaires autorisés",
  harsh_driving: "Conduite brusque",
  ignition_on: "Contact (Ignition) ON",
  ignition_off: "Contact OFF",
  engine_started: "Démarrage moteur",
  engine_stopped: "Arrêt moteur",
  engine_outside_allowed_hours: "Fonctionnement moteur hors horaires autorisés",
  stop_started: "Début d'arrêt",
  prolonged_stop: "Arrêt prolongé",
  unauthorized_stop: "Arrêt non autorisé",
  vehicle_battery_low: "Batterie véhicule faible",
  abnormal_supply_voltage: "Tension d'alimentation anormale",
  gps_satellite_signal_lost: "Perte du signal satellite GPS",
  gps_unavailable: "GPS indisponible / hors ligne",
  gps_antenna_disconnected: "Antenne GPS déconnectée",
  gsm_communication_lost: "Perte de communication GSM",
  tracker_offline: "Tracker hors ligne",
  server_communication_lost: "Absence de communication avec le serveur pendant une durée définie",
  technical_visit_due: "Visite technique à échéance",
  preventive_maintenance_due: "Maintenance préventive à échéance",
  inspection_overdue: "Révision dépassée",
  oil_change_due: "Vidange à effectuer",
  vehicle_used_outside_hours: "Véhicule utilisé hors horaires autorisés",
  vehicle_inactive_days: "Véhicule inactif depuis plusieurs jours",
  supervision_tracker_offline: "Tracker hors ligne (supervision)",
  data_loss: "Perte de données",
  transmission_error: "Erreur de transmission",
  remote_command_failed: "Échec d'une commande distante",
  other_event: "Autre événement",
};

export const incidentTypeLabels: Record<IncidentType, string> = {
  theft: "Vol ou tentative de vol",
  accident: "Accident / choc",
  sos: "Détresse (SOS)",
  tamper: "Sabotage / altération du boîtier",
  device_failure: "Panne du boîtier GPS",
  connectivity: "Perte de communication",
  speeding: "Excès de vitesse",
  unauthorized_use: "Utilisation non autorisée",
  dangerous_driving: "Conduite dangereuse",
  immobilization: "Immobilisation anormale",
  maintenance: "Maintenance à effectuer",
  supervision: "Anomalie de supervision",
  other: "Autre",
};

export const weekDayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
