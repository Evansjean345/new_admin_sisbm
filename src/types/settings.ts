/**
 * Module 7 — Paramètres (spécifications SuperAdmin §VII).
 *
 * Règles : paramètres globaux réservés aux administrateurs autorisés ; toute modification
 * sensible est historisée ; les secrets ne sont JAMAIS renvoyés par l'API (seul `hasSecret`
 * indique qu'un secret est enregistré) ; un test de connexion précède la mise en service.
 */

export interface GeneralSettings {
  platformName: string;
  /** Logo en data URL (démonstration) ; en production : URL du fichier stocké. */
  logo: string | null;
  language: "fr" | "en";
  timezone: string;
  dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd" | "d MMM yyyy";
  numberFormat: "fr-FR" | "en-US";
  currency: string;
  contact: {
    companyName: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    registrationNumber: string;
  };
}

export type ConnectionStatus = "connected" | "error" | "untested";

export interface SmsGatewaySettings {
  provider: string;
  username: string;
  /** Saisie seulement : jamais renvoyé. */
  hasSecret: boolean;
  serviceUrl: string;
  sender: string;
  unitCost: number;
  balance: number | null;
  status: ConnectionStatus;
  lastTestAt: string | null;
  lastError: string | null;
}

export interface EmailSettings {
  provider: "smtp" | "sendgrid" | "mailgun" | "ses";
  host: string;
  port: number;
  encryption: "tls" | "ssl" | "none";
  username: string;
  hasSecret: boolean;
  fromAddress: string;
  fromName: string;
  status: ConnectionStatus;
  lastTestAt: string | null;
  lastError: string | null;
}

/** Les payloads d'écriture acceptent un nouveau secret (vide = inchangé). */
export type SmsGatewayPayload = Omit<
  SmsGatewaySettings,
  "hasSecret" | "status" | "lastTestAt" | "lastError" | "balance"
> & {
  secret?: string;
};
export type EmailPayload = Omit<EmailSettings, "hasSecret" | "status" | "lastTestAt" | "lastError"> & {
  secret?: string;
};

export const REFERENTIAL_KINDS = ["brands", "vehicleTypes", "eventCategories", "incidentCategories"] as const;
export type ReferentialKind = (typeof REFERENTIAL_KINDS)[number];

export interface ReferentialItem {
  id: string;
  /** Code stable utilisé par les autres modules (non modifiable). */
  code: string;
  label: string;
  active: boolean;
  /** Modèles d'une marque. */
  children?: ReferentialItem[];
}

export interface TechnicalSettings {
  logLevel: "error" | "warn" | "info" | "debug";
  /** Conservation du journal d'audit (jours). */
  auditRetentionDays: number;
  /** Conservation par défaut des positions GPS (jours) ; chaque offre peut la surcharger. */
  gpsRetentionDays: number;
  /** Fréquence de synchronisation Flespi (secondes). */
  syncIntervalSeconds: number;
  /** Délai au-delà duquel un véhicule est « hors ligne » (minutes). */
  offlineAfterMinutes: number;
  backup: {
    frequency: "hourly" | "daily" | "weekly";
    time: string;
    retentionDays: number;
    lastBackupAt: string | null;
  };
}

export interface ServiceHealth {
  key: string;
  label: string;
  status: "up" | "degraded" | "down";
  latencyMs: number | null;
  checkedAt: string;
  detail: string | null;
}

export interface SettingsChange {
  id: string;
  at: string;
  actor: string;
  section: string;
  description: string;
}
