import { offerPeriodicityShort } from "@/components/status-labels";
import { formatNumber } from "@/lib/format";
import type { Offer, OfferFeature } from "@/types/offer";

/** Regroupe les fonctionnalités par module, dans l'ordre du catalogue. */
export function groupFeaturesByModule(features: OfferFeature[]): Array<{ module: string; items: OfferFeature[] }> {
  const groups = new Map<string, OfferFeature[]>();
  for (const feature of features) {
    const items = groups.get(feature.module) ?? [];
    items.push(feature);
    groups.set(feature.module, items);
  }
  return [...groups].map(([module, items]) => ({ module, items }));
}

/** « 15 000 XOF / mois » */
export function formatOfferPrice(offer: Pick<Offer, "referencePrice" | "currency" | "periodicity">): string {
  return `${formatNumber(offer.referencePrice)} ${offer.currency} / ${offerPeriodicityShort[offer.periodicity]}`;
}

/** null = illimité. */
export function formatLimit(value: number | null, unit: string): string {
  return value === null ? "Illimité" : `${formatNumber(value)} ${unit}`;
}
