/**
 * Modèle de permissions — référentiel des habilitations SISBM (10 codes).
 *
 * Chaque fonctionnalité (et sous-fonctionnalité d'offre) reçoit indépendamment ces actions.
 * Principe du moindre privilège : rien n'est accordé par défaut, on attribue opération par opération.
 *
 * L'API actuelle utilise un modèle plus grossier (`ressource:read|write|…`) :
 * `role-admin.service.ts` traduit l'un vers l'autre en attendant que le backend adopte ces clés.
 */

export const PERMISSION_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "export",
  "validate",
  "execute",
  "assign",
  "emit",
  "escalate",
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const permissionActionLabels: Record<PermissionAction, string> = {
  read: "Consultation",
  create: "Création",
  update: "Modification",
  delete: "Suppression / désactivation",
  export: "Exportation",
  validate: "Validation",
  execute: "Exécution de commande",
  assign: "Affectation",
  emit: "Émission / envoi",
  escalate: "Escalade / clôture",
};

/** Codes courts du référentiel, affichés dans les en-têtes de la matrice. */
export const permissionActionCodes: Record<PermissionAction, string> = {
  read: "CONS",
  create: "CREA",
  update: "MOD",
  delete: "SUP",
  export: "EXP",
  validate: "VAL",
  execute: "EXEC",
  assign: "ASS",
  emit: "EMI",
  escalate: "ESC",
};

/** Définition / usage de chaque code (infobulle de la matrice). */
export const permissionActionHints: Record<PermissionAction, string> = {
  read: "Voir une liste, une fiche, un détail ou un indicateur sans modifier les données.",
  create: "Créer un objet métier : client, facture, règle, incident, planning…",
  update: "Modifier les champs ou paramètres d'un objet existant.",
  delete: "Supprimer ou désactiver un objet quand les règles métier l'autorisent (désactivation et historisation privilégiées).",
  export: "Exporter des données ou rapports (PDF, Excel).",
  validate: "Valider une opération lorsqu'un processus prévoit une validation distincte.",
  execute: "Déclencher une action opérationnelle ou une commande GPS (arrêt moteur, limiteur).",
  assign: "Assigner un responsable, un rôle, un véhicule, un conducteur, une zone ou un planning.",
  emit: "Émettre une facture, envoyer un e-mail ou un SMS, déclencher une relance.",
  escalate: "Escalader, résoudre, clôturer ou rouvrir un incident selon habilitation.",
};

export interface PermissionModule {
  key: string;
  label: string;
  /** Module du menu principal auquel la ligne se rattache. */
  group: string;
  /**
   * Module du catalogue des fonctionnalités d'offre (`OfferFeature.module`) qui pilote cette ligne :
   *  - plusieurs fonctionnalités → elles deviennent des SOUS-LIGNES de permission ;
   *  - une seule → la ligne n'est proposée que si l'offre du client l'inclut.
   */
  featureModule?: string;
  /** Module réservé aux collaborateurs SISBM : jamais proposé à un utilisateur client. */
  platformOnly?: boolean;
}

/** Lignes de la matrice, regroupées comme le menu principal. */
export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "dashboard", label: "Tableau de bord", group: "Pilotage" },
  { key: "report", label: "Rapports et exports", group: "Pilotage", featureModule: "Rapports" },
  { key: "invoice", label: "Factures", group: "Facturation", platformOnly: true },
  { key: "payment", label: "Paiements et relances", group: "Facturation", platformOnly: true },
  { key: "offer", label: "Catalogue des offres", group: "Offres & Clients", platformOnly: true },
  { key: "organization", label: "Clients", group: "Offres & Clients", platformOnly: true },
  { key: "supervision", label: "Supervision", group: "Offres & Clients", featureModule: "Supervision" },
  { key: "subscription", label: "Souscriptions", group: "Offres & Clients", platformOnly: true },
  { key: "vehicle", label: "Véhicules", group: "Offres & Clients" },
  { key: "device", label: "Trackers", group: "Rubriques client" },
  { key: "schedule", label: "Horaires", group: "Rubriques client", featureModule: "Horaires" },
  { key: "geofence", label: "Zones géographiques", group: "Rubriques client", featureModule: "Zones" },
  { key: "speed", label: "Contrôle de vitesse", group: "Rubriques client", featureModule: "Contrôle de vitesse" },
  { key: "rule", label: "Moteur de règles", group: "Rubriques client", featureModule: "Moteur de règles" },
  { key: "driver", label: "Conducteurs", group: "Rubriques client", featureModule: "Conducteurs" },
  { key: "command", label: "Commandes boîtier", group: "Rubriques client" },
  { key: "alert", label: "Alertes", group: "Alertes & Notifications" },
  {
    key: "notification",
    label: "Notifications et SMS",
    group: "Alertes & Notifications",
    featureModule: "Alertes & notifications",
  },
  { key: "incident", label: "Incidents", group: "Gestion des incidents", featureModule: "Incidents" },
  { key: "user", label: "Utilisateurs", group: "Administration" },
  { key: "role", label: "Rôles et permissions", group: "Administration", platformOnly: true },
  { key: "audit", label: "Journal d'audit", group: "Administration" },
  { key: "settings", label: "Paramètres", group: "Paramètres", platformOnly: true },
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
