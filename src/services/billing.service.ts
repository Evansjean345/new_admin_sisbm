import {
  addDaysIso,
  buildInvoiceLines,
  computeInvoiceTotals,
  DEFAULT_PAYMENT_TERM_DAYS,
  DEFAULT_TAX_RATE,
  daysBetween,
  MONTHS_PER_PERIOD,
  periodEndFor,
  periodLabel,
  todayIso,
  vehicleCount,
} from "@/lib/billing";
import { mockClone, mockDelay, mockId, mockNow, mockPaginate } from "@/lib/mock";
import { ApiError, type Paginated } from "@/types/api";
import type {
  BillingStats,
  BillingStatsParams,
  CreditNote,
  GenerateInvoicesPayload,
  GenerateInvoicesResult,
  Invoice,
  InvoiceDraftPayload,
  InvoiceEvent,
  InvoiceKind,
  InvoiceListParams,
  InvoicePreview,
  InvoiceStatus,
  Payment,
  PaymentListParams,
  PaymentMethod,
  RecordPaymentPayload,
  Reminder,
  ReminderChannel,
  ReminderListParams,
  SendRemindersPayload,
} from "@/types/billing";
import type { Subscription } from "@/types/subscription";

import { organizationService } from "./organization.service";
import { subscriptionService } from "./subscription.service";

/**
 * Module Facturation — SERVICE SIMULÉ (l'API n'expose pas encore `/admin/billing/*`).
 *
 * Les factures de démonstration sont générées à partir des souscriptions (elles-mêmes
 * simulées) avec le MÊME moteur que la génération automatique : une facture par cycle
 * de facturation sur les 4 derniers mois.
 *
 * Règles métier (§II.4) appliquées ici — le backend devra les appliquer côté serveur :
 *  1-2. une facture est rattachée à un client ET à une souscription ;
 *  3.   tarif, remise : repris de la souscription au moment de la création ;
 *  4.   changement d'offre en cours de période : chaque affectation est facturée au prorata ;
 *  5.   paiements partiels → solde recalculé à chaque lecture ;
 *  6.   seule une facture BROUILLON est modifiable ; émise ou payée, on passe par un avoir ;
 *  7.   annulation, avoir, paiement annulé : tout est historisé, rien n'est supprimé ;
 *  8.   numéro unique attribué à l'émission (FAC-AAAA-NNNNN), jamais réutilisé ;
 *  9.   une seule facture « standard » par souscription et par période ; un complément ou
 *       une correction doit être demandé explicitement.
 */

const ACTOR = "Vous (démo)";
const MAX_REMINDER_LEVEL = 3;

type DerivedField =
  | "status"
  | "paidAmount"
  | "creditedAmount"
  | "balance"
  | "daysOverdue"
  | "reminderLevel"
  | "lastReminderAt"
  | "creditNotes";
type StoredInvoice = Omit<Invoice, DerivedField>;

interface Contact {
  email: string | null;
  phone: string | null;
}

interface Store {
  invoices: StoredInvoice[];
  payments: Payment[];
  creditNotes: CreditNote[];
  reminders: Reminder[];
  methods: PaymentMethod[];
  contacts: Record<string, Contact>;
  /** Compteurs de numérotation par préfixe et par année : jamais décrémentés (règle 8). */
  sequences: Record<string, number>;
}

let store: Store | null = null;
let seeding: Promise<Store> | null = null;

/** Modes prévus par la spec ; la liste est configurable (Paramètres › Référentiels). */
const DEFAULT_METHODS: PaymentMethod[] = [
  { id: "cash", label: "Espèces", active: true },
  { id: "bank_transfer", label: "Virement bancaire", active: true },
  { id: "mobile_money", label: "Mobile Money", active: true },
  { id: "check", label: "Chèque", active: true },
  { id: "card", label: "Carte bancaire", active: true },
];

