import { eventTypeLabels } from "@/components/alerting-labels";
import { mockClone, mockDelay, mockId, mockNow, mockPaginate } from "@/lib/mock";
import {
  type Alert,
  type AlertListParams,
  type AlertStats,
  EVENT_TYPES,
  type EventType,
  type HistoryEntry,
  type NotificationConfig,
  type NotificationConfigPayload,
  type NotificationTemplate,
  type NotificationTemplatePayload,
  type PersonRef,
  type SendNotificationPayload,
  type Severity,
  type SmsListParams,
  type SmsMessage,
  type SmsStats,
} from "@/types/alerting";
import { ApiError, type Paginated } from "@/types/api";
import type { OrganizationRef } from "@/types/billing";

import { organizationService } from "./organization.service";
import { vehicleService } from "./vehicle.service";

/**
 * Alertes & Notifications — SERVICE SIMULÉ.
 *
 * L'API n'expose pas encore `/admin/alerts`, `/admin/notification-configs`, `/admin/sms`,
 * `/admin/notification-templates`. Les clients et véhicules sont RÉELS ; les alertes de
 * démonstration sont générées sur ces véhicules.
 *
 * Règles (§IV.4) appliquées ici, à reprendre côté serveur :
 *  - référence unique, client obligatoire, véhicule pour une alerte véhicule, date et source ;
 *  - aucune suppression : une alerte se traite et l'historique la suit ;
 *  - anti-répétition : une configuration n'envoie pas deux fois le même événement pour le même
 *    véhicule pendant son délai de carence ;
 *  - tout envoi (réussi ou en échec) est historisé.
 */

const ACTOR = "Vous (démo)";
const GATEWAY = "Orange CI (simulée)";
const SMS_UNIT_COST = 25;

interface Store {
  alerts: Alert[];
  configs: NotificationConfig[];
  sms: SmsMessage[];
  templates: NotificationTemplate[];
  orgs: OrganizationRef[];
  seq: number;
}

let store: Store | null = null;
let seeding: Promise<Store> | null = null;

const ADDRESSES = [
  "Bd Valéry Giscard d'Estaing, Marcory, Abidjan",
  "Autoroute du Nord, PK 24, Anyama",
  "Rue des Jardins, Cocody Deux-Plateaux, Abidjan",
  "Pont HKB, Plateau, Abidjan",
  "Carrefour Siporex, Yopougon, Abidjan",
  "Route de Bassam, Port-Bouët",
  "Zone industrielle de Vridi",
  "Corridor de Gesco, Yopougon",
];

const RULES: Partial<Record<EventType, string>> = {
  overspeed: "Vitesse > 90 km/h pendant 30 s",
  geofence_exit: "Sortie du périmètre autorisé",
  geofence_entry: "Entrée en zone interdite",
  schedule_violation: "Circulation hors plages horaires",
  power_cut: "Alimentation coupée",
  disconnection: "Aucune donnée depuis 30 min",
  sos: "Bouton SOS pressé",
  jamming: "Brouillage détecté",
  towing: "Déplacement moteur coupé",
  tamper: "Ouverture du boîtier",
  harsh_driving: "Freinage / accélération brusque",
};

const SEVERITY_OF: Record<EventType, Severity> = {
  overspeed: "medium",
  geofence_exit: "high",
  geofence_entry: "medium",
  schedule_violation: "medium",
  power_cut: "critical",
  disconnection: "high",
  sos: "critical",
  jamming: "critical",
  towing: "critical",
  tamper: "critical",
  harsh_driving: "low",
  engine_start: "low",
  engine_stop: "low",
};

