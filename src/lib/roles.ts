/**
 * Libellés métier des rôles système (retour de la direction, 12/11/2026) :
 *  - « Administrateur » (code `admin`)  → « Distributeur » ;
 *  - « Opérateur »      (code `operator`) → « Client final ».
 *
 * Seul le LIBELLÉ change : les codes restent ceux de l'API. Le renommage est appliqué
 * dans les services, à la lecture, pour que tous les écrans l'affichent sans exception.
 * À retirer quand l'API renverra elle-même ces noms.
 */
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: "Distributeur",
  operator: "Client final",
};

export const ROLE_DISPLAY_DESCRIPTIONS: Record<string, string> = {
  admin: "Distributeur : gère ses clients finaux, leurs utilisateurs et leurs véhicules.",
  operator: "Client final : utilise les fonctionnalités de l'offre souscrite.",
};

/** Remplace le nom (et la description) d'un rôle système par son libellé métier. */
export function withRoleDisplayName<T extends { code: string; name: string; description?: string | null }>(role: T): T;
export function withRoleDisplayName<T extends { code: string; name: string; description?: string | null }>(
  role: T | null | undefined,
): T | null | undefined;
export function withRoleDisplayName<T extends { code: string; name: string; description?: string | null }>(
  role: T | null | undefined,
): T | null | undefined {
  if (!role) return role;
  const name = ROLE_DISPLAY_NAMES[role.code];
  if (!name) return role;
  const description = ROLE_DISPLAY_DESCRIPTIONS[role.code];
  return { ...role, name, ...("description" in role && description ? { description } : {}) };
}