const REMINDER_TEMPLATES: Record<number, (inv: StoredInvoice, due: number) => string> = {
  1: (inv, due) =>
    `Bonjour, sauf erreur de notre part, la facture ${inv.number} (${inv.periodLabel}) reste impayée : ${fmt(due)} ${inv.currency}. Merci de régulariser dès que possible.`,
  2: (inv, due) =>
    `Relance : la facture ${inv.number} est échue depuis le ${frDate(inv.dueDate)}. Reste à payer : ${fmt(due)} ${inv.currency}. Merci de procéder au règlement sous 8 jours.`,
  3: (inv, due) =>
    `Mise en demeure : malgré nos relances, la facture ${inv.number} (${fmt(due)} ${inv.currency}) n'est pas réglée. Sans paiement sous 8 jours, le service pourra être suspendu.`,
};

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function frDate(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

function event(action: string, description: string, at = mockNow(), actor = ACTOR): InvoiceEvent {
  return { id: mockId(), at, actor, action, description };
}

function nextNumber(s: Store, prefix: string, date: string): string {
  const key = `${prefix}-${date.slice(0, 4)}`;
  s.sequences[key] = (s.sequences[key] ?? 0) + 1;
  return `${key}-${String(s.sequences[key]).padStart(5, "0")}`;
}

/** Tarif unitaire de la souscription (conditions commerciales, règle 3) : négocié sinon référence. */
function subscriptionUnitPrice(sub: Subscription): number {
  return sub.negotiatedPrice ?? sub.referencePrice;
}

/** Une facture standard non annulée existe-t-elle déjà sur cette période (règle 9) ? */
function findDuplicate(s: Store, subscriptionId: string, start: string, end: string, excludeId?: string) {
  return (
    s.invoices.find(
      (inv) =>
        inv.id !== excludeId &&
        inv.subscriptionId === subscriptionId &&
        inv.kind === "standard" &&
        inv.lifecycle !== "cancelled" &&
        inv.periodStart <= end &&
        inv.periodEnd >= start,
    ) ?? null
  );
}

function buildInvoice(
  sub: Subscription,
  input: {
    kind: InvoiceKind;
    periodStart: string;
    periodEnd: string;
    vehicleIds?: string[];
    unitPrice?: number;
    discountPercent?: number;
    taxRate?: number;
    issueDate?: string;
    dueDate?: string;
    observations?: string | null;
  },
  at = mockNow(),
): StoredInvoice {
  const unitPrice = input.unitPrice ?? subscriptionUnitPrice(sub);
  const discountPercent = input.discountPercent ?? sub.discountPercent;
  const taxRate = input.taxRate ?? DEFAULT_TAX_RATE;
  let lines = buildInvoiceLines(sub.assignments, input.periodStart, input.periodEnd, unitPrice, mockId);
  if (input.vehicleIds) {
    const keep = new Set(input.vehicleIds);
    lines = lines.filter((l) => keep.has(l.vehicleId));
  }
  const issueDate = input.issueDate ?? input.periodStart;
  return {
    id: mockId(),
    number: null,
    kind: input.kind,
    lifecycle: "draft",
    organizationId: sub.organizationId,
    organization: sub.organization,
    subscriptionId: sub.id,
    subscriptionReference: sub.reference,
    offer: sub.offer,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    periodLabel: periodLabel(input.periodStart, input.periodEnd),
    lines,
    vehicleCount: vehicleCount(lines),
    unitPrice,
    discountPercent,
    taxRate,
    currency: sub.currency,
    issueDate,
    dueDate: input.dueDate ?? addDaysIso(issueDate, DEFAULT_PAYMENT_TERM_DAYS),
    observations: input.observations?.trim() || null,
    emailedAt: null,
    emailedTo: null,
    cancelReason: null,
    history: [event("Création", "Brouillon créé à partir de la souscription.", at)],
    createdAt: at,
    updatedAt: at,
    ...computeInvoiceTotals(lines, discountPercent, taxRate),
  };
}

function issueInvoice(s: Store, inv: StoredInvoice, at = mockNow(), actor = ACTOR) {
  inv.number = nextNumber(s, "FAC", inv.issueDate);
  inv.lifecycle = "issued";
  inv.updatedAt = at;
  inv.history.push(
    event(
      "Émission",
      `Facture émise sous le numéro ${inv.number} (${fmt(inv.amountTTC)} ${inv.currency} TTC).`,
      at,
      actor,
    ),
  );
}

/** Cycle de facturation d'une souscription qui commence pendant le mois `month` (AAAA-MM-01). */
function cycleStartingIn(sub: Subscription, month: string): { start: string; end: string } | null {
  const step = MONTHS_PER_PERIOD[sub.periodicity];
  const subMonth = Number(sub.startDate.slice(0, 4)) * 12 + Number(sub.startDate.slice(5, 7)) - 1;
  const target = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
  if (target < subMonth || (target - subMonth) % step !== 0) return null;
  if (sub.endDate && sub.endDate < month) return null;
  return { start: month, end: periodEndFor(month, sub.periodicity) };
}

function monthOffset(months: number, from = todayIso()): string {
  const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)).toISOString().slice(0, 10);
}

