import type { OfferFeature } from "@/types/offer";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionGrants,
  type PermissionModule,
} from "@/types/permission";

/**
 * Arborescence de la matrice de permissions.
 *
 * Retour de la direction (12/11/2026) :
 *  - toute fonctionnalité qui a des sous-fonctionnalités les montre dans l'édition des permissions ;
 *  - pour un utilisateur client, seules les fonctionnalités de l'offre souscrite sont proposées.
 *
 * Les sous-fonctionnalités viennent du catalogue des offres (`OfferFeature`), pas d'une liste
 * codée en dur : une fonctionnalité ajoutée au catalogue apparaît d'elle-même dans la matrice.
 * Une permission de sous-fonctionnalité a pour clé celle de la fonctionnalité (ex. `supervision.replay`).
 */

export interface PermissionRow {
  key: string;
  label: string;
  description: string | null;
  requiresHardware: boolean;
}

export interface PermissionModuleNode extends PermissionRow {
  module: PermissionModule;
  /** Sous-fonctionnalités : vide = ligne simple. */
  children: PermissionRow[];
}

export interface PermissionGroupNode {
  group: string;
  modules: PermissionModuleNode[];
}

export interface PermissionTreeOptions {
  /**
   * Fonctionnalités incluses dans l'offre du client. `null` = pas de filtre (rôle générique,
   * collaborateur SISBM).
   */
  allowedFeatureKeys?: ReadonlySet<string> | null;
  /** Masque les modules réservés aux collaborateurs SISBM. */
  clientOnly?: boolean;
}

export function buildPermissionTree(
  features: OfferFeature[],
  { allowedFeatureKeys = null, clientOnly = false }: PermissionTreeOptions = {},
): PermissionGroupNode[] {
  const allowed = (key: string) => !allowedFeatureKeys || allowedFeatureKeys.has(key);
  const groups: PermissionGroupNode[] = [];

  for (const module of PERMISSION_MODULES) {
    if (clientOnly && module.platformOnly) continue;
    const linked = module.featureModule ? features.filter((f) => f.module === module.featureModule) : [];
    let children: PermissionRow[] = [];

    if (linked.length >= 2) {
      children = linked
        .filter((f) => allowed(f.key))
        .map((f) => ({ key: f.key, label: f.label, description: f.description, requiresHardware: f.requiresHardware }));
      if (children.length === 0) continue;
    } else if (linked.length === 1 && !allowed(linked[0].key)) {
      continue;
    }

    const node: PermissionModuleNode = {
      key: module.key,
      label: module.label,
      description: linked.length === 1 ? linked[0].description : null,
      requiresHardware: linked.length === 1 && linked[0].requiresHardware,
      module,
      children,
    };
    const last = groups.at(-1);
    if (last?.group === module.group) last.modules.push(node);
    else groups.push({ group: module.group, modules: [node] });
  }
  return groups;
}

/** Clés réellement éditables (lignes simples et sous-fonctionnalités). */
export function editableKeys(tree: PermissionGroupNode[]): string[] {
  return tree.flatMap((g) =>
    g.modules.flatMap((m) => (m.children.length > 0 ? m.children.map((c) => c.key) : [m.key])),
  );
}

/**
 * Ramène des droits au niveau de la matrice affichée :
 *  - un droit posé sur un module à sous-fonctionnalités est recopié sur chacune d'elles ;
 *  - les clés hors matrice (fonctionnalité absente de l'offre, module réservé) sont retirées.
 */
export function normalizeGrants(grants: PermissionGrants, tree: PermissionGroupNode[]): PermissionGrants {
  const next: Record<string, Set<PermissionAction>> = {};
  const add = (key: string, actions: PermissionAction[] | undefined) => {
    if (!actions?.length) return;
    next[key] ??= new Set();
    for (const a of actions) next[key].add(a);
  };
  for (const group of tree) {
    for (const m of group.modules) {
      if (m.children.length === 0) add(m.key, grants[m.key]);
      else for (const c of m.children) add(c.key, [...(grants[m.key] ?? []), ...(grants[c.key] ?? [])]);
    }
  }
  return Object.fromEntries(Object.entries(next).map(([k, set]) => [k, PERMISSION_ACTIONS.filter((a) => set.has(a))]));
}

/** Toutes les actions sur toutes les lignes de la matrice. */
export function fullGrants(tree: PermissionGroupNode[]): PermissionGrants {
  return Object.fromEntries(editableKeys(tree).map((k) => [k, [...PERMISSION_ACTIONS]]));
}

/** Nombre de lignes accessibles et d'autorisations accordées, pour les résumés. */
export function grantSummary(grants: PermissionGrants): { modules: number; actions: number } {
  const values = Object.values(grants);
  return { modules: values.filter((v) => v.length > 0).length, actions: values.reduce((n, v) => n + v.length, 0) };
}
