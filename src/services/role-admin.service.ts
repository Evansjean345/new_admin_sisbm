import { mockClone, mockDelay, mockId, mockNow } from "@/lib/mock";
import { ApiError } from "@/types/api";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionGrants,
  type RoleDefinition,
  type RoleDefinitionPayload,
} from "@/types/permission";
import type { Role } from "@/types/role";

import { roleService } from "./role.service";

/**
 * Rôles et permissions (§VI.2, écrans 3 et 4) — SERVICE EN PARTIE SIMULÉ.
 *
 * - Rôles système : lus sur la VRAIE API (`GET /roles`), traduits dans le modèle
 *   module × 7 actions, non modifiables ici.
 * - Rôles personnalisés : simulés en mémoire. Routes attendues : POST /admin/roles,
 *   PATCH /admin/roles/:id, DELETE /admin/roles/:id, avec des permissions au format
 *   `module:action` (ex. `invoice:validate`).
 *
 * Le serveur devra aussi empêcher un utilisateur de s'accorder des privilèges
 * supplémentaires (§VI.4) : ce contrôle ne peut pas vivre dans l'interface.
 */

/** Ressources de l'API actuelle → module de la matrice. */
const API_RESOURCE_TO_MODULE: Record<string, string> = {
  vehicle: "vehicle",
  device: "device",
  user: "user",
  geofence: "geofence",
  policy: "schedule",
  alert: "alert",
  incident: "incident",
  report: "report",
  command: "command",
  audit: "audit",
};

/** Actions de l'API actuelle → actions du modèle des spécifications. */
const API_ACTION_TO_ACTIONS: Record<string, PermissionAction[]> = {
  read: ["read"],
  write: ["create", "update", "delete", "assign"],
  sensitive: ["execute"],
  immobilize: ["execute"],
};

const ALL_ACTIONS = [...PERMISSION_ACTIONS];

function translate(permissions: string[]): PermissionGrants {
  if (permissions.includes("*")) {
    return Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, [...ALL_ACTIONS]]));
  }
  const grants: Record<string, Set<PermissionAction>> = {};
  for (const permission of permissions) {
    const [resource, action] = permission.split(":");
    const module = API_RESOURCE_TO_MODULE[resource];
    if (!module) continue;
    grants[module] ??= new Set();
    const actions = action === "*" ? ALL_ACTIONS : (API_ACTION_TO_ACTIONS[action] ?? []);
    for (const a of actions) grants[module].add(a);
  }
  return Object.fromEntries(Object.entries(grants).map(([k, set]) => [k, ALL_ACTIONS.filter((a) => set.has(a))]));
}

function fromApi(role: Role): RoleDefinition {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    scope: role.code === "super_admin" ? "platform" : "client",
    isSystem: true,
    grants: translate(role.permissions),
    apiPermissions: role.permissions,
    updatedAt: null,
  };
}

/** Ne garde que les modules et actions connus, sans doublon ni module vide. */
function clean(grants: PermissionGrants): PermissionGrants {
  const known = new Set(PERMISSION_MODULES.map((m) => m.key));
  return Object.fromEntries(
    Object.entries(grants)
      // Clé de module, ou clé de sous-fonctionnalité d'offre (« supervision.replay »).
      .filter(([k]) => known.has(k) || k.includes("."))
      .map(([k, actions]) => [k, ALL_ACTIONS.filter((a) => actions.includes(a))])
      .filter(([, actions]) => actions.length > 0),
  );
}

type A = PermissionAction;
const R: A[] = ["read"];
const RE: A[] = ["read", "export"];
const RW: A[] = ["read", "create", "update", "export"];
const RWD: A[] = ["read", "create", "update", "delete", "export", "assign"];

/**
 * Rôles initiaux proposés par les spécifications (§VI.2, écran 3) et absents des rôles système de
 * l'API. Ils sont personnalisables (modifiables, duplicables, supprimables). Les permissions sont une
 * proposition de départ, à ajuster par SISBM — moindre privilège : rien de plus que nécessaire.
 */
function proposed(
  code: string,
  name: string,
  description: string,
  scope: RoleDefinition["scope"],
  grants: PermissionGrants,
): RoleDefinition {
  return {
    id: `proposed-${code}`,
    code,
    name,
    description,
    scope,
    isSystem: false,
    grants,
    apiPermissions: [],
    updatedAt: null,
  };
}