const DEFAULT_TEMPLATES: Array<Omit<NotificationTemplate, "id" | "updatedAt">> = [
  {
    name: "Excès de vitesse — SMS",
    type: "overspeed",
    subject: "Excès de vitesse",
    content:
      "{{client}} : le véhicule {{immatriculation}} roulait à {{vitesse}} le {{date}} à {{heure}} ({{localisation}}).",
    channel: "sms",
    active: true,
  },
  {
    name: "Sortie de zone — E-mail",
    type: "geofence_exit",
    subject: "Sortie de zone : {{immatriculation}}",
    content:
      "Bonjour,\n\nLe véhicule {{vehicule}} ({{immatriculation}}) a quitté sa zone autorisée le {{date}} à {{heure}}.\nPosition : {{localisation}}.\n\nSISBM CORE",
    channel: "email",
    active: true,
  },
  {
    name: "Alerte critique — SMS",
    type: "general",
    subject: "Alerte critique",
    content:
      "ALERTE {{evenement}} — {{immatriculation}} ({{client}}) le {{date}} à {{heure}}. Position : {{localisation}}.",
    channel: "sms",
    active: true,
  },
  {
    name: "Coupure d'alimentation — SMS",
    type: "power_cut",
    subject: "Coupure d'alimentation",
    content: "{{client}} : alimentation coupée sur {{immatriculation}} le {{date}} à {{heure}}. Vérifiez le véhicule.",
    channel: "sms",
    active: false,
  },
];

function reference(s: Store, prefix: string, digits = 6): string {
  s.seq += 1;
  return `${prefix}-${new Date().getFullYear()}-${String(s.seq).padStart(digits, "0")}`;
}

export function historyEntry(action: string, description: string, actor = ACTOR, at = mockNow()): HistoryEntry {
  return { id: mockId(), at, actor, action, description };
}

async function seed(): Promise<Store> {
  const s: Store = { alerts: [], configs: [], sms: [], templates: [], orgs: [], seq: 0 };
  const now = mockNow();
  s.templates = DEFAULT_TEMPLATES.map((t) => ({ ...t, id: mockId(), updatedAt: now }));
  try {
    const orgs = (await organizationService.list({ perPage: 100 })).data;
    s.orgs = orgs.map((o) => ({ id: o.id, name: o.name, code: o.code }));
    const vehicles = (await vehicleService.list({ perPage: 60 })).data;
    const types = EVENT_TYPES.filter((t) => t !== "engine_start" && t !== "engine_stop");
    const count = Math.min(48, vehicles.length * 4);
    for (let i = 0; i < count; i += 1) {
      const v = vehicles[i % vehicles.length];
      const org = s.orgs.find((o) => o.id === v.organizationId) ?? {
        id: v.organizationId,
        name: v.organization?.name ?? "Client",
        code: v.organization?.code ?? "",
      };
      const type = types[(i * 7) % types.length];
      const at = new Date(Date.now() - (i * 2.7 + (i % 3)) * 3_600_000).toISOString();
      const age = i % 6;
      const status = age === 0 || age === 3 ? "new" : age === 1 ? "acknowledged" : age === 2 ? "assigned" : "resolved";
      const alert: Alert = {
        id: mockId(),
        reference: reference(s, "ALT"),
        occurredAt: at,
        organizationId: org.id,
        organization: org,
        vehicleId: v.id,
        vehicle: { id: v.id, registration: v.registration, label: v.label ?? null },
        eventType: type,
        severity: SEVERITY_OF[type],
        location: {
          lat: 5.3 + ((i * 13) % 20) / 100,
          lng: -4.05 + ((i * 7) % 20) / 100,
          address: ADDRESSES[i % ADDRESSES.length],
        },
        status,
        ruleName: RULES[type] ?? null,
        source: type === "sos" || type === "power_cut" || type === "tamper" ? "gps" : "rule_engine",
        detail: type === "overspeed" ? `${95 + (i % 30)} km/h (limite 90 km/h)` : null,
        assignee: status === "assigned" ? { id: "support", name: "Support niveau 1" } : null,
        incidentId: null,
        incidentReference: null,
        acknowledgedAt: status === "new" ? null : at,
        history: [
          historyEntry(
            "Déclenchement",
            `Alerte levée par ${RULES[type] ? "le moteur de règles" : "le boîtier GPS"}.`,
            "Système",
            at,
          ),
        ],
      };
      s.alerts.push(alert);
      // SMS envoyés pour les alertes critiques et hautes (journal de la passerelle).
      if (alert.severity === "critical" || alert.severity === "high") {
        const failed = i % 9 === 4;
        s.sms.push({
          id: mockId(),
          gateway: GATEWAY,
          to: `+225 07 ${String(10 + (i % 80)).padStart(2, "0")} ${String(20 + i).slice(-2)} ${String(30 + i * 3).slice(-2)} ${String(45 + i).slice(-2)}`,
          content: `ALERTE ${eventTypeLabels[type]} — ${v.registration} (${org.name}) à ${new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`,
          sentAt: at,
          cost: failed ? 0 : SMS_UNIT_COST,
          providerId: failed ? null : `OCI-${(900000 + i * 131).toString(36).toUpperCase()}`,
          transmission: failed ? "failed" : "sent",
          delivery: failed ? "unknown" : i % 7 === 2 ? "undelivered" : "delivered",
          failureReason: failed ? "Numéro invalide ou non joignable" : null,
          organization: org,
          alertReference: alert.reference,
        });
      }
    }
    if (s.orgs[0]) {
      s.configs.push(
        {
          id: mockId(),
          name: "Alertes critiques — direction",
          trigger: "sos",
          organizationId: null,
          organization: null,
          vehicleIds: [],
          recipients: [{ kind: "phone", value: "+225 07 00 00 00 01", label: "Astreinte SISBM" }],
          channels: ["sms", "email"],
          templateId: s.templates[2].id,
          priority: "critical",
          window: { always: true, days: [1, 2, 3, 4, 5, 6, 7], from: "00:00", to: "23:59" },
          cooldownMinutes: 5,
          active: true,
          updatedAt: now,
        },
        {
          id: mockId(),
          name: `Excès de vitesse — ${s.orgs[0].name}`,
          trigger: "overspeed",
          organizationId: s.orgs[0].id,
          organization: s.orgs[0],
          vehicleIds: [],
          recipients: [{ kind: "email", value: "flotte@client.ci", label: "Gestionnaire de flotte" }],
          channels: ["email"],
          templateId: s.templates[0].id,
          priority: "medium",
          window: { always: false, days: [1, 2, 3, 4, 5], from: "06:00", to: "20:00" },
          cooldownMinutes: 30,
          active: true,
          updatedAt: now,
        },
      );
    }
  } catch {
    // API injoignable : écrans vides plutôt que bloqués.
  }
  return s;
}

