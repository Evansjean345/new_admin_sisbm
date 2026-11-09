/**
 * Modèle de permissions des spécifications SuperAdmin (§VI.2, écran 4) :
 * pour chaque module, 7 actions autorisables indépendamment.
 *
 * L'API actuelle utilise un modèle plus grossier (`ressource:read|write|…`) :
 * `role-admin.service.ts` traduit l'un vers l'autre en attendant que le backend
 * adopte ces clés.
 */

export const PERMISSION_ACTIONS = ["read", "create", "update", "delete", "export", "validate", "execute"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const permissionActionLabels: Record<PermissionAction, string> = {
  read: "Consultation",
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  export: "Exportation",
  validate: "Validation",
  execute: "Exécution de commande",
};

export interface PermissionModule {
  key: string;
  label: string;
  /** Module du menu principal auquel la ligne se rattache. */
  group: string;
}

/** Lignes de la matrice, regroupées comme le menu principal. */
export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "dashboard", label: "Tableau de bord", group: "Pilotage" },
  { key: "report", label: "Rapports et exports", group: "Pilotage" },
  { key: "invoice", label: "Factures", group: "Facturation" },
  { key: "payment", label: "Paiements et relances", group: "Facturation" },
  { key: "offer", label: "Catalogue des offres", group: "Offres & Clients" },
  { key: "organization", label: "Clients", group: "Offres & Clients" },
  { key: "subscription", label: "Souscriptions", group: "Offres & Clients" },
  { key: "vehicle", label: "Véhicules", group: "Offres & Clients" },
  { key: "device", label: "Trackers", group: "Rubriques client" },
  { key: "supervision", label: "Supervision", group: "Rubriques client" },
  { key: "schedule", label: "Horaires", group: "Rubriques client" },
  { key: "geofence", label: "Zones géographiques", group: "Rubriques client" },
  { key: "speed", label: "Contrôle de vitesse", group: "Rubriques client" },
  { key: "rule", label: "Moteur de règles", group: "Rubriques client" },
  { key: "driver", label: "Conducteurs", group: "Rubriques client" },
  { key: "command", label: "Commandes boîtier", group: "Rubriques client" },
  { key: "alert", label: "Alertes", group: "Alertes & Notifications" },
  { key: "notification", label: "Notifications et SMS", group: "Alertes & Notifications" },
  { key: "incident", label: "Incidents", group: "Gestion des incidents" },
  { key: "user", label: "Utilisateurs", group: "Administration" },
  { key: "role", label: "Rôles et permissions", group: "Administration" },
  { key: "audit", label: "Journal d'audit", group: "Administration" },
  { key: "settings", label: "Paramètres", group: "Paramètres" },
];

/** Plateforme = collaborateurs SISBM ; client = utilisateurs d'un tenant client. */
export const ROLE_SCOPES = ["platform", "client"] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];

export const roleScopeLabels: Record<RoleScope, string> = {
  platform: "Plateforme SISBM",
  client: "Client",
};

/** Actions accordées, par clé de module. Module absent = aucun accès. */
export type PermissionGrants = Record<string, PermissionAction[]>;

export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: RoleScope;
  /** Rôle fourni par la plateforme (API) : non modifiable ici, duplicable. */
  isSystem: boolean;
  grants: PermissionGrants;
  /** Permissions brutes de l'API, pour les rôles système. */
  apiPermissions: string[];
  updatedAt: string | null;
}

export interface RoleDefinitionPayload {
  code: string;
  name: string;
  description?: string;
  scope: RoleScope;
  grants: PermissionGrants;
}