const custom: RoleDefinition[] = [
  proposed(
    "sisbm_admin",
    "Administrateur SISBM",
    "Gestion commerciale, facturation et administration, sans les paramètres techniques.",
    "platform",
    {
      dashboard: RE,
      report: RE,
      invoice: [...RWD, "validate", "emit"],
      payment: [...RWD, "validate", "emit"],
      offer: RWD,
      organization: RWD,
      subscription: [...RWD, "validate"],
      vehicle: RWD,
      supervision: R,
      alert: [...RW, "assign"],
      notification: [...RW, "emit"],
      incident: [...RW, "assign", "escalate"],
      user: RWD,
      role: R,
      audit: RE,
      settings: R,
    },
  ),
  proposed(
    "support_tech",
    "Support technique",
    "Diagnostic des boîtiers, supervision et traitement des incidents.",
    "platform",
    {
      dashboard: R,
      vehicle: R,
      device: [...RW, "execute"],
      supervision: R,
      command: ["read", "execute"],
      alert: [...R, "assign"],
      incident: [...RW, "assign", "escalate"],
      audit: R,
      settings: R,
    },
  ),
  proposed(
    "fleet_manager",
    "Gestionnaire de flotte client",
    "Gère la flotte de son organisation : véhicules, conducteurs, horaires, zones et règles.",
    "client",
    {
      dashboard: RE,
      report: RE,
      vehicle: RW,
      supervision: RE,
      device: R,
      schedule: [...RWD],
      geofence: [...RWD],
      speed: RW,
      rule: RW,
      driver: [...RWD],
      command: ["read", "execute"],
      alert: [...R, "assign"],
      notification: RW,
      incident: [...RW, "assign"],
      user: R,
    },
  ),
  proposed(
    "client_supervisor",
    "Superviseur client",
    "Surveille la flotte en temps réel et traite les alertes, sans modifier la configuration.",
    "client",
    {
      dashboard: R,
      report: RE,
      vehicle: R,
      supervision: RE,
      schedule: R,
      geofence: R,
      speed: R,
      driver: R,
      alert: [...R, "assign"],
      incident: ["read", "create"],
    },
  ),
  proposed("client_viewer", "Consultation client", "Lecture seule des données de son organisation.", "client", {
    dashboard: R,
    report: R,
    vehicle: R,
    supervision: R,
    schedule: R,
    geofence: R,
    speed: R,
    driver: R,
    alert: R,
  }),
];

async function all(): Promise<RoleDefinition[]> {
  const system = (await roleService.list()).map(fromApi);
  return [...system, ...custom];
}

function assertCodeFree(code: string, roles: RoleDefinition[], exceptId?: string) {
  if (roles.some((r) => r.code === code && r.id !== exceptId)) {
    throw new ApiError(409, "E_ROLE_CODE_TAKEN", `Le code « ${code} » est déjà utilisé.`);
  }
}

export const roleAdminService = {
  /** GET /admin/roles — rôles système puis personnalisés. */
  async list(): Promise<RoleDefinition[]> {
    return mockClone(await all());
  },

  /** POST /admin/roles */
  async create(payload: RoleDefinitionPayload): Promise<RoleDefinition> {
    await mockDelay();
    const code = payload.code.trim().toLowerCase();
    assertCodeFree(code, await all());
    const role: RoleDefinition = {
      id: mockId(),
      code,
      name: payload.name,
      description: payload.description ?? null,
      scope: payload.scope,
      isSystem: false,
      grants: clean(payload.grants),
      apiPermissions: [],
      updatedAt: mockNow(),
    };
    custom.push(role);
    return mockClone(role);
  },

  /** PATCH /admin/roles/:id — refusé (403) sur un rôle système. */
  async update(id: string, payload: Partial<RoleDefinitionPayload>): Promise<RoleDefinition> {
    await mockDelay();
    const role = custom.find((r) => r.id === id);
    if (!role) {
      throw new ApiError(403, "E_SYSTEM_ROLE", "Les rôles système ne sont pas modifiables : dupliquez-le.");
    }
    if (payload.code) {
      const code = payload.code.trim().toLowerCase();
      assertCodeFree(code, await all(), id);
      role.code = code;
    }
    if (payload.name !== undefined) role.name = payload.name;
    if (payload.description !== undefined) role.description = payload.description === "" ? null : payload.description;
    if (payload.scope) role.scope = payload.scope;
    if (payload.grants) role.grants = clean(payload.grants);
    role.updatedAt = mockNow();
    return mockClone(role);
  },

  /** DELETE /admin/roles/:id — refusé (409) si des utilisateurs portent encore le rôle. */
  async remove(id: string): Promise<void> {
    await mockDelay();
    const index = custom.findIndex((r) => r.id === id);
    if (index === -1) throw new ApiError(403, "E_SYSTEM_ROLE", "Les rôles système ne peuvent pas être supprimés.");
    custom.splice(index, 1);
  },
};
