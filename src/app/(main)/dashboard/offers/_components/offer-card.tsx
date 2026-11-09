import { formatLimit, formatOfferPrice } from "@/app/(main)/dashboard/_components/offers/offer-utils";
import { StatusBadge } from "@/components/status-badge";
import { offerStatusMeta } from "@/components/status-labels";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import type { Offer } from "@/types/offer";

import { OfferRowActions } from "./offer-row-actions";

export function OfferCard({ offer, featureCount }: { offer: Offer; featureCount: number }) {
  const meta = offerStatusMeta[offer.status];
  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription className="font-mono text-xs">{offer.code}</CardDescription>
        <CardTitle className="text-xl">{offer.name}</CardTitle>
        <CardAction>
          <OfferRowActions offer={offer} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-lg tabular-nums">{formatOfferPrice(offer)}</span>
          <span className="text-muted-foreground text-xs">par véhicule</span>
        </div>
        {offer.description ? <p className="text-muted-foreground text-sm">{offer.description}</p> : null}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Souscriptions</dt>
            <dd className="tabular-nums">{formatNumber(offer.stats.subscriptions)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Véhicules</dt>
            <dd className="tabular-nums">{formatNumber(offer.stats.vehicles)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Fonctionnalités</dt>
            <dd className="tabular-nums">
              {offer.featureKeys.length} / {featureCount}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Historique GPS</dt>
            <dd>{formatLimit(offer.limitations.historyDays, "jours")}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          <span className="text-muted-foreground text-xs">
            {offer.launchDate ? `Depuis le ${formatDate(offer.launchDate)}` : "Non commercialisée"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