async function seed(): Promise<Store> {
  const s: Store = {
    invoices: [],
    payments: [],
    creditNotes: [],
    reminders: [],
    methods: mockClone(DEFAULT_METHODS),
    contacts: {},
    sequences: {},
  };
  try {
    const [subs, orgs] = await Promise.all([
      subscriptionService.list({ status: "active", perPage: 100 }).then((r) => r.data),
      organizationService.list({ perPage: 100 }).then((r) => r.data),
    ]);
    for (const o of orgs) s.contacts[o.id] = { email: o.contactEmail, phone: o.contactPhone };

    const today = todayIso();
    // Du plus ancien au plus récent pour une numérotation chronologique.
    for (let back = 3; back >= 0; back -= 1) {
      const month = monthOffset(-back);
      subs.forEach((sub, k) => {
        const cycle = cycleStartingIn(sub, month);
        if (!cycle) return;
        const at = `${month}T08:00:00.000Z`;
        const inv = buildInvoice(sub, { kind: "standard", periodStart: cycle.start, periodEnd: cycle.end }, at);
        if (inv.lines.length === 0) return;
        inv.history[0] = event("Génération", "Brouillon généré automatiquement.", at, "Génération automatique");
        s.invoices.push(inv);
        // Mois en cours : un brouillon sur quatre reste à vérifier.
        if (back === 0 && k % 4 === 3) return;
        issueInvoice(s, inv, at, "Génération automatique");
        if (back === 0) return;

        const pattern = (k + back) % 5;
        let paid = 0;
        if (pattern === 1) paid = Math.round(inv.amountTTC / 2);
        else if (pattern >= 2) paid = inv.amountTTC;
        if (paid > 0) {
          const paidAt = addDaysIso(inv.dueDate, -((k + back) % 12));
          const method = s.methods[(k + back) % 4];
          s.payments.push({
            id: mockId(),
            reference: nextNumber(s, "PAY", paidAt),
            invoiceId: inv.id,
            invoiceNumber: inv.number as string,
            organizationId: inv.organizationId,
            organization: inv.organization,
            amount: paid,
            currency: inv.currency,
            methodId: method.id,
            methodLabel: method.label,
            paidAt,
            transactionRef: method.id === "cash" ? null : `TX${100000 + s.payments.length * 37}`,
            attachment:
              method.id === "bank_transfer"
                ? { name: "avis-de-virement.pdf", sizeKb: 84, type: "application/pdf" }
                : null,
            comment: pattern === 1 ? "Acompte, solde promis fin de mois." : null,
            status: "confirmed",
            cancelReason: null,
            recordedBy: "Service comptable",
            createdAt: `${paidAt}T10:00:00.000Z`,
          });
        }

        const late = daysBetween(inv.dueDate, today);
        if (paid < inv.amountTTC && late > 7) {
          const levels = late > 30 ? 2 : 1;
          for (let level = 1; level <= levels; level += 1) {
            const sentDate = addDaysIso(inv.dueDate, level === 1 ? 7 : 30);
            const channel: ReminderChannel = level === 1 ? "email" : "sms";
            s.reminders.push(
              makeReminder(s, inv, level, channel, inv.amountTTC - paid, daysBetween(inv.dueDate, sentDate), {
                at: `${sentDate}T09:00:00.000Z`,
                actor: "Relance automatique",
              }),
            );
          }
        }
      });
    }
  } catch {
    // Souscriptions ou clients indisponibles : écrans vides plutôt que bloqués.
  }
  return s;
}

async function db(): Promise<Store> {
  if (store) return store;
  seeding ??= seed();
  store = await seeding;
  return store;
}

function makeReminder(
  s: Store,
  inv: StoredInvoice,
  level: number,
  channel: ReminderChannel,
  due: number,
  daysOverdue: number,
  opts: { at?: string; actor?: string; message?: string } = {},
): Reminder {
  const contact = s.contacts[inv.organizationId];
  const recipient = (channel === "email" ? contact?.email : contact?.phone) ?? null;
  return {
    id: mockId(),
    invoiceId: inv.id,
    invoiceNumber: inv.number ?? "",
    organizationId: inv.organizationId,
    organization: inv.organization,
    level,
    channel,
    recipient: recipient ?? "—",
    amountDue: due,
    daysOverdue: Math.max(0, daysOverdue),
    currency: inv.currency,
    message: opts.message?.trim() || REMINDER_TEMPLATES[level](inv, due),
    sentAt: opts.at ?? mockNow(),
    sentBy: opts.actor ?? ACTOR,
    sendStatus: recipient ? "sent" : "failed",
    error: recipient
      ? null
      : `Aucun ${channel === "email" ? "e-mail" : "numéro de téléphone"} de contact sur l'organisation du client.`,
  };
}

