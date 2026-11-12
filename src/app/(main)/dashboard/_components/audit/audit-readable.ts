import { formatDateTime } from "@/lib/format";
import { ROLE_DISPLAY_NAMES } from "@/lib/roles";
import type { AuditLogEntry } from "@/types/audit";

/**
 * Lecture « grand public » du journal d'audit : n'importe quel utilisateur, même non technique,
 * doit comprendre QUI a fait QUOI, sur QUEL élément, QUAND, et CE QUI A CHANGÉ.
 *
 * Les codes (`identity.user.created`, UUID, JSON) restent disponibles dans la section
 * « Détails techniques » de la fiche : ce sont les pièces d'audit, elles ne sont pas altérées.
 */

// ── Éléments concernés ───────────────────────────────────────────────────────

type Gender = "m" | "f";
interface ResourceWords {
  noun: string;
  gender: Gender;
  /** Commence par une voyelle : « l'utilisateur ». */
  elided?: boolean;
}

const RESOURCE_WORDS: Record<string, ResourceWords> = {
  organization: { noun: "organisation", gender: "f", elided: true },
  user: { noun: "utilisateur", gender: "m", elided: true },
  role: { noun: "rôle", gender: "m" },
  vehicle: { noun: "véhicule", gender: "m" },
  device: { noun: "boîtier GPS", gender: "m" },
  vehicle_group: { noun: "groupe de véhicules", gender: "m" },
  device_group: { noun: "lot de boîtiers", gender: "m" },
  driver: { noun: "conducteur", gender: "m" },
  driver_group: { noun: "équipe de conducteurs", gender: "f", elided: true },
  usage_schedule: { noun: "calendrier d'utilisation", gender: "m" },
  enforcement: { noun: "application d'horaire", gender: "f", elided: true },
  device_command: { noun: "commande boîtier", gender: "f" },
  geofence: { noun: "zone géographique", gender: "f" },
  policy: { noun: "règle", gender: "f" },
  alert: { noun: "alerte", gender: "f", elided: true },
  incident: { noun: "incident", gender: "m", elided: true },
  session: { noun: "session", gender: "f" },
};

function words(resourceType: string): ResourceWords {
  return RESOURCE_WORDS[resourceType] ?? { noun: resourceType.replaceAll("_", " "), gender: "m" };
}

/** « l'utilisateur », « le véhicule », « la commande boîtier ». */
function definite(w: ResourceWords): string {
  if (w.elided) return `l'${w.noun}`;
  return `${w.gender === "f" ? "la" : "le"} ${w.noun}`;
}

/** « un utilisateur », « une commande boîtier ». */
function indefinite(w: ResourceWords): string {
  return `${w.gender === "f" ? "une" : "un"} ${w.noun}`;
}

/** « d'un utilisateur », « d'une commande ». */
function ofIndefinite(w: ResourceWords): string {
  return `d'${indefinite(w)}`;
}

// ── Verbes ───────────────────────────────────────────────────────────────────

interface VerbWords {
  /** Nom d'action pour les titres : « Création ». */
  noun: string;
  /** Verbe conjugué pour la phrase : « a créé ». */
  phrase: string;
}

