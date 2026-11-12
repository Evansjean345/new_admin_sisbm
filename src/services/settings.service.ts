import { mockClone, mockDelay, mockId, mockNow } from "@/lib/mock";
import { ApiError } from "@/types/api";
import type {
  EmailPayload,
  EmailSettings,
  GeneralSettings,
  ReferentialItem,
  ReferentialKind,
  ServiceHealth,
  SettingsChange,
  SmsGatewayPayload,
  SmsGatewaySettings,
  TechnicalSettings,
} from "@/types/settings";

import { flespiService } from "./flespi.service";
import { organizationService } from "./organization.service";

/**
 * Paramètres — SERVICE SIMULÉ (routes attendues : /admin/settings/*), sauf la surveillance
 * des services qui interroge l'API réelle et Flespi.
 *
 * Règles (§VII.3) : les secrets ne sont jamais renvoyés (`hasSecret`) ; chaque modification est
 * historisée ; une passerelle doit réussir un test avant d'être considérée connectée.
 */

const ACTOR = "Vous (démo)";

const state = {
  general: {
    platformName: "SISBM CORE",
    logo: null,
    language: "fr",
    timezone: "Africa/Abidjan",
    dateFormat: "dd/MM/yyyy",
    numberFormat: "fr-FR",
    currency: "XOF",
    contact: {
      companyName: "SISBM",
      address: "Abidjan, Côte d'Ivoire",
      phone: "",
      email: "",
      website: "",
      registrationNumber: "",
    },
  } as GeneralSettings,
  sms: {
    provider: "Orange CI",
    username: "",
    hasSecret: false,
    serviceUrl: "https://api.orange.com/smsmessaging/v1",
    sender: "SISBM",
    unitCost: 25,
    balance: null,
    status: "untested",
    lastTestAt: null,
    lastError: null,
  } as SmsGatewaySettings,
  email: {
    provider: "smtp",
    host: "",
    port: 587,
    encryption: "tls",
    username: "",
    hasSecret: false,
    fromAddress: "",
    fromName: "SISBM CORE",
    status: "untested",
    lastTestAt: null,
    lastError: null,
  } as EmailSettings,
  technical: {
    logLevel: "info",
    auditRetentionDays: 365,
    gpsRetentionDays: 90,
    syncIntervalSeconds: 30,
    offlineAfterMinutes: 30,
    backup: { frequency: "daily", time: "02:00", retentionDays: 30, lastBackupAt: null },
  } as TechnicalSettings,
  referentials: {
    brands: [
      { name: "Toyota", models: ["Hilux", "Land Cruiser", "Corolla", "Hiace"] },
      { name: "Mitsubishi", models: ["L200", "Pajero", "Canter"] },
      { name: "Renault", models: ["Duster", "Master", "Kerax"] },
      { name: "Mercedes-Benz", models: ["Actros", "Sprinter", "Axor"] },
      { name: "Isuzu", models: ["D-Max", "NPR", "FVR"] },
      { name: "Hyundai", models: ["H-1", "HD65", "Tucson"] },
    ].map((b) => ({
      id: mockId(),
      code: b.name.toLowerCase().replace(/[^a-z]/g, "-"),
      label: b.name,
      active: true,
      children: b.models.map((m) => ({
        id: mockId(),
        code: m.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        label: m,
        active: true,
      })),
    })),
    vehicleTypes: [
      ["car", "Voiture"],
      ["van", "Fourgon"],
      ["truck", "Camion"],
      ["tanker", "Citerne"],
      ["bus", "Bus"],
      ["motorcycle", "Moto"],
      ["trailer", "Remorque"],
      ["machinery", "Engin"],
      ["other", "Autre"],
    ].map(([code, label]) => ({ id: mockId(), code, label, active: true })),
    eventCategories: [
      ["overspeed", "Excès de vitesse"],
      ["geofence", "Entrée / sortie de zone"],
      ["schedule", "Circulation hors horaires"],
      ["power", "Coupure d'alimentation"],
      ["connectivity", "Perte de connexion"],
      ["sos", "SOS"],
      ["jamming", "Brouillage GPS/GSM"],
      ["towing", "Remorquage"],
      ["tamper", "Ouverture / sabotage"],
      ["driving", "Comportement de conduite"],
      ["engine", "Démarrage / arrêt moteur"],
    ].map(([code, label]) => ({ id: mockId(), code, label, active: true })),
    incidentCategories: [
      ["theft", "Vol ou tentative de vol"],
      ["accident", "Accident"],
      ["sos", "Détresse (SOS)"],
      ["tamper", "Sabotage du boîtier"],
      ["device_failure", "Panne du boîtier GPS"],
      ["connectivity", "Perte de communication"],
      ["speeding", "Excès de vitesse répétés"],
      ["unauthorized_use", "Utilisation non autorisée"],
      ["other", "Autre"],
    ].map(([code, label]) => ({ id: mockId(), code, label, active: true })),
  } as Record<ReferentialKind, ReferentialItem[]>,
  history: [] as SettingsChange[],
};

