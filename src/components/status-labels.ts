import type { StatusTone } from "@/components/status-badge";
import type { InvoiceKind, InvoiceStatus, PaymentStatus, ReminderChannel, ReminderSendStatus } from "@/types/billing";
import type { ClientStatus, ClientType } from "@/types/client-profile";
import type { CommandStatus } from "@/types/command";
import type { DeviceStatus } from "@/types/device";
import type { OfferPeriodicity, OfferStatus } from "@/types/offer";
import type { SubscriptionStatus } from "@/types/subscription";
import type { UserStatus } from "@/types/user";
import type { ConnectionState, VehicleStatus, VehicleType } from "@/types/vehicle";

type Meta = { label: string; tone: StatusTone };

export const userStatusMeta: Record<UserStatus, Meta> = {
  active: { label: "Actif", tone: "success" },
  pending: { label: "En attente", tone: "warning" },
  suspended: { label: "Suspendu", tone: "orange" },
};

export const deviceStatusMeta: Record<DeviceStatus, Meta> = {
  stock: { label: "En stock", tone: "info" },
  active: { label: "Actif", tone: "success" },
  maintenance: { label: "Maintenance", tone: "warning" },
  decommissioned: { label: "Retiré", tone: "neutral" },
};

export const vehicleStatusMeta: Record<VehicleStatus, Meta> = {
  draft: { label: "Brouillon", tone: "neutral" },
  active: { label: "Actif", tone: "success" },
  maintenance: { label: "Maintenance", tone: "warning" },
  inactive: { label: "Inactif", tone: "orange" },
  archived: { label: "Archivé", tone: "neutral" },
};

export const offerStatusMeta: Record<OfferStatus, Meta> = {
  draft: { label: "Brouillon", tone: "neutral" },
  active: { label: "Commercialisée", tone: "success" },
  retired: { label: "Retirée", tone: "orange" },
};

export const clientStatusMeta: Record<ClientStatus, Meta> = {
  prospect: { label: "Prospect", tone: "info" },
  active: { label: "Actif", tone: "success" },
  suspended: { label: "Suspendu", tone: "orange" },
  terminated: { label: "Résilié", tone: "danger" },
  archived: { label: "Archivé", tone: "neutral" },
};

export const clientTypeLabels: Record<ClientType, string> = {
  owner: "Client propriétaire",
  operator: "Client exploitant",
};

export const subscriptionStatusMeta: Record<SubscriptionStatus, Meta> = {
  draft: { label: "Brouillon", tone: "neutral" },
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspendue", tone: "orange" },
  terminated: { label: "Résiliée", tone: "danger" },
};

export const invoiceStatusMeta: Record<InvoiceStatus, Meta> = {
  draft: { label: "Brouillon", tone: "neutral" },
  unpaid: { label: "Impayée", tone: "info" },
  partial: { label: "Partiellement payée", tone: "warning" },
  overdue: { label: "En retard", tone: "danger" },
  paid: { label: "Payée", tone: "success" },
  cancelled: { label: "Annulée", tone: "neutral" },
};

export const invoiceKindLabels: Record<InvoiceKind, string> = {
  standard: "Facture d'abonnement",
  complement: "Complément",
  correction: "Correction",
};

export const paymentStatusMeta: Record<PaymentStatus, Meta> = {
  confirmed: { label: "Confirmé", tone: "success" },
  cancelled: { label: "Annulé", tone: "neutral" },
};

export const reminderSendStatusMeta: Record<ReminderSendStatus, Meta> = {
  sent: { label: "Envoyée", tone: "success" },
  failed: { label: "Échec", tone: "danger" },
};

export const reminderChannelLabels: Record<ReminderChannel, string> = {
  email: "E-mail",
  sms: "SMS",
};

/** Niveaux de relance : 1 = rappel amiable, 2 = relance, 3 = mise en demeure. */
export function reminderLevelMeta(level: number): Meta {
  if (level >= 3) return { label: "Mise en demeure", tone: "danger" };
  if (level === 2) return { label: "Relance", tone: "orange" };
  if (level === 1) return { label: "Rappel amiable", tone: "warning" };
  return { label: "Jamais relancée", tone: "neutral" };
}

export const offerPeriodicityLabels: Record<OfferPeriodicity, string> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  semiannual: "Semestrielle",
  annual: "Annuelle",
};

/** Suffixe court pour un tarif : « 15 000 XOF / mois ». */
export const offerPeriodicityShort: Record<OfferPeriodicity, string> = {
  monthly: "mois",
  quarterly: "trimestre",
  semiannual: "semestre",
  annual: "an",
};

export const vehicleTypeLabels: Record<VehicleType, string> = {
  car: "Voiture",
  van: "Fourgon",
  truck: "Camion",
  tanker: "Citerne",
  bus: "Bus",
  motorcycle: "Moto",
  trailer: "Remorque",
  machinery: "Engin",
  other: "Autre",
};

const commandStatusMap: Record<string, Meta> = {
  approved: { label: "Acceptée", tone: "info" },
  queued: { label: "En file", tone: "info" },
  sent: { label: "Envoyée", tone: "info" },
  acknowledged: { label: "Acquittée", tone: "success" },
  failed: { label: "Échec", tone: "danger" },
  expired: { label: "Expirée", tone: "neutral" },
  cancelled: { label: "Annulée", tone: "neutral" },
};

export function commandStatusMeta(status: CommandStatus): Meta {
  return commandStatusMap[status] ?? { label: status, tone: "neutral" };
}

const commandTypeMap: Record<string, string> = {
  engine_cut: "Coupure carburant",
  engine_restore: "Rétablissement carburant",
  locate: "Localisation",
  reboot: "Redémarrage",
  set_interval: "Intervalle de suivi",
  custom: "Commande personnalisée",
};

export function commandTypeLabel(type: string): string {
  return commandTypeMap[type] ?? type;
}

export function connectionStateMeta(state: ConnectionState | null | undefined): Meta {
  if (state === "online") return { label: "En ligne", tone: "success" };
  if (state === "offline") return { label: "Hors ligne", tone: "danger" };
  if (state === "stale") return { label: "Données anciennes", tone: "warning" };
  return { label: state ?? "Inconnu", tone: "neutral" };
}

export const PERMISSION_LABELS: Record<string, string> = {
  "*": "Accès total",
  vehicle: "Véhicules",
  device: "Trackers",
  user: "Utilisateurs",
  geofence: "Géofences",
  policy: "Politiques",
  alert: "Alertes",
  incident: "Incidents",
  report: "Rapports",
  command: "Commandes",
  audit: "Journal d'audit",
};

export const PERMISSION_ACTION_LABELS: Record<string, string> = {
  "*": "tout",
  read: "lecture",
  write: "écriture",
  immobilize: "coupure / rétablissement moteur",
  sensitive: "commandes sensibles",
};

export function permissionLabel(permission: string): string {
  if (permission === "*") return PERMISSION_LABELS["*"];
  const [resource, action] = permission.split(":");
  const r = PERMISSION_LABELS[resource] ?? resource;
  const a = PERMISSION_ACTION_LABELS[action] ?? action;
  return `${r} · ${a}`;
}