const VERB_WORDS: Record<string, VerbWords> = {
  created: { noun: "Création", phrase: "a créé" },
  updated: { noun: "Modification", phrase: "a modifié" },
  deleted: { noun: "Suppression", phrase: "a supprimé" },
  members_added: { noun: "Ajout de membres", phrase: "a ajouté des membres à" },
  members_removed: { noun: "Retrait de membres", phrase: "a retiré des membres de" },
  requested: { noun: "Demande", phrase: "a demandé" },
  approve: { noun: "Validation", phrase: "a validé" },
  approved: { noun: "Validation", phrase: "a validé" },
  rejected: { noun: "Refus", phrase: "a refusé" },
  queued: { noun: "Mise en attente d'envoi", phrase: "a mis en attente d'envoi" },
  sent: { noun: "Envoi", phrase: "a envoyé" },
  acknowledged: { noun: "Confirmation de réception", phrase: "a reçu la confirmation de" },
  failed: { noun: "Échec", phrase: "a constaté l'échec de" },
  expired: { noun: "Expiration", phrase: "a constaté l'expiration de" },
  assigned: { noun: "Affectation", phrase: "a affecté" },
  unassigned: { noun: "Retrait d'affectation", phrase: "a retiré l'affectation de" },
  login: { noun: "Connexion", phrase: "s'est connecté" },
  logout: { noun: "Déconnexion", phrase: "s'est déconnecté" },
  login_failed: { noun: "Échec de connexion", phrase: "a échoué à se connecter" },
  password_reset: { noun: "Réinitialisation du mot de passe", phrase: "a réinitialisé le mot de passe de" },
  suspended: { noun: "Suspension", phrase: "a suspendu" },
  activated: { noun: "Réactivation", phrase: "a réactivé" },
  cancelled: { noun: "Annulation", phrase: "a annulé" },
  organization_assigned: { noun: "Rattachement à une organisation", phrase: "a rattaché à une organisation" },
  organization_removed: { noun: "Retrait de l'organisation", phrase: "a retiré de son organisation" },
  vehicle_assigned: { noun: "Attribution d'un véhicule", phrase: "a attribué un véhicule à" },
  vehicle_unassigned: { noun: "Retrait du véhicule", phrase: "a retiré le véhicule de" },
  windows_replaced: { noun: "Modification des plages horaires", phrase: "a modifié les plages horaires de" },
  vehicles_attached: { noun: "Ajout de véhicules", phrase: "a ajouté des véhicules à" },
  vehicle_detached: { noun: "Retrait d'un véhicule", phrase: "a retiré un véhicule de" },
  groups_attached: { noun: "Ajout de groupes", phrase: "a ajouté des groupes à" },
  group_detached: { noun: "Retrait d'un groupe", phrase: "a retiré un groupe de" },
  dispatch: { noun: "Commande automatique", phrase: "a déclenché une commande pour" },
  completed: { noun: "Objectif atteint", phrase: "a terminé" },
  overridden: { noun: "Dérogation manuelle", phrase: "a forcé manuellement" },
  manual_cut_kept: { noun: "Coupure manuelle conservée", phrase: "a conservé la coupure manuelle de" },
  already_immobilized: { noun: "Déjà immobilisé", phrase: "a constaté l'immobilisation existante de" },
  idle: { noun: "Changement d'état", phrase: "a changé l'état de" },
  waiting_retry: { noun: "Nouvelle tentative prévue", phrase: "a programmé une nouvelle tentative pour" },
  waiting_in_flight: { noun: "Commande en cours", phrase: "attend la fin d'une commande pour" },
};

function verbOf(action: string): { key: string; words: VerbWords } {
  const key = action.split(".").slice(2).join(".");
  const fallback = key.replaceAll("_", " ");
  return {
    key,
    words: VERB_WORDS[key] ?? {
      noun: fallback.charAt(0).toUpperCase() + fallback.slice(1),
      phrase: `a effectué « ${fallback} » sur`,
    },
  };
}

/** Verbes dont le titre se construit avec « à » plutôt qu'avec « de ». */
const TO_VERBS = new Set([
  "members_added",
  "vehicles_attached",
  "groups_attached",
  "vehicle_assigned",
  "organization_assigned",
]);

/** Titre court de l'événement : « Création d'un utilisateur ». */
export function auditEventTitle(entry: Pick<AuditLogEntry, "action" | "resourceType">): string {
  const verb = verbOf(entry.action);
  const resource = words(String(entry.resourceType || entry.action.split(".")[1] || ""));
  if (verb.key === "login" || verb.key === "logout" || verb.key === "login_failed") return verb.words.noun;
  // « Ajout de membres à un groupe », mais « Création d'un utilisateur ».
  if (TO_VERBS.has(verb.key)) return `${verb.words.noun} à ${indefinite(resource)}`;
  return `${verb.words.noun} ${ofIndefinite(resource)}`;
}