function log(section: string, description: string) {
  state.history.unshift({ id: mockId(), at: mockNow(), actor: ACTOR, section, description });
}

/** Liste lisible des champs modifiés, sans jamais citer la valeur d'un secret. */
function diff(before: object, after: object, labels: Record<string, string>): string {
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changed = Object.keys(labels).filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  return changed.length ? `Champs modifiés : ${changed.map((k) => labels[k]).join(", ")}.` : "Aucun changement.";
}

function slug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const settingsService = {
  async getGeneral(): Promise<GeneralSettings> {
    await mockDelay(150);
    return mockClone(state.general);
  },
  async saveGeneral(next: GeneralSettings): Promise<GeneralSettings> {
    await mockDelay();
    if (!next.platformName.trim()) throw new ApiError(422, "E_VALIDATION", "Nom de la plateforme obligatoire.");
    const d = diff(state.general, next, {
      platformName: "nom",
      logo: "logo",
      language: "langue",
      timezone: "fuseau horaire",
      dateFormat: "format des dates",
      numberFormat: "format des nombres",
      currency: "devise",
      contact: "coordonnées",
    });
    state.general = mockClone(next);
    log("Paramètres généraux", d);
    return mockClone(state.general);
  },

  async getSms(): Promise<SmsGatewaySettings> {
    await mockDelay(150);
    return mockClone(state.sms);
  },
  async saveSms(payload: SmsGatewayPayload): Promise<SmsGatewaySettings> {
    await mockDelay();
    if (!/^https:\/\//.test(payload.serviceUrl))
      throw new ApiError(422, "E_VALIDATION", "L'URL de service doit être en https://.");
    if (payload.sender.length > 11) throw new ApiError(422, "E_VALIDATION", "Expéditeur : 11 caractères maximum.");
    const { secret, ...rest } = payload;
    const d = diff(state.sms, rest, {
      provider: "fournisseur",
      username: "identifiant",
      serviceUrl: "URL",
      sender: "expéditeur",
      unitCost: "coût unitaire",
    });
    state.sms = { ...state.sms, ...rest, hasSecret: state.sms.hasSecret || Boolean(secret), status: "untested" };
    log("Passerelle SMS", `${d}${secret ? " Clé secrète remplacée." : ""}`);
    return mockClone(state.sms);
  },
  async testSms(): Promise<SmsGatewaySettings> {
    await mockDelay(900);
    const ok = Boolean(state.sms.username && state.sms.hasSecret);
    state.sms.status = ok ? "connected" : "error";
    state.sms.lastTestAt = mockNow();
    state.sms.lastError = ok ? null : "Identifiant ou clé secrète manquant.";
    state.sms.balance = ok ? 12_480 : null;
    log("Passerelle SMS", ok ? "Test de connexion réussi." : "Test de connexion en échec.");
    return mockClone(state.sms);
  },

  async getEmail(): Promise<EmailSettings> {
    await mockDelay(150);
    return mockClone(state.email);
  },
  async saveEmail(payload: EmailPayload): Promise<EmailSettings> {
    await mockDelay();
    if (payload.fromAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.fromAddress)) {
      throw new ApiError(422, "E_VALIDATION", "Adresse d'expédition invalide.");
    }
    if (payload.port < 1 || payload.port > 65535) throw new ApiError(422, "E_VALIDATION", "Port invalide.");
    const { secret, ...rest } = payload;
    const d = diff(state.email, rest, {
      provider: "fournisseur",
      host: "serveur",
      port: "port",
      encryption: "chiffrement",
      username: "identifiant",
      fromAddress: "adresse d'expédition",
      fromName: "nom d'expéditeur",
    });
    state.email = { ...state.email, ...rest, hasSecret: state.email.hasSecret || Boolean(secret), status: "untested" };
    log("Paramètres e-mail", `${d}${secret ? " Clé secrète remplacée." : ""}`);
    return mockClone(state.email);
  },
  async testEmail(to: string): Promise<EmailSettings> {
    await mockDelay(900);
    const ok = Boolean(state.email.host && state.email.username && state.email.hasSecret && state.email.fromAddress);
    state.email.status = ok ? "connected" : "error";
    state.email.lastTestAt = mockNow();
    state.email.lastError = ok ? null : "Configuration incomplète (serveur, identifiant, clé ou adresse d'expédition).";
    log("Paramètres e-mail", ok ? `E-mail de test envoyé à ${to}.` : "Test d'envoi en échec.");
    return mockClone(state.email);
  },

  async getReferential(kind: ReferentialKind): Promise<ReferentialItem[]> {
    await mockDelay(150);
    return mockClone(state.referentials[kind]);
  },
  /** Ajoute un élément (ou un modèle sous une marque avec `parentId`). Le code est figé à la création. */
  async addReferentialItem(kind: ReferentialKind, label: string, parentId?: string): Promise<ReferentialItem> {
    await mockDelay(200);
    const clean = label.trim();
    if (!clean) throw new ApiError(422, "E_VALIDATION", "Libellé obligatoire.");
    const list = parentId
      ? state.referentials[kind].find((i) => i.id === parentId)?.children
      : state.referentials[kind];
    if (!list) throw new ApiError(404, "E_NOT_FOUND", "Élément parent introuvable.");
    if (list.some((i) => i.label.toLowerCase() === clean.toLowerCase())) {
      throw new ApiError(409, "E_DUPLICATE", `« ${clean} » existe déjà.`);
    }
    const item: ReferentialItem = {
      id: mockId(),
      code: slug(clean),
      label: clean,
      active: true,
      ...(kind === "brands" && !parentId ? { children: [] } : {}),
    };
    list.push(item);
    log("Référentiels", `Ajout de « ${clean} ».`);
    return mockClone(item);
  },
  async updateReferentialItem(
    kind: ReferentialKind,
    id: string,
    patch: { label?: string; active?: boolean },
  ): Promise<void> {
    await mockDelay(200);
    const all = state.referentials[kind].flatMap((i) => [i, ...(i.children ?? [])]);
    const item = all.find((i) => i.id === id);
    if (!item) throw new ApiError(404, "E_NOT_FOUND", "Élément introuvable.");
    if (patch.label !== undefined) {
      if (!patch.label.trim()) throw new ApiError(422, "E_VALIDATION", "Libellé obligatoire.");
      log("Référentiels", `« ${item.label} » renommé en « ${patch.label.trim()} ».`);
      item.label = patch.label.trim();
    }
    if (patch.active !== undefined) {
      item.active = patch.active;
      log("Référentiels", `« ${item.label} » ${patch.active ? "réactivé" : "désactivé"}.`);
    }
  },

  async getTechnical(): Promise<TechnicalSettings> {
    await mockDelay(150);
    return mockClone(state.technical);
  },
  async saveTechnical(next: TechnicalSettings): Promise<TechnicalSettings> {
    await mockDelay();
    if (next.auditRetentionDays < 365) {
      throw new ApiError(422, "E_VALIDATION", "Le journal d'audit doit être conservé au moins 365 jours.");
    }
    if (next.syncIntervalSeconds < 5) throw new ApiError(422, "E_VALIDATION", "Synchronisation : 5 secondes minimum.");
    const d = diff(state.technical, next, {
      logLevel: "niveau de journalisation",
      auditRetentionDays: "conservation de l'audit",
      gpsRetentionDays: "conservation GPS",
      syncIntervalSeconds: "synchronisation",
      offlineAfterMinutes: "délai hors ligne",
      backup: "sauvegardes",
    });
    state.technical = mockClone(next);
    log("Paramètres techniques", d);
    return mockClone(state.technical);
  },
  async runBackup(): Promise<TechnicalSettings> {
    await mockDelay(1200);
    state.technical.backup.lastBackupAt = mockNow();
    log("Paramètres techniques", "Sauvegarde manuelle lancée.");
    return mockClone(state.technical);
  },

  /** Surveillance : API et Flespi interrogés RÉELLEMENT ; les autres services sont simulés. */
  async health(): Promise<ServiceHealth[]> {
    const now = mockNow();
    const timed = async (fn: () => Promise<unknown>) => {
      const t = performance.now();
      try {
        await fn();
        return { ok: true, ms: Math.round(performance.now() - t), error: null as string | null };
      } catch (e) {
        return { ok: false, ms: Math.round(performance.now() - t), error: e instanceof Error ? e.message : "Erreur" };
      }
    };
    const [api, flespi] = await Promise.all([
      timed(() => organizationService.list({ perPage: 1 })),
      timed(() => flespiService.health()),
    ]);
    return [
      {
        key: "api",
        label: "API SISBM CORE",
        status: api.ok ? "up" : "down",
        latencyMs: api.ms,
        checkedAt: now,
        detail: api.error,
      },
      {
        key: "flespi",
        label: "Flespi (ingestion GPS)",
        status: flespi.ok ? "up" : "down",
        latencyMs: flespi.ms,
        checkedAt: now,
        detail: flespi.error,
      },
      {
        key: "sms",
        label: "Passerelle SMS",
        status: state.sms.status === "connected" ? "up" : state.sms.status === "error" ? "down" : "degraded",
        latencyMs: null,
        checkedAt: state.sms.lastTestAt ?? now,
        detail: state.sms.status === "untested" ? "Jamais testée" : state.sms.lastError,
      },
      {
        key: "email",
        label: "Service e-mail",
        status: state.email.status === "connected" ? "up" : state.email.status === "error" ? "down" : "degraded",
        latencyMs: null,
        checkedAt: state.email.lastTestAt ?? now,
        detail: state.email.status === "untested" ? "Jamais testé" : state.email.lastError,
      },
      {
        key: "backup",
        label: "Sauvegardes",
        status: state.technical.backup.lastBackupAt ? "up" : "degraded",
        latencyMs: null,
        checkedAt: state.technical.backup.lastBackupAt ?? now,
        detail: state.technical.backup.lastBackupAt ? null : "Aucune sauvegarde enregistrée",
      },
    ];
  },

  async history(): Promise<SettingsChange[]> {
    await mockDelay(100);
    return mockClone(state.history);
  },
};
