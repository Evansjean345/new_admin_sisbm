import type { AuditLogEntry } from "@/types/audit";

/**
 * Formats d'échange avec un SOC / SIEM pour le journal d'audit.
 *
 * Fonctions PURES : l'écran s'en sert pour le téléchargement, et le backend pourra reprendre
 * les mêmes règles pour l'envoi direct (le navigateur ne doit pas parler au SIEM lui-même).
 */

export const SOC_FORMATS = ["jsonl", "cef", "syslog", "csv"] as const;
export type SocFormat = (typeof SOC_FORMATS)[number];

export const socFormatMeta: Record<SocFormat, { label: string; hint: string; extension: string; mime: string }> = {
  jsonl: {
    label: "JSON Lines",
    hint: "Un événement JSON par ligne : Splunk, Elastic, Wazuh, Graylog.",
    extension: "jsonl",
    mime: "application/x-ndjson",
  },
  cef: {
    label: "CEF (Common Event Format)",
    hint: "ArcSight, QRadar, Microsoft Sentinel.",
    extension: "cef",
    mime: "text/plain",
  },
  syslog: {
    label: "Syslog RFC 5424",
    hint: "Collecteur syslog (rsyslog, syslog-ng) ou SIEM en écoute syslog.",
    extension: "log",
    mime: "text/plain",
  },
  csv: {
    label: "CSV",
    hint: "Analyse manuelle dans un tableur.",
    extension: "csv",
    mime: "text/csv",
  },
};

const VENDOR = "SISBM";
const PRODUCT = "SISBM CORE";
const VERSION = "1.0";
const HOST = "sisbm-core";
/** Facilité syslog 13 = « log audit ». */
const FACILITY = 13;

/** Gravité SIEM : commandes boîtier et suppressions ressortent davantage. */
export function auditSeverity(entry: AuditLogEntry): { cef: number; syslog: number; label: string } {
  const a = entry.action.toLowerCase();
  if (entry.resourceType === "device_command" || a.includes("immobil")) return { cef: 7, syslog: 4, label: "élevée" };
  if (a.includes("delete") || a.includes("removed") || a.includes("suspend") || a.includes("login_failed")) {
    return { cef: 5, syslog: 5, label: "moyenne" };
  }
  return { cef: 3, syslog: 6, label: "faible" };
}

/** Objet normalisé commun aux formats (noms de champs proches d'ECS). */
export function toSocEvent(e: AuditLogEntry) {
  return {
    "@timestamp": e.occurredAt,
    "event.id": e.id,
    "event.action": e.action,
    "event.severity": auditSeverity(e).cef,
    "event.provider": PRODUCT,
    "organization.id": e.organizationId,
    "user.id": e.actorId,
    "user.email": e.actorEmail,
    "user.name": e.actorName,
    "user.type": e.actorType,
    "source.ip": e.actorIp,
    "resource.type": e.resourceType,
    "resource.id": e.resourceId,
    before: e.before,
    after: e.after,
    metadata: e.metadata,
  };
}

export function toJsonLines(entries: AuditLogEntry[]): string {
  return entries.map((e) => JSON.stringify(toSocEvent(e))).join("\n");
}

const cefHeader = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ");
const cefValue = (v: string) => v.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\r?\n/g, "\\n");

export function toCef(entries: AuditLogEntry[]): string {
  return entries
    .map((e) => {
      const ext: Array<[string, string | null | undefined]> = [
        ["rt", String(Date.parse(e.occurredAt))],
        ["externalId", e.id],
        ["act", e.action],
        ["suser", e.actorEmail ?? e.actorName ?? e.actorType],
        ["suid", e.actorId],
        ["src", e.actorIp],
        ["cs1Label", "organizationId"],
        ["cs1", e.organizationId],
        ["cs2Label", "resource"],
        ["cs2", `${e.resourceType}${e.resourceId ? `:${e.resourceId}` : ""}`],
      ];
      const extension = ext
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${cefValue(String(v))}`)
        .join(" ");
      const header = [VENDOR, PRODUCT, VERSION, e.action, e.action, String(auditSeverity(e).cef)].map(cefHeader);
      return `CEF:0|${header.join("|")}|${extension}`;
    })
    .join("\n");
}

const sdValue = (v: string) => v.replace(/[\\"\]]/g, (c) => `\\${c}`);

export function toSyslog(entries: AuditLogEntry[]): string {
  return entries
    .map((e) => {
      const pri = FACILITY * 8 + auditSeverity(e).syslog;
      const params: Array<[string, string | null]> = [
        ["id", e.id],
        ["action", e.action],
        ["actor", e.actorEmail ?? e.actorName ?? e.actorType],
        ["ip", e.actorIp],
        ["org", e.organizationId],
        ["resource", `${e.resourceType}${e.resourceId ? `:${e.resourceId}` : ""}`],
      ];
      const sd = params
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}="${sdValue(String(v))}"`)
        .join(" ");
      const msg = `${e.actorEmail ?? e.actorType} ${e.action} ${e.resourceType}`;
      return `<${pri}>1 ${e.occurredAt} ${HOST} sisbm-audit - AUDIT [sisbm@32473 ${sd}] ${msg}`;
    })
    .join("\n");
}

export function toCsv(entries: AuditLogEntry[]): string {
  const headers = [
    "date",
    "id",
    "action",
    "gravite",
    "acteur",
    "type_acteur",
    "ip",
    "organisation",
    "ressource",
    "ressource_id",
  ];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = entries.map((e) =>
    [
      e.occurredAt,
      e.id,
      e.action,
      auditSeverity(e).label,
      e.actorEmail ?? e.actorName,
      e.actorType,
      e.actorIp,
      e.organizationId,
      e.resourceType,
      e.resourceId,
    ]
      .map(cell)
      .join(";"),
  );
  return [headers.join(";"), ...rows].join("\n");
}

export function formatAuditForSoc(entries: AuditLogEntry[], format: SocFormat): string {
  if (format === "jsonl") return toJsonLines(entries);
  if (format === "cef") return toCef(entries);
  if (format === "syslog") return toSyslog(entries);
  return `\ufeff${toCsv(entries)}`;
}
