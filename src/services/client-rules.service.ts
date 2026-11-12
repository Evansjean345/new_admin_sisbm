import { mockClone, mockDelay, mockId, mockNow } from "@/lib/mock";
import { ApiError } from "@/types/api";
import type { OrganizationRef } from "@/types/billing";
import type {
  Geofence,
  GeofencePayload,
  Rule,
  RulePayload,
  SpeedPolicy,
  SpeedPolicyPayload,
} from "@/types/client-rules";

import { organizationService } from "./organization.service";

/**
 * Zones, politiques de vitesse et règles — SERVICE SIMULÉ.
 * Routes attendues : /geofences, /speed-policies, /rules (cloisonnées par client côté serveur ;
 * le SuperAdmin les appelle avec `organizationId`).
 *
 * Règles appliquées ici, à reprendre côté serveur :
 *  - un cercle a un centre et un rayon ≥ 50 m ; un polygone au moins 3 sommets ;
 *  - une politique « zone » vise une zone du MÊME client ; « véhicule » au moins un véhicule ;
 *  - une règle a au moins une action ; une règle inactive n'est jamais évaluée ;
 *  - aucune suppression physique : on désactive (historique des alertes conservé).
 */

interface Store {
  orgs: OrganizationRef[];
  geofences: Geofence[];
  policies: SpeedPolicy[];
  rules: Rule[];
}

let store: Store | null = null;
let seeding: Promise<Store> | null = null;

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed"];

async function seed(): Promise<Store> {
  const s: Store = { orgs: [], geofences: [], policies: [], rules: [] };
  try {
    s.orgs = (await organizationService.list({ perPage: 100 })).data.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code,
    }));
  } catch {
    return s;
  }
  const now = mockNow();
  s.orgs.slice(0, 4).forEach((org, i) => {
    const depot: Geofence = {
      id: mockId(),
      organizationId: org.id,
      organization: org,
      name: "Dépôt principal",
      description: "Zone de stationnement autorisée la nuit.",
      shape: "circle",
      center: { lat: 5.3 + i * 0.03, lng: -4.02 - i * 0.02 },
      radiusM: 400,
      points: [],
      kind: "authorized",
      alertOnEntry: false,
      alertOnExit: true,
      vehicleIds: [],
      color: COLORS[0],
      active: true,
      updatedAt: now,
    };
    const forbidden: Geofence = {
      id: mockId(),
      organizationId: org.id,
      organization: org,
      name: "Zone portuaire (interdite)",
      description: null,
      shape: "polygon",
      center: null,
      radiusM: null,
      points: [
        { lat: 5.25 + i * 0.01, lng: -4.0 },
        { lat: 5.26 + i * 0.01, lng: -3.98 },
        { lat: 5.245 + i * 0.01, lng: -3.965 },
        { lat: 5.235 + i * 0.01, lng: -3.99 },
      ],
      kind: "forbidden",
      alertOnEntry: true,
      alertOnExit: false,
      vehicleIds: [],
      color: COLORS[2],
      active: i % 2 === 0,
      updatedAt: now,
    };
    s.geofences.push(depot, forbidden);
    s.policies.push(
      {
        id: mockId(),
        organizationId: org.id,
        organization: org,
        name: "Limite générale",
        scope: "global",
        zoneId: null,
        vehicleIds: [],
        limitKph: 90,
        toleranceKph: 5,
        minDurationSeconds: 30,
        severity: "medium",
        limiterEnabled: false,
        active: true,
        updatedAt: now,
      },
      {
        id: mockId(),
        organizationId: org.id,
        organization: org,
        name: "Dépôt : 20 km/h",
        scope: "zone",
        zoneId: depot.id,
        vehicleIds: [],
        limitKph: 20,
        toleranceKph: 0,
        minDurationSeconds: 10,
        severity: "low",
        limiterEnabled: false,
        active: true,
        updatedAt: now,
      },
    );
    s.rules.push(
      {
        id: mockId(),
        organizationId: org.id,
        organization: org,
        name: "Excès de vitesse prolongé",
        description: "Alerte et SMS au gestionnaire si plus de 20 km/h au-dessus de la limite pendant 1 minute.",
        trigger: "overspeed",
        conditions: [
          { id: mockId(), field: "speed", operator: "gt", value: "110" },
          { id: mockId(), field: "duration", operator: "gt", value: "60" },
        ],
        actions: [
          { id: mockId(), type: "alert", value: "high" },
          { id: mockId(), type: "notify", value: "SMS au gestionnaire de flotte" },
        ],
        severity: "high",
        active: true,
        triggerCount: 14 + i * 3,
        lastTriggeredAt: new Date(Date.now() - (i + 1) * 5_400_000).toISOString(),
        updatedAt: now,
      },
      {
        id: mockId(),
        organizationId: org.id,
        organization: org,
        name: "Sortie du dépôt la nuit",
        description: "Incident Sécurité / SOC si un véhicule quitte le dépôt entre 22 h et 5 h.",
        trigger: "geofence_exit",
        conditions: [
          { id: mockId(), field: "zone", operator: "eq", value: "Dépôt principal" },
          { id: mockId(), field: "time", operator: "outside", value: "05:00-22:00" },
        ],
        actions: [
          { id: mockId(), type: "alert", value: "critical" },
          { id: mockId(), type: "incident", value: "Sécurité / SOC" },
        ],
        severity: "critical",
        active: true,
        triggerCount: i,
        lastTriggeredAt: i ? new Date(Date.now() - i * 86_400_000).toISOString() : null,
        updatedAt: now,
      },
    );
  });
  return s;
}

