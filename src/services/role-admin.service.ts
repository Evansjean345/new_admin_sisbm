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
  write: ["create", "update", "delete"],
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
      .filter(([k]) => known.has(k))
      .map(([k, actions]) => [k, ALL_ACTIONS.filter((a) => actions.includes(a))])
      .filter(([, actions]) => actions.length > 0),
  );
}

const custom: RoleDefinition[] = [];

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
