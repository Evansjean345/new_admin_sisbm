import { mockClone, mockDelay, mockId, mockNow } from "@/lib/mock";
import { SEVERITIES } from "@/types/alerting";
import { ApiError } from "@/types/api";
import type { OrganizationRef } from "@/types/billing";
import {
  getRuleNotificationChannels,
  getRuleFieldsForEvent,
  RULE_OPERATORS_BY_FIELD,
  type Geofence,
  type GeofencePayload,
  type Rule,
  type RulePayload,
  type SpeedPolicy,
  type SpeedPolicyPayload,
} from "@/types/client-rules";

import { vehicleGroupService } from "./group.service";
import { organizationService } from "./organization.service";
import { scheduleService } from "./schedule.service";
import { vehicleService } from "./vehicle.service";

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
    const globalPolicy: SpeedPolicy = {
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
    };
    s.policies.push(
      globalPolicy,
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
        description: "Alerte lorsque la politique de vitesse générale est dépassée.",
        trigger: "overspeed",
        conditions: [
          {
            id: mockId(),
            field: "speed_policy",
            operator: "eq",
            value: globalPolicy.id,
            valueLabel: globalPolicy.name,
            target: { type: "all" },
          },
        ],
        actions: [
          { id: mockId(), type: "alert", value: "high" },
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
        name: "Sortie du dépôt",
        description: "Incident Sécurité / SOC si un véhicule quitte le dépôt.",
        trigger: "geofence_exit",
        conditions: [
          {
            id: mockId(),
            field: "zone",
            operator: "eq",
            value: depot.id,
            valueLabel: depot.name,
            target: { type: "all" },
          },
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
    const organization = orgOf(s, payload.organizationId);
    const actions = payload.actions.map((action) =>
      action.type === "notify"
        ? { ...action, channels: getRuleNotificationChannels(payload.trigger, action.channels) }
        : action,
    );
    if (actions.length === 0) throw new ApiError(422, "E_VALIDATION", "Ajoutez au moins une action.");
    if (actions.some((action) => action.type !== "alert" && action.type !== "notify" && !action.value.trim())) {
      throw new ApiError(422, "E_VALIDATION", "Renseignez le paramètre de chaque action.");
    }
    if (
      payload.conditions.some((condition) =>
        condition.field === "zone" && payload.trigger === "geofence_exit"
          ? !(condition.values?.length || condition.value.trim())
          : !condition.value.trim(),
      )
    ) {
      throw new ApiError(422, "E_VALIDATION", "Chaque condition doit avoir une valeur.");
    }
    const allowedFields = getRuleFieldsForEvent(payload.trigger);
    if (payload.conditions.some((c) => !allowedFields.includes(c.field))) {
      throw new ApiError(422, "E_VALIDATION", "Une condition ne correspond pas à l'événement sélectionné.");
    }
    if (payload.conditions.some((c) => !RULE_OPERATORS_BY_FIELD[c.field].includes(c.operator))) {
      throw new ApiError(422, "E_VALIDATION", "Un opérateur ne correspond pas au type de condition.");
    }
    const scheduleIds = new Set<string>();
    const vehicleIds = new Set<string>();
    const fleetIds = new Set<string>();
    for (const condition of payload.conditions) {
      if (condition.field === "speed_policy") {
        const policy = s.policies.find(
          (item) => item.id === condition.value && item.organizationId === payload.organizationId && item.active,
        );
        if (!policy) throw new ApiError(422, "E_VALIDATION", "Choisissez une politique de vitesse active de ce client.");
      }
      if (condition.field === "zone") {
        const zoneIds =
          payload.trigger === "geofence_exit"
            ? [...new Set(condition.values?.length ? condition.values : condition.value ? [condition.value] : [])]
            : [condition.value];
        if (zoneIds.length === 0) {
          throw new ApiError(422, "E_VALIDATION", "Choisissez au moins une zone de sortie.");
        }
        for (const zoneId of zoneIds) {
          const geofence = s.geofences.find(
            (item) =>
              item.id === zoneId &&
              item.organizationId === payload.organizationId &&
              item.active &&
              (payload.trigger === "geofence_exit"
                ? item.alertOnExit
                : payload.trigger === "geofence_entry"
                  ? item.alertOnEntry
                  : true),
          );
          if (!geofence) {
            throw new ApiError(
              422,
              "E_VALIDATION",
              "Chaque zone choisie doit être active et configurée pour l'événement.",
            );
          }
        }
      }
      if (condition.field === "schedule") scheduleIds.add(condition.value);
      if (condition.target?.type === "vehicle") {
        if (!condition.target.id) throw new ApiError(422, "E_VALIDATION", "Choisissez le véhicule de la condition.");
        vehicleIds.add(condition.target.id);
      }
      if (condition.target?.type === "fleet") {
        if (!condition.target.id) throw new ApiError(422, "E_VALIDATION", "Choisissez la flotte de la condition.");
        fleetIds.add(condition.target.id);
      }
    }
    const [schedulesPage, vehiclesPage, fleetsPage] = await Promise.all([
      scheduleIds.size
        ? scheduleService.list({ organizationId: payload.organizationId, isActive: true, page: 1, perPage: 100 })
        : null,
      vehicleIds.size
        ? vehicleService.list({ organizationId: payload.organizationId, status: "active", page: 1, perPage: 100 })
        : null,
      fleetIds.size
        ? vehicleGroupService.list({ organizationId: payload.organizationId, page: 1, perPage: 100 })
        : null,
    ]);
    const schedulesById = new Map(
      (schedulesPage?.data ?? [])
        .filter((schedule) => schedule.organizationId === payload.organizationId && schedule.isActive)
        .map((schedule) => [schedule.id, schedule]),
    );
    const vehiclesById = new Map(
      (vehiclesPage?.data ?? [])
        .filter((vehicle) => vehicle.organizationId === payload.organizationId && vehicle.status === "active")
        .map((vehicle) => [vehicle.id, vehicle]),
    );
    const fleetsById = new Map(
      (fleetsPage?.data ?? [])
        .filter((fleet) => fleet.organizationId === payload.organizationId)
        .map((fleet) => [fleet.id, fleet]),
    );
    if ([...scheduleIds].some((scheduleId) => !schedulesById.has(scheduleId))) {
      throw new ApiError(422, "E_VALIDATION", "Choisissez un calendrier actif de ce client.");
    }
    if ([...vehicleIds].some((vehicleId) => !vehiclesById.has(vehicleId))) {
      throw new ApiError(422, "E_VALIDATION", "Le véhicule choisi n'est pas actif ou n'appartient pas à ce client.");
    }
    if ([...fleetIds].some((fleetId) => !fleetsById.has(fleetId))) {
      throw new ApiError(422, "E_VALIDATION", "La flotte choisie n'appartient pas à ce client.");
    }
    const conditions = payload.conditions.map((condition) => {
      const target = condition.target ?? { type: "all" as const };
      const zoneIds =
        condition.field === "zone" && payload.trigger === "geofence_exit"
          ? [...new Set(condition.values?.length ? condition.values : condition.value ? [condition.value] : [])]
          : [];
      const zones = zoneIds
        .map((zoneId) => s.geofences.find((geofence) => geofence.id === zoneId))
        .filter((zone): zone is Geofence => zone !== undefined);
      const configuredLabel =
        condition.field === "speed_policy"
          ? s.policies.find((policy) => policy.id === condition.value)?.name
          : condition.field === "zone" && payload.trigger !== "geofence_exit"
            ? s.geofences.find((geofence) => geofence.id === condition.value)?.name
            : condition.field === "schedule"
              ? schedulesById.get(condition.value)?.name
              : undefined;
      return {
        ...condition,
        ...(condition.field === "zone" && payload.trigger === "geofence_exit"
          ? {
              value: zoneIds[0] ?? "",
              values: zoneIds,
              valueLabels: zones.map((zone) => zone.name),
              valueLabel: zones[0]?.name,
            }
          : {}),
        ...(condition.field === "zone" && payload.trigger !== "geofence_exit"
          ? { values: undefined, valueLabels: undefined }
          : {}),
        valueLabel: configuredLabel ?? condition.valueLabel,
        target:
          target.type === "vehicle"
            ? { ...target, label: vehiclesById.get(target.id)?.registration ?? target.label }
            : target.type === "fleet"
              ? { ...target, label: fleetsById.get(target.id)?.name ?? target.label }
              : target,
      };
    });
    if (
      payload.conditions.some(
        (c) =>
          (c.field === "speed" || c.field === "duration") &&
          (!Number.isFinite(Number(c.value)) || Number(c.value) < 0),
      )
    ) {
      throw new ApiError(422, "E_VALIDATION", "La vitesse et la durée doivent être supérieures ou égales à zéro.");
    }
    if (
      payload.conditions.some(
        (c) =>
          c.field === "time" &&
          !/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(c.value),
      )
    ) {
      throw new ApiError(422, "E_VALIDATION", "Indiquez une plage horaire valide (HH:MM-HH:MM).");
    }
    if (payload.actions.some((a) => a.type === "alert" && !SEVERITIES.some((severity) => severity === a.value))) {
      throw new ApiError(422, "E_VALIDATION", "Choisissez une gravité valide pour chaque alerte.");
    }
    const existing = s.rules.find((r) => r.id === id);
    const rule: Rule = {
      ...payload,
      conditions,
      actions,
      id: id ?? mockId(),
      organization,
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