async function db(): Promise<Store> {
  if (store) return store;
  seeding ??= seed();
  store = await seeding;
  return store;
}

function orgOf(s: Store, id: string): OrganizationRef {
  const org = s.orgs.find((o) => o.id === id);
  if (!org) throw new ApiError(422, "E_VALIDATION", "Client inconnu.");
  return org;
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.unshift(item);
}

const scoped = <T extends { organizationId: string }>(rows: T[], organizationId?: string) =>
  rows.filter((r) => !organizationId || r.organizationId === organizationId);

export const clientRulesService = {
  // ── Zones ──────────────────────────────────────────────────────────────────
  async listGeofences(organizationId?: string): Promise<Geofence[]> {
    await mockDelay();
    return mockClone(scoped((await db()).geofences, organizationId));
  },
  async saveGeofence(payload: GeofencePayload, id?: string): Promise<Geofence> {
    await mockDelay();
    const s = await db();
    if (!payload.name.trim()) throw new ApiError(422, "E_VALIDATION", "Nom de la zone obligatoire.");
    if (payload.shape === "circle" && (!payload.center || !payload.radiusM || payload.radiusM < 50)) {
      throw new ApiError(422, "E_VALIDATION", "Cercle : placez le centre sur la carte, rayon de 50 m minimum.");
    }
    if (payload.shape === "polygon" && payload.points.length < 3) {
      throw new ApiError(422, "E_VALIDATION", "Polygone : cliquez au moins 3 sommets sur la carte.");
    }
    if (!payload.alertOnEntry && !payload.alertOnExit) {
      throw new ApiError(422, "E_VALIDATION", "Choisissez au moins une alerte (entrée ou sortie).");
    }
    const zone: Geofence = {
      ...payload,
      id: id ?? mockId(),
      organization: orgOf(s, payload.organizationId),
      updatedAt: mockNow(),
    };
    upsert(s.geofences, zone);
    return mockClone(zone);
  },

  // ── Vitesse ────────────────────────────────────────────────────────────────
  async listSpeedPolicies(organizationId?: string): Promise<SpeedPolicy[]> {
    await mockDelay();
    return mockClone(scoped((await db()).policies, organizationId));
  },
  async saveSpeedPolicy(payload: SpeedPolicyPayload, id?: string): Promise<SpeedPolicy> {
    await mockDelay();
    const s = await db();
    if (!payload.name.trim()) throw new ApiError(422, "E_VALIDATION", "Nom obligatoire.");
    if (payload.limitKph < 5 || payload.limitKph > 200)
      throw new ApiError(422, "E_VALIDATION", "Limite entre 5 et 200 km/h.");
    if (payload.scope === "zone") {
      const zone = s.geofences.find((z) => z.id === payload.zoneId);
      if (!zone || zone.organizationId !== payload.organizationId) {
        throw new ApiError(422, "E_VALIDATION", "Choisissez une zone de ce client.");
      }
    }
    if (payload.scope === "vehicle" && payload.vehicleIds.length === 0) {
      throw new ApiError(422, "E_VALIDATION", "Choisissez au moins un véhicule.");
    }
    const policy: SpeedPolicy = {
      ...payload,
      zoneId: payload.scope === "zone" ? payload.zoneId : null,
      vehicleIds: payload.scope === "vehicle" ? payload.vehicleIds : [],
      id: id ?? mockId(),
      organization: orgOf(s, payload.organizationId),
      updatedAt: mockNow(),
    };
    upsert(s.policies, policy);
    return mockClone(policy);
  },

  // ── Règles ─────────────────────────────────────────────────────────────────
  async listRules(organizationId?: string): Promise<Rule[]> {
    await mockDelay();
    return mockClone(scoped((await db()).rules, organizationId));
  },
  async saveRule(payload: RulePayload, id?: string): Promise<Rule> {
    await mockDelay();
    const s = await db();
    if (!payload.name.trim()) throw new ApiError(422, "E_VALIDATION", "Nom de la règle obligatoire.");
    if (payload.actions.length === 0) throw new ApiError(422, "E_VALIDATION", "Ajoutez au moins une action.");
    if (payload.conditions.some((c) => !c.value.trim())) {
      throw new ApiError(422, "E_VALIDATION", "Chaque condition doit avoir une valeur.");
    }
    const existing = s.rules.find((r) => r.id === id);
    const rule: Rule = {
      ...payload,
      id: id ?? mockId(),
      organization: orgOf(s, payload.organizationId),
      triggerCount: existing?.triggerCount ?? 0,
      lastTriggeredAt: existing?.lastTriggeredAt ?? null,
      updatedAt: mockNow(),
    };
    upsert(s.rules, rule);
    return mockClone(rule);
  },

  /** Active / désactive une zone, une politique ou une règle (jamais de suppression). */
  async toggle(kind: "geofence" | "speed" | "rule", id: string, active: boolean): Promise<void> {
    await mockDelay(200);
    const s = await db();
    const list = kind === "geofence" ? s.geofences : kind === "speed" ? s.policies : s.rules;
    const item = list.find((x) => x.id === id);
    if (!item) throw new ApiError(404, "E_NOT_FOUND", "Élément introuvable.");
    item.active = active;
    item.updatedAt = mockNow();
  },
};