/** Calcule les champs dérivés (statut, solde, retard, relances). */
function hydrate(inv: StoredInvoice, s: Store): Invoice {
  const paidAmount = s.payments
    .filter((p) => p.invoiceId === inv.id && p.status === "confirmed")
    .reduce((sum, p) => sum + p.amount, 0);
  const creditNotes = s.creditNotes.filter((c) => c.invoiceId === inv.id);
  const creditedAmount = creditNotes.reduce((sum, c) => sum + c.amount, 0);
  const balance = inv.lifecycle === "issued" ? Math.max(0, inv.amountTTC - paidAmount - creditedAmount) : 0;
  const sent = s.reminders.filter((r) => r.invoiceId === inv.id && r.sendStatus === "sent");
  const last = sent.reduce<Reminder | null>((acc, r) => (!acc || r.sentAt > acc.sentAt ? r : acc), null);
  const late = Math.max(0, daysBetween(inv.dueDate, todayIso()));

  let status: InvoiceStatus;
  if (inv.lifecycle === "draft") status = "draft";
  else if (inv.lifecycle === "cancelled") status = "cancelled";
  else if (balance === 0) status = "paid";
  else if (late > 0) status = "overdue";
  else if (paidAmount > 0) status = "partial";
  else status = "unpaid";

  return {
    ...mockClone(inv),
    status,
    paidAmount,
    creditedAmount,
    balance,
    daysOverdue: status === "overdue" ? late : 0,
    reminderLevel: last?.level ?? 0,
    lastReminderAt: last?.sentAt ?? null,
    creditNotes: mockClone(creditNotes),
  };
}

function matches(search: string | undefined, ...fields: Array<string | null>): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

async function findInvoice(id: string): Promise<{ s: Store; inv: StoredInvoice }> {
  const s = await db();
  const inv = s.invoices.find((i) => i.id === id);
  if (!inv) throw new ApiError(404, "E_NOT_FOUND", "Facture introuvable.");
  return { s, inv };
}

function inRange(date: string, from?: string, to?: string): boolean {
  return (!from || date >= from) && (!to || date <= to);
}

function validateDraft(payload: InvoiceDraftPayload) {
  if (payload.periodEnd < payload.periodStart) {
    throw new ApiError(422, "E_VALIDATION", "La fin de période précède son début.");
  }
  if (payload.dueDate < payload.issueDate) {
    throw new ApiError(422, "E_VALIDATION", "L'échéance précède la date d'émission.");
  }
  if (payload.unitPrice < 0 || payload.discountPercent < 0 || payload.discountPercent > 100 || payload.taxRate < 0) {
    throw new ApiError(422, "E_VALIDATION", "Tarif, remise ou taxe invalide.");
  }
}

function kindLabel(kind: InvoiceKind): string {
  if (kind === "complement") return " (complément)";
  if (kind === "correction") return " (correction)";
  return "";
}