export async function alertingDb(): Promise<Store> {
  if (store) return store;
  seeding ??= seed();
  store = await seeding;
  return store;
}

async function findAlert(id: string): Promise<{ s: Store; alert: Alert }> {
  const s = await alertingDb();
  const alert = s.alerts.find((a) => a.id === id);
  if (!alert) throw new ApiError(404, "E_NOT_FOUND", "Alerte introuvable.");
  return { s, alert };
}

function matches(q: string | undefined, ...fields: Array<string | null | undefined>) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

/** Remplace les {{variables}} d'un modèle par les valeurs de l'alerte. */
export function renderTemplate(content: string, alert: Alert): string {
  const d = new Date(alert.occurredAt);
  const values: Record<string, string> = {
    client: alert.organization.name,
    vehicule: alert.vehicle?.label ?? alert.vehicle?.registration ?? "—",
    immatriculation: alert.vehicle?.registration ?? "—",
    date: d.toLocaleDateString("fr-FR"),
    heure: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    localisation: alert.location?.address ?? "position inconnue",
    evenement: eventTypeLabels[alert.eventType],
    vitesse: alert.detail ?? "—",
  };
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => values[key] ?? m);
}

export const alertingService = {
  // ── Alertes ────────────────────────────────────────────────────────────────

  /** GET /admin/alerts */
  async listAlerts(params: AlertListParams = {}): Promise<Paginated<Alert>> {
    await mockDelay();
    const rows = (await alertingDb()).alerts
      .filter(
        (a) =>
          (!params.organizationId || a.organizationId === params.organizationId) &&
          (!params.vehicleId || a.vehicleId === params.vehicleId) &&
          (!params.eventType || a.eventType === params.eventType) &&
          (!params.severity || a.severity === params.severity) &&
          (!params.status || a.status === params.status) &&
          (!params.from || a.occurredAt >= params.from) &&
          (!params.to || a.occurredAt <= params.to) &&
          matches(params.search, a.reference, a.vehicle?.registration, a.organization.name, a.ruleName),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return mockPaginate(rows, params);
  },

  /** GET /admin/alerts/stats */
  async alertStats(): Promise<AlertStats> {
    await mockDelay(150);
    const alerts = (await alertingDb()).alerts;
    const since = new Date(Date.now() - 86_400_000).toISOString();
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical" && a.status !== "resolved").length,
      untreated: alerts.filter((a) => a.status === "new").length,
      last24h: alerts.filter((a) => a.occurredAt >= since).length,
    };
  },

  async getAlert(id: string): Promise<Alert> {
    await mockDelay(150);
    return mockClone((await findAlert(id)).alert);
  },

  /** POST /admin/alerts/:id/acknowledge */
  async acknowledge(id: string): Promise<Alert> {
    await mockDelay();
    const { alert } = await findAlert(id);
    if (alert.status !== "new") throw new ApiError(409, "E_ALREADY_HANDLED", "Alerte déjà prise en compte.");
    alert.status = "acknowledged";
    alert.acknowledgedAt = mockNow();
    alert.history.push(historyEntry("Prise en compte", "Alerte marquée comme prise en compte."));
    return mockClone(alert);
  },

  /** POST /admin/alerts/:id/assign */
  async assign(id: string, assignee: PersonRef): Promise<Alert> {
    await mockDelay();
    const { alert } = await findAlert(id);
    if (alert.status === "resolved") throw new ApiError(409, "E_ALERT_CLOSED", "Alerte déjà traitée.");
    alert.assignee = assignee;
    if (alert.status === "new" || alert.status === "acknowledged") alert.status = "assigned";
    alert.acknowledgedAt ??= mockNow();
    alert.history.push(historyEntry("Assignation", `Responsable : ${assignee.name}.`));
    return mockClone(alert);
  },

  /** POST /admin/alerts/:id/resolve */
  async resolve(id: string, note: string): Promise<Alert> {
    await mockDelay();
    const { alert } = await findAlert(id);
    if (alert.status === "resolved") throw new ApiError(409, "E_ALERT_CLOSED", "Alerte déjà traitée.");
    alert.status = "resolved";
    alert.acknowledgedAt ??= mockNow();
    alert.history.push(historyEntry("Traitement", note));
    return mockClone(alert);
  },

  /** POST /admin/alerts/:id/notify — envoi manuel, historisé même en échec. */
  async sendNotification(payload: SendNotificationPayload): Promise<SmsMessage[]> {
    await mockDelay(500);
    const { s, alert } = await findAlert(payload.alertId);
    if (payload.recipients.length === 0) throw new ApiError(422, "E_VALIDATION", "Ajoutez au moins un destinataire.");
    if (!payload.message.trim()) throw new ApiError(422, "E_VALIDATION", "Message vide.");
    const message = renderTemplate(payload.message, alert);
    const sent: SmsMessage[] = [];
    for (const r of payload.recipients) {
      if (payload.channel === "sms") {
        const valid = /^\+?[\d\s]{8,}$/.test(r.value);
        const sms: SmsMessage = {
          id: mockId(),
          gateway: GATEWAY,
          to: r.value,
          content: message,
          sentAt: mockNow(),
          cost: valid ? SMS_UNIT_COST * Math.ceil(message.length / 160) : 0,
          providerId: valid ? `OCI-${Date.now().toString(36).toUpperCase()}` : null,
          transmission: valid ? "sent" : "failed",
          delivery: valid ? "unknown" : "unknown",
          failureReason: valid ? null : "Numéro de téléphone invalide",
          organization: alert.organization,
          alertReference: alert.reference,
        };
        s.sms.push(sms);
        sent.push(sms);
      }
    }
    alert.history.push(
      historyEntry(
        "Notification",
        `${payload.channel.toUpperCase()} envoyé à ${payload.recipients.map((r) => r.label || r.value).join(", ")}.`,
      ),
    );
    return mockClone(sent);
  },

  /** Lien alerte → incident (appelé par le service des incidents). */
  async linkIncident(alertIds: string[], incident: { id: string; reference: string }) {
    const s = await alertingDb();
    for (const id of alertIds) {
      const alert = s.alerts.find((a) => a.id === id);
      if (!alert) continue;
      alert.incidentId = incident.id;
      alert.incidentReference = incident.reference;
      if (alert.status !== "resolved") alert.status = "escalated";
      alert.history.push(historyEntry("Incident", `Rattachée à l'incident ${incident.reference}.`));
    }
  },

  async organizations(): Promise<OrganizationRef[]> {
    return mockClone((await alertingDb()).orgs);
  },

  // ── Configurations ─────────────────────────────────────────────────────────

  async listConfigs(): Promise<NotificationConfig[]> {
    await mockDelay();
    return mockClone((await alertingDb()).configs);
  },

  async saveConfig(payload: NotificationConfigPayload, id?: string): Promise<NotificationConfig> {
    await mockDelay();
    const s = await alertingDb();
    if (!payload.name.trim()) throw new ApiError(422, "E_VALIDATION", "Nom obligatoire.");
    if (payload.channels.length === 0) throw new ApiError(422, "E_VALIDATION", "Choisissez au moins un canal.");
    if (payload.recipients.length === 0) throw new ApiError(422, "E_VALIDATION", "Ajoutez au moins un destinataire.");
    const organization = payload.organizationId ? (s.orgs.find((o) => o.id === payload.organizationId) ?? null) : null;
    const next: NotificationConfig = { ...payload, id: id ?? mockId(), organization, updatedAt: mockNow() };
    const index = s.configs.findIndex((c) => c.id === id);
    if (index >= 0) s.configs[index] = next;
    else s.configs.unshift(next);
    return mockClone(next);
  },

  async toggleConfig(id: string, active: boolean): Promise<NotificationConfig> {
    await mockDelay(200);
    const c = (await alertingDb()).configs.find((x) => x.id === id);
    if (!c) throw new ApiError(404, "E_NOT_FOUND", "Configuration introuvable.");
    c.active = active;
    c.updatedAt = mockNow();
    return mockClone(c);
  },

  // ── SMS ────────────────────────────────────────────────────────────────────

  async listSms(params: SmsListParams = {}): Promise<Paginated<SmsMessage>> {
    await mockDelay();
    const rows = (await alertingDb()).sms
      .filter(
        (m) =>
          (!params.transmission || m.transmission === params.transmission) &&
          (!params.organizationId || m.organization?.id === params.organizationId) &&
          matches(params.search, m.to, m.content, m.providerId, m.alertReference),
      )
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return mockPaginate(rows, params);
  },

  async smsStats(): Promise<SmsStats> {
    await mockDelay(150);
    const sms = (await alertingDb()).sms;
    return {
      sent: sms.filter((m) => m.transmission === "sent").length,
      failed: sms.filter((m) => m.transmission === "failed").length,
      delivered: sms.filter((m) => m.delivery === "delivered").length,
      cost: sms.reduce((sum, m) => sum + m.cost, 0),
    };
  },

  // ── Modèles ────────────────────────────────────────────────────────────────

  async listTemplates(): Promise<NotificationTemplate[]> {
    await mockDelay();
    return mockClone((await alertingDb()).templates);
  },

  async saveTemplate(payload: NotificationTemplatePayload, id?: string): Promise<NotificationTemplate> {
    await mockDelay();
    const s = await alertingDb();
    if (!payload.name.trim() || !payload.content.trim()) {
      throw new ApiError(422, "E_VALIDATION", "Nom et contenu obligatoires.");
    }
    const unknown = [...payload.content.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
      .map((m) => m[1])
      .filter(
        (v) =>
          !["client", "vehicule", "immatriculation", "date", "heure", "localisation", "evenement", "vitesse"].includes(
            v,
          ),
      );
    if (unknown.length > 0) {
      throw new ApiError(422, "E_VALIDATION", `Variable inconnue : {{${unknown[0]}}}.`);
    }
    const next: NotificationTemplate = { ...payload, id: id ?? mockId(), updatedAt: mockNow() };
    const index = s.templates.findIndex((t) => t.id === id);
    if (index >= 0) s.templates[index] = next;
    else s.templates.unshift(next);
    return mockClone(next);
  },

  /** Événements qui ont un libellé (pour les sélecteurs). */
  eventTypes(): EventType[] {
    return [...EVENT_TYPES];
  },
};
