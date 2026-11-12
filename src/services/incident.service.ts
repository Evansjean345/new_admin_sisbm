import { severityMeta } from "@/components/alerting-labels";
import { mockClone, mockDelay, mockId, mockNow, mockPaginate } from "@/lib/mock";
import type { PersonRef, Severity } from "@/types/alerting";
import { ApiError, type Paginated } from "@/types/api";
import type { Attachment } from "@/types/billing";
import type {
  CreateIncidentPayload,
  Incident,
  IncidentCategory,
  IncidentListParams,
  IncidentStats,
  IncidentStatus,
} from "@/types/incident";

import { alertingDb, alertingService, historyEntry } from "./alerting.service";

/**
 * Gestion des incidents — SERVICE SIMULÉ (routes attendues : /admin/incidents/*).
 *
 * Règles (§V.5) appliquées ici, à reprendre côté serveur :
 *  - référence unique INC-AAAA-NNNNN ;
 *  - plusieurs alertes par incident ;
 *  - un responsable OU une file d'affectation est obligatoire ;
 *  - tout changement de statut est historisé ;
 *  - la clôture exige un compte rendu ;
 *  - un incident critique peut être escaladé ;
 *  - un incident clôturé n'est plus modifiable sans réouverture tracée (avec motif).
 */

const ACTOR = "Vous (démo)";

let incidents: Incident[] | null = null;
let seq = 0;
let seeding: Promise<Incident[]> | null = null;

const ALLOWED: Record<IncidentStatus, IncidentStatus[]> = {
  new: ["assigned", "in_progress"],
  assigned: ["in_progress", "on_hold", "resolved"],
  in_progress: ["on_hold", "resolved"],
  on_hold: ["in_progress", "resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

function nextRef(): string {
  seq += 1;
  return `INC-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
}

async function db(): Promise<Incident[]> {
  if (incidents) return incidents;
  seeding ??= (async () => {
    const s = await alertingDb();
    const list: Incident[] = [];
    // Incidents de démonstration nés des alertes critiques.
    const critical = s.alerts.filter((a) => a.severity === "critical").slice(0, 7);
    const statuses: IncidentStatus[] = [
      "new",
      "assigned",
      "in_progress",
      "on_hold",
      "resolved",
      "closed",
      "in_progress",
    ];
    const categories: Record<string, IncidentCategory> = {
      sos: "sos",
      power_cut: "tamper",
      jamming: "theft",
      towing: "theft",
      tamper: "tamper",
    };
    critical.forEach((a, i) => {
      const status = statuses[i % statuses.length];
      const incident: Incident = {
        id: mockId(),
        reference: nextRef(),
        organizationId: a.organizationId,
        organization: a.organization,
        vehicleId: a.vehicleId,
        vehicle: a.vehicle,
        driver: null,
        category: categories[a.eventType] ?? "other",
        priority: "critical",
        occurredAt: a.occurredAt,
        description: `Incident ouvert automatiquement suite à l'alerte ${a.reference} (${a.ruleName ?? "événement GPS"}).`,
        source: "rule_engine",
        alertIds: [a.id],
        location: a.location,
        attachments: [],
        status,
        assignee: status === "new" ? null : { id: "support", name: "Support niveau 1" },
        queue: status === "new" ? "Sécurité / SOC" : null,
        escalationLevel: i % 3 === 0 ? 1 : 0,
        comments: [],
        actions:
          status === "new"
            ? []
            : [
                {
                  id: mockId(),
                  at: a.occurredAt,
                  author: "Support niveau 1",
                  text: "Appel du client pour vérification.",
                },
              ],
        history: [historyEntry("Création", "Incident créé par le moteur de règles.", "Système", a.occurredAt)],
        resolutionReport:
          status === "resolved" || status === "closed" ? "Fausse alerte : intervention du garagiste." : null,
        createdAt: a.occurredAt,
        updatedAt: a.occurredAt,
        closedAt: status === "closed" ? a.occurredAt : null,
      };
      list.push(incident);
      a.incidentId = incident.id;
      a.incidentReference = incident.reference;
      if (a.status !== "resolved") a.status = "escalated";
    });
    return list;
  })();
  incidents = await seeding;
  return incidents;
}

async function find(id: string): Promise<Incident> {
  const inc = (await db()).find((i) => i.id === id);
  if (!inc) throw new ApiError(404, "E_NOT_FOUND", "Incident introuvable.");
  return inc;
}