// ── Acteur ───────────────────────────────────────────────────────────────────

const ACTOR_TYPES: Record<string, string> = {
  user: "Utilisateur",
  system: "Système (action automatique)",
  api: "Application connectée (API)",
  scheduler: "Planificateur automatique",
  device: "Boîtier GPS",
};

export function actorTypeLabel(type: string): string {
  return ACTOR_TYPES[type] ?? type;
}

export function actorDisplay(entry: Pick<AuditLogEntry, "actorName" | "actorEmail" | "actorType">): string {
  if (entry.actorName) return entry.actorName;
  if (entry.actorEmail) return entry.actorEmail;
  if (entry.actorType === "system" || entry.actorType === "scheduler") return "Le système";
  return actorTypeLabel(entry.actorType);
}

// ── Nom de l'élément concerné ────────────────────────────────────────────────

const NAME_FIELDS = ["fullName", "name", "label", "registration", "email", "code", "imei", "title", "reference"];

/** Nom lisible de l'élément (« konate@gmail.com », « AB-123-CD »), à défaut null. */
export function auditSubjectName(entry: Pick<AuditLogEntry, "after" | "before" | "metadata">): string | null {
  for (const snap of [entry.after, entry.before, entry.metadata]) {
    if (!snap) continue;
    for (const f of NAME_FIELDS) {
      const v = snap[f];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return null;
}

/** Phrase de résumé : « Exploitant SISBM a créé l'utilisateur konate@gmail.com. » */
export function auditSentence(entry: AuditLogEntry): string {
  const actor = actorDisplay(entry);
  const verb = verbOf(entry.action);
  const w = words(String(entry.resourceType || ""));
  const subject = auditSubjectName(entry);
  if (verb.key === "login" || verb.key === "logout" || verb.key === "login_failed") {
    return `${actor} ${verb.words.phrase}.`;
  }
  const target = subject ? `${definite(w)} « ${subject} »` : definite(w);
  // « a ajouté des membres à le groupe » → « au groupe » ; « de le » → « du ».
  const sentence = `${actor} ${verb.words.phrase} ${target}.`
    .replace(/ à le /g, " au ")
    .replace(/ de le /g, " du ")
    .replace(/ à les /g, " aux ")
    .replace(/ de les /g, " des ");
  return sentence;
}

// ── Champs et valeurs ────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  id: "Identifiant",
  name: "Nom",
  fullName: "Nom complet",
  firstName: "Prénom",
  lastName: "Nom de famille",
  email: "Adresse e-mail",
  phone: "Téléphone",
  role: "Rôle",
  roleId: "Rôle",
  roleCode: "Rôle",
  status: "Statut",
  isActive: "Actif",
  locale: "Langue",
  timezone: "Fuseau horaire",
  organizationId: "Organisation",
  organization: "Organisation",
  code: "Code",
  label: "Libellé",
  description: "Description",
  registration: "Immatriculation",
  vin: "Numéro de châssis (VIN)",
  brand: "Marque",
  model: "Modèle",
  year: "Année",
  type: "Type",
  color: "Couleur",
  imei: "IMEI du boîtier",
  serialNumber: "Numéro de série",
  simNumber: "Numéro de la carte SIM",
  simOperator: "Opérateur SIM",
  deviceId: "Boîtier",
  vehicleId: "Véhicule",
  driverId: "Conducteur",
  groupId: "Groupe",
  userId: "Utilisateur",
  members: "Membres",
  memberIds: "Membres",
  vehicleIds: "Véhicules",
  added: "Ajoutés",
  removed: "Retirés",
  count: "Nombre",
  reason: "Motif",
  comment: "Commentaire",
  command: "Commande",
  commandType: "Type de commande",
  windows: "Plages horaires",
  startsAt: "Début",
  endsAt: "Fin",
  startDate: "Date de début",
  endDate: "Date de fin",
  createdAt: "Créé le",
  updatedAt: "Modifié le",
  deletedAt: "Supprimé le",
  lastLoginAt: "Dernière connexion",
  passwordChangedAt: "Mot de passe changé le",
  contactEmail: "E-mail de contact",
  contactPhone: "Téléphone de contact",
  countryCode: "Pays",
  licenseNumber: "Numéro de permis",
  speedLimit: "Limite de vitesse",
  odometer: "Kilométrage",
  ip: "Adresse IP",
  userAgent: "Navigateur",
  requestId: "Référence de la requête",
  source: "Origine",
  channel: "Canal",
};

/** Champs purement techniques : relégués dans « Détails techniques ». */
const TECHNICAL_FIELDS = new Set(["id", "requestId", "userAgent", "settings", "passwordHash", "password", "token"]);

export function isTechnicalField(key: string): boolean {
  // Les identifiants (UUID) ne parlent à personne : on affiche plutôt le nom de l'élément.
  return TECHNICAL_FIELDS.has(key) || key.endsWith("Id") || key.endsWith("_id");
}

/** `lastLoginAt` → « Last login at » quand le champ n'est pas encore traduit. */
export function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const spaced = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const VALUE_LABELS: Record<string, Record<string, string>> = {
  role: { super_admin: "Super administrateur SISBM", ...ROLE_DISPLAY_NAMES },
  roleCode: { super_admin: "Super administrateur SISBM", ...ROLE_DISPLAY_NAMES },
  locale: { fr: "Français", en: "Anglais" },
  status: {
    active: "Actif",
    pending: "En attente d'activation",
    suspended: "Suspendu",
    inactive: "Inactif",
    draft: "Brouillon",
    archived: "Archivé",
    maintenance: "En maintenance",
    stock: "En stock",
    decommissioned: "Retiré du service",
    queued: "En attente d'envoi",
    sent: "Envoyée",
    acknowledged: "Confirmée",
    failed: "Échec",
    expired: "Expirée",
    cancelled: "Annulée",
  },
  type: {
    car: "Voiture",
    van: "Fourgon",
    truck: "Camion",
    tanker: "Citerne",
    bus: "Bus",
    motorcycle: "Moto",
    trailer: "Remorque",
    machinery: "Engin",
    other: "Autre",
  },
  commandType: {
    engine_cut: "Coupure du moteur",
    engine_restore: "Rétablissement du moteur",
    locate: "Localisation",
    reboot: "Redémarrage du boîtier",
    set_interval: "Changement de l'intervalle de suivi",
    custom: "Commande personnalisée",
  },
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/;

/** Valeur lisible : Oui/Non, dates en clair, codes traduits, listes résumées. */
export function formatAuditValue(key: string, value: unknown, depth = 0): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return new Intl.NumberFormat("fr-FR").format(value);
  if (typeof value === "string") {
    const translated = VALUE_LABELS[key]?.[value];
    if (translated) return translated;
    if (ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))) {
      return value.length <= 10 ? formatDateTime(`${value}T00:00:00`).replace(/, 00:00$/, "") : formatDateTime(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "Aucun";
    if (key.endsWith("Ids")) return `${value.length} élément${value.length > 1 ? "s" : ""}`;
    if (value.every((v) => typeof v !== "object")) {
      return value.length <= 5
        ? value.map((v) => formatAuditValue(key, v, depth + 1)).join(", ")
        : `${value.length} éléments`;
    }
    return `${value.length} élément${value.length > 1 ? "s" : ""}`;
  }
  if (typeof value === "object") {
    if (depth > 0) return "…";
    const entries = Object.entries(value as Record<string, unknown>).filter(([k]) => !isTechnicalField(k));
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${fieldLabel(k)} : ${formatAuditValue(k, v, depth + 1)}`).join(" · ");
  }
  return String(value);
}

// ── Changements ──────────────────────────────────────────────────────────────

export interface AuditChange {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
  kind: "added" | "removed" | "changed" | "unchanged";
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Lignes « Avant / Après » lisibles. Pour une modification, seuls les champs qui ont changé
 * (les autres sont comptés à part). Les champs techniques sont exclus.
 */
export function auditChanges(entry: Pick<AuditLogEntry, "before" | "after">): {
  changes: AuditChange[];
  unchanged: number;
} {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !isTechnicalField(k));
  const bothSides = entry.before !== null && entry.after !== null;
  const changes: AuditChange[] = [];
  let unchanged = 0;
  for (const key of keys) {
    const inBefore = key in before;
    const inAfter = key in after;
    if (bothSides && inBefore && inAfter && same(before[key], after[key])) {
      unchanged += 1;
      continue;
    }
    let kind: AuditChange["kind"] = "changed";
    if (!inBefore || entry.before === null) kind = "added";
    else if (!inAfter || entry.after === null) kind = "removed";
    changes.push({
      key,
      label: fieldLabel(key),
      before: inBefore && entry.before !== null ? formatAuditValue(key, before[key]) : null,
      after: inAfter && entry.after !== null ? formatAuditValue(key, after[key]) : null,
      kind,
    });
  }
  return { changes, unchanged };
}

/** Informations complémentaires de `metadata`, hors champs techniques. */
export function auditContext(entry: Pick<AuditLogEntry, "metadata">): Array<{ label: string; value: string }> {
  return Object.entries(entry.metadata ?? {})
    .filter(([k]) => !isTechnicalField(k))
    .map(([k, v]) => ({ label: fieldLabel(k), value: formatAuditValue(k, v) }));
}

// ── Colonnes « Module » et « Résultat » du journal (§VI.2, écran 5) ─────────

const MODULES: Record<string, string> = {
  identity: "Administration & habilitations",
  security: "Commandes et sécurité",
  fleet: "Offres & Clients — véhicules et flotte",
  billing: "Facturation",
  telemetry: "Supervision GPS",
  scheduling: "Horaires",
  alerting: "Alertes & notifications",
  incident: "Gestion des incidents",
  settings: "Paramètres",
  commercial: "Offres & Clients",
};

/** Module fonctionnel de l'action (premier segment `domaine.ressource.verbe`). */
export function auditModule(action: string): string {
  const domain = action.split(".")[0] ?? "";
  return MODULES[domain] ?? domain.replaceAll("_", " ");
}

/** Résultat de l'opération : échec si le verbe ou les métadonnées l'indiquent. */
export function auditResult(entry: Pick<AuditLogEntry, "action" | "metadata">): "success" | "failure" {
  const verb = entry.action.split(".").slice(2).join(".");
  const meta = entry.metadata ?? {};
  const flagged = meta.result === "failure" || meta.success === false || typeof meta.error === "string";
  return flagged || ["failed", "rejected", "login_failed", "denied", "expired"].includes(verb) ? "failure" : "success";
}

/** Premier changement lisible « ancienne → nouvelle valeur », pour la colonne de la liste. */
export function auditChangeSummary(entry: Pick<AuditLogEntry, "before" | "after">): string | null {
  const { changes } = auditChanges(entry);
  if (changes.length === 0) return null;
  const c = changes[0];
  const text =
    c.kind === "added"
      ? `${c.label} : ${c.after}`
      : c.kind === "removed"
        ? `${c.label} : ${c.before} (supprimé)`
        : `${c.label} : ${c.before} → ${c.after}`;
  return changes.length > 1 ? `${text} (+${changes.length - 1})` : text;
}
