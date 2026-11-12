import { mockClone, mockDelay, mockId, mockNow } from "@/lib/mock";
import { formatAuditForSoc, type SocFormat } from "@/lib/soc-formats";
import { ApiError } from "@/types/api";
import { AUDIT_MAX_PER_PAGE, type AuditLogEntry, type AuditLogListParams } from "@/types/audit";

import { auditService } from "./audit.service";

/**
 * Transfert du journal d'audit vers le SOC.
 *
 * - LECTURE des événements : VRAIE API (`GET /audit-logs`, paginée par 200, fenêtre ≤ 366 jours).
 * - DESTINATION et ENVOI : SIMULÉS. En production, c'est le backend qui pousse vers le SIEM
 *   (POST /admin/soc/transfers) : le navigateur ne doit ni connaître le jeton du SIEM, ni l'appeler.
 */

export const SOC_TRANSPORTS = ["https", "syslog_tls"] as const;
export type SocTransport = (typeof SOC_TRANSPORTS)[number];

export interface SocDestination {
  name: string;
  transport: SocTransport;
  /** URL HTTPS du collecteur, ou hôte:port syslog. */
  endpoint: string;
  format: SocFormat;
  /** Envoi automatique continu (côté serveur) en plus des envois manuels. */
  autoForward: boolean;
  updatedAt: string | null;
}

export interface SocTransfer {
  id: string;
  at: string;
  actor: string;
  /** « download » = fichier téléchargé ; « push » = envoyé à la destination. */
  mode: "download" | "push";
  destination: string | null;
  format: SocFormat;
  from: string;
  to: string;
  count: number;
  sizeKb: number;
  status: "success" | "failed" | "truncated";
  detail: string | null;
}

/** Au-delà, l'export est tronqué : le SOC doit alors préférer l'envoi automatique continu. */
export const SOC_MAX_EVENTS = 10_000;

let destination: SocDestination | null = null;
const transfers: SocTransfer[] = [];

function validateDestination(d: SocDestination) {
  if (!d.name.trim()) throw new ApiError(422, "E_VALIDATION", "Nom de la destination obligatoire.");
  if (d.transport === "https" && !/^https:\/\/[^\s]+$/i.test(d.endpoint)) {
    throw new ApiError(422, "E_VALIDATION", "Le collecteur HTTPS doit commencer par https://.");
  }
  if (d.transport === "syslog_tls" && !/^[\w.-]+:\d{2,5}$/.test(d.endpoint)) {
    throw new ApiError(422, "E_VALIDATION", "Format attendu pour syslog : hôte:port (ex. siem.sisbm.ci:6514).");
  }
}

export const socService = {
  /** Lit les événements de la fenêtre, toutes pages confondues (plafond SOC_MAX_EVENTS). */
  async collect(params: AuditLogListParams): Promise<{ entries: AuditLogEntry[]; total: number; truncated: boolean }> {
    const entries: AuditLogEntry[] = [];
    let page = 1;
    let total = 0;
    for (;;) {
      const res = await auditService.list({ ...params, page, perPage: AUDIT_MAX_PER_PAGE });
      total = res.meta.total;
      entries.push(...res.data);
      if (page >= res.meta.lastPage || entries.length >= SOC_MAX_EVENTS) break;
      page += 1;
    }
    return { entries: entries.slice(0, SOC_MAX_EVENTS), total, truncated: total > SOC_MAX_EVENTS };
  },

  /** GET /admin/soc/destination */
  async getDestination(): Promise<SocDestination | null> {
    await mockDelay(150);
    return destination ? mockClone(destination) : null;
  },

  /** PUT /admin/soc/destination */
  async saveDestination(d: Omit<SocDestination, "updatedAt">): Promise<SocDestination> {
    await mockDelay();
    const next = { ...d, endpoint: d.endpoint.trim(), updatedAt: mockNow() };
    validateDestination(next);
    destination = next;
    return mockClone(next);
  },

  /** GET /admin/soc/transfers */
  async history(): Promise<SocTransfer[]> {
    await mockDelay(150);
    return mockClone([...transfers].sort((a, b) => b.at.localeCompare(a.at)));
  },

  /** Journalise un téléchargement fait côté navigateur (traçabilité de la sortie des données). */
  async recordDownload(input: Omit<SocTransfer, "id" | "at" | "actor" | "mode" | "destination" | "detail">) {
    transfers.push({
      ...input,
      id: mockId(),
      at: mockNow(),
      actor: "Vous (démo)",
      mode: "download",
      destination: null,
      detail: null,
    });
  },

  /** POST /admin/soc/transfers — envoi à la destination configurée (simulé). */
  async push(params: AuditLogListParams & { from: string; to: string }): Promise<SocTransfer> {
    const dest = await this.getDestination();
    if (!dest) throw new ApiError(422, "E_SOC_NOT_CONFIGURED", "Configurez d'abord la destination SOC.");
    const { entries, truncated } = await this.collect(params);
    const payload = formatAuditForSoc(entries, dest.format);
    await mockDelay(600);
    const transfer: SocTransfer = {
      id: mockId(),
      at: mockNow(),
      actor: "Vous (démo)",
      mode: "push",
      destination: `${dest.name} (${dest.endpoint})`,
      format: dest.format,
      from: params.from,
      to: params.to,
      count: entries.length,
      sizeKb: Math.ceil(new Blob([payload]).size / 1024),
      status: truncated ? "truncated" : "success",
      detail: truncated
        ? `Limité aux ${SOC_MAX_EVENTS} événements les plus récents : activez l'envoi automatique continu.`
        : "Envoi simulé : aucune donnée n'a quitté le navigateur.",
    };
    transfers.push(transfer);
    return mockClone(transfer);
  },
};