function assertEditable(inc: Incident) {
  if (inc.status === "closed") {
    throw new ApiError(409, "E_INCIDENT_CLOSED", "Incident clôturé : rouvrez-le (avec motif) pour le modifier.");
  }
}

function touch(inc: Incident, action: string, description: string) {
  inc.updatedAt = mockNow();
  inc.history.push(historyEntry(action, description));
}

const STATUS_LABEL: Record<IncidentStatus, string> = {
  new: "Nouveau",
  assigned: "Assigné",
  in_progress: "En cours",
  on_hold: "En attente",
  resolved: "Résolu",
  closed: "Clôturé",
};

export const incidentService = {
  async list(params: IncidentListParams = {}): Promise<Paginated<Incident>> {
    await mockDelay();
    const q = params.search?.toLowerCase();
    const rows = (await db())
      .filter(
        (i) =>
          (!params.organizationId || i.organizationId === params.organizationId) &&
          (!params.status || i.status === params.status) &&
          (!params.priority || i.priority === params.priority) &&
          (!params.category || i.category === params.category) &&
          (!q ||
            i.reference.toLowerCase().includes(q) ||
            i.organization.name.toLowerCase().includes(q) ||
            (i.vehicle?.registration.toLowerCase().includes(q) ?? false)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mockPaginate(rows, params);
  },

  async stats(): Promise<IncidentStats> {
    await mockDelay(150);
    const all = await db();
    const count = (s: IncidentStatus) => all.filter((i) => i.status === s).length;
    return {
      total: all.length,
      new: count("new"),
      critical: all.filter((i) => i.priority === "critical" && i.status !== "closed").length,
      assigned: count("assigned"),
      inProgress: count("in_progress"),
      onHold: count("on_hold"),
      resolved: count("resolved"),
      closed: count("closed"),
    };
  },

  async get(id: string): Promise<Incident> {
    await mockDelay(150);
    return mockClone(await find(id));
  },

  async create(payload: CreateIncidentPayload): Promise<Incident> {
    await mockDelay();
    if (!payload.description.trim()) throw new ApiError(422, "E_VALIDATION", "Description obligatoire.");
    if (!payload.assignee && !payload.queue) {
      throw new ApiError(422, "E_VALIDATION", "Désignez un responsable ou une file d'affectation.");
    }
    const s = await alertingDb();
    const org = s.orgs.find((o) => o.id === payload.organizationId);
    if (!org) throw new ApiError(422, "E_VALIDATION", "Client inconnu.");
    const alert = payload.alertIds.map((id) => s.alerts.find((a) => a.id === id)).find(Boolean);
    let vehicle: Incident["vehicle"] = alert?.vehicle ?? null;
    if (payload.vehicleId && (!vehicle || vehicle.id !== payload.vehicleId)) {
      vehicle = s.alerts.find((a) => a.vehicleId === payload.vehicleId)?.vehicle ?? {
        id: payload.vehicleId,
        registration: "Véhicule",
        label: null,
      };
    }
    const now = mockNow();
    const incident: Incident = {
      id: mockId(),
      reference: nextRef(),
      organizationId: org.id,
      organization: org,
      vehicleId: vehicle?.id ?? null,
      vehicle,
      driver: payload.driver ?? null,
      category: payload.category,
      priority: payload.priority,
      occurredAt: payload.occurredAt,
      description: payload.description.trim(),
      source: payload.source,
      alertIds: payload.alertIds,
      location: payload.location ?? alert?.location ?? null,
      attachments: payload.attachments,
      status: payload.assignee ? "assigned" : "new",
      assignee: payload.assignee ?? null,
      queue: payload.queue ?? null,
      escalationLevel: 0,
      comments: [],
      actions: [],
      history: [
        historyEntry(
          "Création",
          `Incident créé (${payload.assignee ? `assigné à ${payload.assignee.name}` : `file ${payload.queue}`}).`,
        ),
      ],
      resolutionReport: null,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    };
    (await db()).unshift(incident);
    if (payload.alertIds.length > 0) await alertingService.linkIncident(payload.alertIds, incident);
    return mockClone(incident);
  },

  async assign(id: string, assignee: PersonRef | null, queue: string | null): Promise<Incident> {
    await mockDelay();
    const inc = await find(id);
    assertEditable(inc);
    if (!assignee && !queue) throw new ApiError(422, "E_VALIDATION", "Désignez un responsable ou une file.");
    inc.assignee = assignee;
    inc.queue = queue;
    if (inc.status === "new" && assignee) inc.status = "assigned";
    touch(inc, "Assignation", assignee ? `Responsable : ${assignee.name}.` : `File : ${queue}.`);
    return mockClone(inc);
  },

  async setPriority(id: string, priority: Severity): Promise<Incident> {
    await mockDelay();
    const inc = await find(id);
    assertEditable(inc);
    const before = inc.priority;
    inc.priority = priority;
    touch(inc, "Priorité", `Priorité : ${severityMeta[before].label} → ${severityMeta[priority].label}.`);
    return mockClone(inc);
  },

  /** Changement de statut ; « closed » exige un compte rendu. */
  async setStatus(id: string, status: IncidentStatus, note?: string): Promise<Incident> {
    await mockDelay();
    const inc = await find(id);
    assertEditable(inc);
    if (!ALLOWED[inc.status].includes(status)) {
      throw new ApiError(
        409,
        "E_TRANSITION",
        `Passage impossible de « ${STATUS_LABEL[inc.status]} » à « ${STATUS_LABEL[status]} ».`,
      );
    }
    if (status === "assigned" && !inc.assignee)
      throw new ApiError(422, "E_VALIDATION", "Assignez d'abord un responsable.");
    if (status === "resolved" || status === "closed") {
      const report = note?.trim() || inc.resolutionReport;
      if (!report || report.length < 10) {
        throw new ApiError(422, "E_REPORT_REQUIRED", "Un compte rendu (10 caractères minimum) est obligatoire.");
      }
      inc.resolutionReport = report;
    }
    const before = inc.status;
    inc.status = status;
    if (status === "closed") inc.closedAt = mockNow();
    touch(inc, "Statut", `${STATUS_LABEL[before]} → ${STATUS_LABEL[status]}${note ? ` : ${note}` : ""}`);
    return mockClone(inc);
  },

  /** Réouverture tracée d'un incident clôturé ou résolu. */
  async reopen(id: string, reason: string): Promise<Incident> {
    await mockDelay();
    const inc = await find(id);
    if (inc.status !== "closed" && inc.status !== "resolved") {
      throw new ApiError(409, "E_TRANSITION", "Seul un incident résolu ou clôturé se rouvre.");
    }
    if (reason.trim().length < 5) throw new ApiError(422, "E_VALIDATION", "Motif de réouverture obligatoire.");
    inc.status = "in_progress";
    inc.closedAt = null;
    touch(inc, "Réouverture", reason.trim());
    return mockClone(inc);
  },

  async escalate(id: string, reason: string): Promise<Incident> {
    await mockDelay();
    const inc = await find(id);
    assertEditable(inc);
    inc.escalationLevel += 1;
    inc.queue = inc.escalationLevel >= 2 ? "Direction des opérations" : "Sécurité / SOC";
    touch(inc, "Escalade", `Niveau ${inc.escalationLevel} (${inc.queue}) : ${reason}`);
    return mockClone(inc);
  },

  async addComment(id: string, text: string): Promise<Incident> {
    await mockDelay(200);
    const inc = await find(id);
    assertEditable(inc);
    if (!text.trim()) throw new ApiError(422, "E_VALIDATION", "Commentaire vide.");
    inc.comments.push({ id: mockId(), at: mockNow(), author: ACTOR, text: text.trim() });
    inc.updatedAt = mockNow();
    return mockClone(inc);
  },

  async addAction(id: string, text: string): Promise<Incident> {
    await mockDelay(200);
    const inc = await find(id);
    assertEditable(inc);
    if (!text.trim()) throw new ApiError(422, "E_VALIDATION", "Action vide.");
    inc.actions.push({ id: mockId(), at: mockNow(), author: ACTOR, text: text.trim() });
    touch(inc, "Action", text.trim());
    if (inc.status === "assigned" || inc.status === "new") inc.status = "in_progress";
    return mockClone(inc);
  },

  async addAttachment(id: string, file: Attachment): Promise<Incident> {
    await mockDelay(200);
    const inc = await find(id);
    assertEditable(inc);
    inc.attachments.push(file);
    touch(inc, "Pièce jointe", file.name);
    return mockClone(inc);
  },
};
