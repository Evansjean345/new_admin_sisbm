import type { InvoiceLine, InvoiceTotals } from "@/types/billing";
import type { OfferPeriodicity } from "@/types/offer";
import type { VehicleAssignment } from "@/types/subscription";

/**
 * Calculs de facturation PURS, partagés par le service (simulé aujourd'hui, serveur demain)
 * et par le formulaire de création, pour que l'aperçu affiche exactement ce qui sera enregistré.
 */

/** TVA par défaut (Côte d'Ivoire). Modifiable par facture ; à terme dans Paramètres › Paramètres tarifaires. */
export const DEFAULT_TAX_RATE = 18;

/** Délai de paiement par défaut entre émission et échéance, en jours. */
export const DEFAULT_PAYMENT_TERM_DAYS = 30;

export const MONTHS_PER_PERIOD: Record<OfferPeriodicity, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

const DAY = 86_400_000;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entre deux dates, bornes incluses (01 → 31 = 31 jours). */
export function daysInclusive(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 1;
}

/** Jours écoulés de `from` à `to` (négatif si `to` est avant `from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/** Dernier jour d'une période qui commence à `start` (AAAA-MM-01) selon la périodicité. */
export function periodEndFor(start: string, periodicity: OfferPeriodicity): string {
  const d = new Date(`${start}T00:00:00.000Z`);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + MONTHS_PER_PERIOD[periodicity], 0));
  return end.toISOString().slice(0, 10);
}

/** Premier jour du mois d'une date. */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function monthName(date: string): string {
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** « Octobre 2026 », « Octobre 2026 – Décembre 2026 » ou « 15/10/2026 – 31/10/2026 ». */
export function periodLabel(start: string, end: string): string {
  const fullMonths = start.endsWith("-01") && addDaysIso(end, 1).endsWith("-01");
  if (fullMonths) {
    return start.slice(0, 7) === end.slice(0, 7) ? monthName(start) : `${monthName(start)} – ${monthName(end)}`;
  }
  const fr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  return `${fr(start)} – ${fr(end)}`;
}

/**
 * Lignes de facture d'une période : une par affectation qui la chevauche, au prorata des jours.
 *
 * `endDate` d'une affectation clôturée = date d'effet de la clôture, EXCLUE : lors d'un changement
 * d'offre, l'ancienne affectation s'arrête la veille et la nouvelle commence le jour même.
 * Aucun jour n'est donc facturé deux fois.
 */
export function buildInvoiceLines(
  assignments: VehicleAssignment[],
  periodStart: string,
  periodEnd: string,
  unitPrice: number,
  makeId: () => string,
): InvoiceLine[] {
  const periodDays = daysInclusive(periodStart, periodEnd);
  const lines: InvoiceLine[] = [];
  for (const a of assignments) {
    const start = a.startDate > periodStart ? a.startDate : periodStart;
    const lastDay = a.endDate ? addDaysIso(a.endDate, -1) : periodEnd;
    const end = lastDay < periodEnd ? lastDay : periodEnd;
    if (end < start) continue;
    const days = daysInclusive(start, end);
    lines.push({
      id: makeId(),
      vehicleId: a.vehicleId,
      registration: a.registration,
      label: a.label,
      startDate: start,
      endDate: end,
      days,
      periodDays,
      unitPrice,
      amount: Math.round((unitPrice * days) / periodDays),
    });
  }
  return lines.sort((x, y) => x.registration.localeCompare(y.registration) || x.startDate.localeCompare(y.startDate));
}

/** Change le tarif unitaire de toutes les lignes en gardant leur prorata. */
export function repriceLines(lines: InvoiceLine[], unitPrice: number): InvoiceLine[] {
  return lines.map((l) => ({ ...l, unitPrice, amount: Math.round((unitPrice * l.days) / l.periodDays) }));
}

/** Montants : sous-total des lignes → remise → HT → taxes → TTC (arrondis à l'unité, XOF sans décimales). */
export function computeInvoiceTotals(lines: InvoiceLine[], discountPercent: number, taxRate: number): InvoiceTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const amountHT = subtotal - discountAmount;
  const taxAmount = Math.round((amountHT * taxRate) / 100);
  return { subtotal, discountAmount, amountHT, taxAmount, amountTTC: amountHT + taxAmount };
}

/** Nombre de véhicules distincts facturés. */
export function vehicleCount(lines: InvoiceLine[]): number {
  return new Set(lines.map((l) => l.vehicleId)).size;
}
