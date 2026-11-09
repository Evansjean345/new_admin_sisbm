import { offerPeriodicityShort } from "@/components/status-labels";
import { formatNumber } from "@/lib/format";
import type { Subscription } from "@/types/subscription";

/** Tarif unitaire appliqué : tarif négocié (sinon référence), puis remise. */
export function effectiveUnitPrice(
  sub: Pick<Subscription, "referencePrice" | "negotiatedPrice" | "discountPercent">,
): number {
  const base = sub.negotiatedPrice ?? sub.referencePrice;
  return Math.round(base * (1 - sub.discountPercent / 100));
}

export function activeVehicleCount(sub: Pick<Subscription, "assignments">): number {
  return sub.assignments.filter((a) => a.status === "active").length;
}

export function formatMoney(amount: number, currency = "XOF"): string {
  return `${formatNumber(amount)} ${currency}`;
}

/** « 13 500 XOF / mois » */
export function formatUnitPrice(sub: Subscription): string {
  return `${formatMoney(effectiveUnitPrice(sub), sub.currency)} / ${offerPeriodicityShort[sub.periodicity]}`;
}

/** Référence proposée par défaut à la création. */
export function suggestReference(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `SUB-${year}-${suffix}`;
}
