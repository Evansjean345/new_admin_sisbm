import {
  activeVehicleCount,
  effectiveUnitPrice,
  formatMoney,
} from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { DetailList } from "@/components/detail-list";
import { offerPeriodicityLabels, offerPeriodicityShort } from "@/components/status-labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Subscription } from "@/types/subscription";

/** Calcul indicatif : la facture réelle tiendra compte des prorata et changements en cours de période. */
export function PricingTab({ subscription }: { subscription: Subscription }) {
  const unit = effectiveUnitPrice(subscription);
  const vehicles = activeVehicleCount(subscription);
  const period = offerPeriodicityShort[subscription.periodicity];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarification</CardTitle>
        <CardDescription>
          Ordre de calcul : tarif négocié (ou de référence), puis remise, multiplié par le nombre de véhicules actifs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <DetailList
          items={[
            { label: "Tarif de référence", value: formatMoney(subscription.referencePrice, subscription.currency) },
            {
              label: "Tarif négocié",
              value:
                subscription.negotiatedPrice === null
                  ? "Aucun"
                  : formatMoney(subscription.negotiatedPrice, subscription.currency),
            },
            { label: "Remise", value: `${subscription.discountPercent} %` },
            { label: "Périodicité", value: offerPeriodicityLabels[subscription.periodicity] },
            { label: "Tarif appliqué par véhicule", value: `${formatMoney(unit, subscription.currency)} / ${period}` },
            { label: "Véhicules actifs", value: vehicles },
          ]}
        />
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-4">
          <span className="text-muted-foreground text-xs">Montant estimé par {period} (HT)</span>
          <span className="font-medium text-2xl tabular-nums">
            {formatMoney(unit * vehicles, subscription.currency)}
          </span>
          <span className="text-muted-foreground text-xs">
            {vehicles} × {formatMoney(unit, subscription.currency)} — taxes et prorata calculés à la facturation.
          </span>
        </div>
        {subscription.specialConditions ? (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Conditions particulières</span>
            <p className="whitespace-pre-line text-sm">{subscription.specialConditions}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