export const billingService = {
  // ── Factures ───────────────────────────────────────────────────────────────

  /** GET /admin/billing/invoices */
  async listInvoices(params: InvoiceListParams = {}): Promise<Paginated<Invoice>> {
    await mockDelay();
    const s = await db();
    const rows = s.invoices
      .map((inv) => hydrate(inv, s))
      .filter(
        (inv) =>
          (!params.status || inv.status === params.status) &&
          (!params.organizationId || inv.organizationId === params.organizationId) &&
          (!params.subscriptionId || inv.subscriptionId === params.subscriptionId) &&
          (!params.openOnly || inv.balance > 0) &&
          inRange(inv.issueDate, params.from, params.to) &&
          matches(params.search, inv.number, inv.organization.name, inv.subscriptionReference, inv.periodLabel),
      )
      .sort(
        (a, b) =>
          b.daysOverdue - a.daysOverdue ||
          b.issueDate.localeCompare(a.issueDate) ||
          (b.number ?? "").localeCompare(a.number ?? ""),
      );
    return mockPaginate(rows, params);
  },

  /** GET /admin/billing/invoices/:id */
  async getInvoice(id: string): Promise<Invoice> {
    await mockDelay();
    const { s, inv } = await findInvoice(id);
    return hydrate(inv, s);
  },

  /** GET /admin/billing/stats?from=&to= — tableau de bord financier (écran 1). */
  async stats(params: BillingStatsParams = {}): Promise<BillingStats> {
    await mockDelay(200);
    const s = await db();
    const invoices = s.invoices
      .map((inv) => hydrate(inv, s))
      .filter((inv) => inv.status !== "cancelled" && inRange(inv.issueDate, params.from, params.to));
    const issued = invoices.filter((inv) => inv.status !== "draft");
    const counts = { draft: 0, unpaid: 0, partial: 0, overdue: 0, paid: 0 };
    for (const inv of invoices) {
      if (inv.status !== "cancelled") counts[inv.status] += 1;
    }
    return {
      currency: s.invoices[0]?.currency ?? "XOF",
      totalInvoiced: issued.reduce((sum, i) => sum + i.amountTTC, 0),
      totalCollected: issued.reduce((sum, i) => sum + i.paidAmount, 0),
      totalCredited: issued.reduce((sum, i) => sum + i.creditedAmount, 0),
      totalDue: issued.reduce((sum, i) => sum + i.balance, 0),
      overdueAmount: issued.filter((i) => i.status === "overdue").reduce((sum, i) => sum + i.balance, 0),
      counts,
    };
  },

  /**
   * GET /admin/billing/invoices/preview?subscriptionId=&periodStart=&periodEnd=
   * Préremplissage de l'écran 3 depuis la souscription. Sans période : cycle en cours.
   */
  async preview(subscriptionId: string, periodStart?: string, periodEnd?: string): Promise<InvoicePreview> {
    await mockDelay(200);
    const s = await db();
    const sub = await subscriptionService.get(subscriptionId);
    let start = periodStart;
    let end = periodEnd;
    if (!start || !end) {
      // Cycle qui contient aujourd'hui, aligné sur le mois de début de la souscription.
      let month = monthOffset(0);
      for (let i = 0; i < MONTHS_PER_PERIOD[sub.periodicity] && !cycleStartingIn(sub, month); i += 1) {
        month = monthOffset(-1, month);
      }
      start = month;
      end = periodEndFor(month, sub.periodicity);
    }
    const unitPrice = subscriptionUnitPrice(sub);
    const dup = findDuplicate(s, sub.id, start, end);
    return {
      subscriptionId: sub.id,
      subscriptionReference: sub.reference,
      organization: sub.organization,
      offer: sub.offer,
      periodStart: start,
      periodEnd: end,
      periodLabel: periodLabel(start, end),
      lines: buildInvoiceLines(sub.assignments, start, end, unitPrice, mockId),
      unitPrice,
      discountPercent: sub.discountPercent,
      taxRate: DEFAULT_TAX_RATE,
      currency: sub.currency,
      duplicateOf: dup ? { id: dup.id, number: dup.number } : null,
    };
  },

  /** POST /admin/billing/invoices — crée un brouillon (et l'émet si `issue`). */
  async createInvoice(payload: InvoiceDraftPayload): Promise<Invoice> {
    await mockDelay();
    validateDraft(payload);
    const s = await db();
    const sub = await subscriptionService.get(payload.subscriptionId);
    if (payload.kind === "standard") {
      const dup = findDuplicate(s, sub.id, payload.periodStart, payload.periodEnd);
      if (dup) {
        throw new ApiError(
          409,
          "E_INVOICE_DUPLICATE",
          `Une facture existe déjà pour ${sub.reference} sur cette période (${dup.number ?? "brouillon"}). Choisissez « Complément » ou « Correction » si c'est voulu.`,
        );
      }
    }
    const inv = buildInvoice(sub, { ...payload, observations: payload.observations ?? null });
    if (inv.lines.length === 0) throw new ApiError(422, "E_VALIDATION", "Sélectionnez au moins un véhicule.");
    inv.history[0] = event("Création", `Brouillon${kindLabel(payload.kind)} créé pour ${inv.periodLabel}.`);
    s.invoices.push(inv);
    if (payload.issue) issueInvoice(s, inv);
    return hydrate(inv, s);
  },

  /** PUT /admin/billing/invoices/:id — brouillon uniquement (règle 6). */
  async updateDraft(id: string, payload: InvoiceDraftPayload): Promise<Invoice> {
    await mockDelay();
    validateDraft(payload);
    const { s, inv } = await findInvoice(id);
    if (inv.lifecycle !== "draft") {
      throw new ApiError(409, "E_INVOICE_LOCKED", "Une facture émise ne se modifie pas : émettez un avoir.");
    }
    const sub = await subscriptionService.get(inv.subscriptionId);
    if (payload.kind === "standard") {
      const dup = findDuplicate(s, sub.id, payload.periodStart, payload.periodEnd, inv.id);
      if (dup) {
        throw new ApiError(
          409,
          "E_INVOICE_DUPLICATE",
          `Une facture existe déjà sur cette période (${dup.number ?? "brouillon"}).`,
        );
      }
    }
    const rebuilt = buildInvoice(sub, { ...payload, observations: payload.observations ?? null });
    if (rebuilt.lines.length === 0) throw new ApiError(422, "E_VALIDATION", "Sélectionnez au moins un véhicule.");
    Object.assign(inv, {
      ...rebuilt,
      id: inv.id,
      createdAt: inv.createdAt,
      updatedAt: mockNow(),
      history: [...inv.history, event("Modification", "Brouillon modifié.")],
    });
    if (payload.issue) issueInvoice(s, inv);
    return hydrate(inv, s);
  },

  /** POST /admin/billing/invoices/:id/issue */
  async issue(id: string): Promise<Invoice> {
    await mockDelay();
    const { s, inv } = await findInvoice(id);
    if (inv.lifecycle !== "draft") throw new ApiError(409, "E_INVOICE_LOCKED", "Seul un brouillon peut être émis.");
    if (inv.lines.length === 0) throw new ApiError(422, "E_VALIDATION", "La facture ne contient aucun véhicule.");
    issueInvoice(s, inv);
    return hydrate(inv, s);
  },

  /**
   * POST /admin/billing/invoices/:id/cancel
   * Brouillon : abandonné. Émise sans paiement : annulée par un avoir du montant restant.
   * Émise avec paiements : refusé, il faut d'abord annuler les paiements ou émettre un avoir partiel.
   */
  async cancel(id: string, reason: string): Promise<Invoice> {
    await mockDelay();
    const { s, inv } = await findInvoice(id);
    const current = hydrate(inv, s);
    if (inv.lifecycle === "cancelled") throw new ApiError(409, "E_ALREADY_CANCELLED", "Facture déjà annulée.");
    const wasDraft = inv.lifecycle === "draft";
    if (!wasDraft) {
      if (current.paidAmount > 0) {
        throw new ApiError(
          409,
          "E_INVOICE_HAS_PAYMENTS",
          "Des paiements sont imputés sur cette facture : annulez-les d'abord ou émettez un avoir partiel.",
        );
      }
      if (current.balance > 0) {
        s.creditNotes.push({
          id: mockId(),
          number: nextNumber(s, "AV", todayIso()),
          invoiceId: inv.id,
          invoiceNumber: inv.number as string,
          organizationId: inv.organizationId,
          organization: inv.organization,
          amount: current.balance,
          currency: inv.currency,
          reason: `Annulation : ${reason}`,
          createdAt: mockNow(),
          createdBy: ACTOR,
        });
      }
    }
    inv.lifecycle = "cancelled";
    inv.cancelReason = reason;
    inv.updatedAt = mockNow();
    inv.history.push(
      event("Annulation", wasDraft ? `Brouillon abandonné : ${reason}` : `Facture annulée par avoir total : ${reason}`),
    );
    return hydrate(inv, s);
  },

  /** POST /admin/billing/invoices/:id/credit-notes — avoir partiel ou total, plafonné au reste à payer. */
  async createCreditNote(id: string, amount: number, reason: string): Promise<CreditNote> {
    await mockDelay();
    const { s, inv } = await findInvoice(id);
    const current = hydrate(inv, s);
    if (inv.lifecycle !== "issued") {
      throw new ApiError(409, "E_INVOICE_LOCKED", "Un avoir porte sur une facture émise.");
    }
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(422, "E_VALIDATION", "Montant invalide.");
    if (amount > current.balance) {
      throw new ApiError(
        422,
        "E_AMOUNT_EXCEEDS_DUE",
        `L'avoir dépasse le reste à payer (${fmt(current.balance)} ${inv.currency}). Un trop-perçu se traite en remboursement.`,
      );
    }
    const note: CreditNote = {
      id: mockId(),
      number: nextNumber(s, "AV", todayIso()),
      invoiceId: inv.id,
      invoiceNumber: inv.number as string,
      organizationId: inv.organizationId,
      organization: inv.organization,
      amount: Math.round(amount),
      currency: inv.currency,
      reason,
      createdAt: mockNow(),
      createdBy: ACTOR,
    };
    s.creditNotes.push(note);
    inv.updatedAt = mockNow();
    inv.history.push(event("Avoir", `Avoir ${note.number} de ${fmt(note.amount)} ${note.currency} : ${reason}`));
    return mockClone(note);
  },

  /** POST /admin/billing/invoices/:id/send — envoi par e-mail (passerelle e-mail simulée). */
  async emailInvoice(id: string, to: string): Promise<Invoice> {
    await mockDelay(500);
    const { s, inv } = await findInvoice(id);
    if (inv.lifecycle !== "issued") {
      throw new ApiError(409, "E_INVOICE_LOCKED", "Seule une facture émise peut être envoyée.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ApiError(422, "E_VALIDATION", "Adresse e-mail invalide.");
    inv.emailedAt = mockNow();
    inv.emailedTo = to;
    inv.history.push(event("Envoi", `Facture envoyée par e-mail à ${to}.`));
    return hydrate(inv, s);
  },

  /** E-mail de contact connu pour le client (préremplissage de l'envoi). */
  async contactEmail(organizationId: string): Promise<string | null> {
    return (await db()).contacts[organizationId]?.email ?? null;
  },

  /**
   * POST /admin/billing/invoices/generate — génération automatique d'un mois.
   * Une facture par souscription active dont un cycle commence ce mois-là ; les périodes
   * déjà facturées sont ignorées (règle 9).
   */
  async generate(payload: GenerateInvoicesPayload): Promise<GenerateInvoicesResult> {
    await mockDelay(600);
    const s = await db();
    const subs = (await subscriptionService.list({ status: "active", perPage: 100 })).data;
    const result: GenerateInvoicesResult = { created: [], skipped: [] };
    for (const sub of subs) {
      const cycle = cycleStartingIn(sub, payload.month);
      if (!cycle) continue;
      const dup = findDuplicate(s, sub.id, cycle.start, cycle.end);
      if (dup) {
        result.skipped.push({
          subscriptionReference: sub.reference,
          reason: `Déjà facturée (${dup.number ?? "brouillon en cours"}).`,
        });
        continue;
      }
      const inv = buildInvoice(sub, { kind: "standard", periodStart: cycle.start, periodEnd: cycle.end });
      if (inv.lines.length === 0) {
        result.skipped.push({ subscriptionReference: sub.reference, reason: "Aucun véhicule affecté sur la période." });
        continue;
      }
      inv.history[0] = event("Génération", `Brouillon généré automatiquement pour ${inv.periodLabel}.`);
      s.invoices.push(inv);
      if (payload.issue) issueInvoice(s, inv);
      result.created.push({ id: inv.id, label: `${inv.number ?? "Brouillon"} · ${sub.organization.name}` });
    }
    return result;
  },

  // ── Paiements ──────────────────────────────────────────────────────────────

  /** GET /admin/billing/payment-methods */
  async paymentMethods(): Promise<PaymentMethod[]> {
    await mockDelay(100);
    return mockClone((await db()).methods);
  },

  /** POST /admin/billing/payment-methods — « autres moyens configurables » (Paramètres › Référentiels). */
  async addPaymentMethod(label: string): Promise<PaymentMethod> {
    await mockDelay(200);
    const s = await db();
    const clean = label.trim();
    if (!clean) throw new ApiError(422, "E_VALIDATION", "Libellé obligatoire.");
    if (s.methods.some((m) => m.label.toLowerCase() === clean.toLowerCase())) {
      throw new ApiError(409, "E_DUPLICATE", `« ${clean} » existe déjà.`);
    }
    const method: PaymentMethod = { id: mockId(), label: clean, active: true };
    s.methods.push(method);
    return mockClone(method);
  },

  /** PATCH /admin/billing/payment-methods/:id — désactiver ne touche pas aux paiements passés. */
  async updatePaymentMethod(id: string, patch: { label?: string; active?: boolean }): Promise<PaymentMethod> {
    await mockDelay(200);
    const method = (await db()).methods.find((m) => m.id === id);
    if (!method) throw new ApiError(404, "E_NOT_FOUND", "Mode de paiement introuvable.");
    if (patch.label !== undefined && patch.label.trim()) method.label = patch.label.trim();
    if (patch.active !== undefined) method.active = patch.active;
    return mockClone(method);
  },

  /** GET /admin/billing/payments */
  async listPayments(params: PaymentListParams = {}): Promise<Paginated<Payment>> {
    await mockDelay();
    const rows = (await db()).payments
      .filter(
        (p) =>
          (!params.status || p.status === params.status) &&
          (!params.methodId || p.methodId === params.methodId) &&
          (!params.organizationId || p.organizationId === params.organizationId) &&
          (!params.invoiceId || p.invoiceId === params.invoiceId) &&
          matches(params.search, p.reference, p.invoiceNumber, p.organization.name, p.transactionRef),
      )
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));
    return mockPaginate(rows, params);
  },

  /** POST /admin/billing/payments — paiement total ou partiel (règle 5 : le solde suit). */
  async recordPayment(payload: RecordPaymentPayload): Promise<Payment> {
    await mockDelay();
    const { s, inv } = await findInvoice(payload.invoiceId);
    const current = hydrate(inv, s);
    if (inv.lifecycle !== "issued") {
      throw new ApiError(409, "E_INVOICE_NOT_ISSUED", "Un paiement s'impute sur une facture émise.");
    }
    if (current.balance <= 0) throw new ApiError(409, "E_INVOICE_SETTLED", `La facture ${inv.number} est déjà soldée.`);
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      throw new ApiError(422, "E_VALIDATION", "Le montant doit être supérieur à 0.");
    }
    if (payload.amount > current.balance) {
      throw new ApiError(
        422,
        "E_AMOUNT_EXCEEDS_DUE",
        `Le montant dépasse le reste à payer (${fmt(current.balance)} ${inv.currency}).`,
      );
    }
    const method = s.methods.find((m) => m.id === payload.methodId && m.active);
    if (!method) throw new ApiError(422, "E_VALIDATION", "Mode de paiement inconnu ou désactivé.");
    const amount = Math.round(payload.amount);
    const payment: Payment = {
      id: mockId(),
      reference: nextNumber(s, "PAY", payload.paidAt),
      invoiceId: inv.id,
      invoiceNumber: inv.number as string,
      organizationId: inv.organizationId,
      organization: inv.organization,
      amount,
      currency: inv.currency,
      methodId: method.id,
      methodLabel: method.label,
      paidAt: payload.paidAt,
      transactionRef: payload.transactionRef?.trim() || null,
      attachment: payload.attachment ?? null,
      comment: payload.comment?.trim() || null,
      status: "confirmed",
      cancelReason: null,
      recordedBy: ACTOR,
      createdAt: mockNow(),
    };
    s.payments.push(payment);
    const partial = amount < current.balance;
    inv.history.push(
      event(
        "Paiement",
        `${partial ? "Paiement partiel" : "Paiement"} ${payment.reference} de ${fmt(amount)} ${inv.currency} (${method.label}).`,
      ),
    );
    return mockClone(payment);
  },

  /** POST /admin/billing/payments/:id/cancel — le paiement reste visible ; la facture redevient ouverte. */
  async cancelPayment(id: string, reason: string): Promise<Payment> {
    await mockDelay();
    const s = await db();
    const payment = s.payments.find((p) => p.id === id);
    if (!payment) throw new ApiError(404, "E_NOT_FOUND", "Paiement introuvable.");
    if (payment.status === "cancelled") throw new ApiError(409, "E_ALREADY_CANCELLED", "Paiement déjà annulé.");
    payment.status = "cancelled";
    payment.cancelReason = reason;
    s.invoices
      .find((i) => i.id === payment.invoiceId)
      ?.history.push(event("Paiement annulé", `Paiement ${payment.reference} annulé : ${reason}`));
    return mockClone(payment);
  },

  // ── Relances ───────────────────────────────────────────────────────────────

  /** GET /admin/billing/reminders */
  async listReminders(params: ReminderListParams = {}): Promise<Paginated<Reminder>> {
    await mockDelay();
    const rows = (await db()).reminders
      .filter(
        (r) =>
          (!params.channel || r.channel === params.channel) &&
          (!params.sendStatus || r.sendStatus === params.sendStatus) &&
          (!params.organizationId || r.organizationId === params.organizationId) &&
          matches(params.search, r.invoiceNumber, r.organization.name),
      )
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return mockPaginate(rows, params);
  },

  /** POST /admin/billing/reminders — une relance par facture et par canal, au niveau suivant. */
  async sendReminders(payload: SendRemindersPayload): Promise<Reminder[]> {
    await mockDelay(500);
    if (payload.invoiceIds.length === 0) throw new ApiError(422, "E_VALIDATION", "Aucune facture sélectionnée.");
    if (payload.channels.length === 0) throw new ApiError(422, "E_VALIDATION", "Choisissez au moins un canal.");
    const s = await db();
    const sent: Reminder[] = [];
    for (const id of payload.invoiceIds) {
      const { inv } = await findInvoice(id);
      const current = hydrate(inv, s);
      if (current.balance <= 0 || inv.lifecycle !== "issued") {
        throw new ApiError(409, "E_INVOICE_SETTLED", `La facture ${inv.number ?? ""} n'a rien à relancer.`);
      }
      const level = Math.min(MAX_REMINDER_LEVEL, current.reminderLevel + 1);
      for (const channel of payload.channels) {
        sent.push(
          makeReminder(s, inv, level, channel, current.balance, current.daysOverdue, { message: payload.message }),
        );
      }
      inv.history.push(event("Relance", `Relance de niveau ${level} (${payload.channels.join(" + ")}).`));
    }
    s.reminders.push(...sent);
    return mockClone(sent);
  },

  /** POST /admin/billing/reminders/:id/retry — renvoi d'une relance en échec (contact corrigé entre-temps). */
  async retryReminder(id: string): Promise<Reminder> {
    await mockDelay(400);
    const s = await db();
    const failed = s.reminders.find((r) => r.id === id);
    if (!failed) throw new ApiError(404, "E_NOT_FOUND", "Relance introuvable.");
    if (failed.sendStatus !== "failed") throw new ApiError(409, "E_ALREADY_SENT", "Cette relance a déjà été envoyée.");
    const { inv } = await findInvoice(failed.invoiceId);
    const current = hydrate(inv, s);
    const retry = makeReminder(s, inv, failed.level, failed.channel, current.balance, current.daysOverdue, {
      message: failed.message,
    });
    s.reminders.push(retry);
    return mockClone(retry);
  },
};
