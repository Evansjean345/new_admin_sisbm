"use client";

import Link from "next/link";

import { Check, Cpu } from "lucide-react";

import { formatLimit, groupFeaturesByModule } from "@/app/(main)/dashboard/_components/offers/offer-utils";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { DetailList } from "@/components/detail-list";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { offerPeriodicityLabels, offerStatusMeta } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOffer, useOfferFeatures } from "@/hooks/api/use-offers";
import type { Subscription } from "@/types/subscription";

/** Offre souscrite et fonctionnalités qu'elle ouvre aux véhicules affectés. */
export function OfferTab({ subscription }: { subscription: Subscription }) {
  const offer = useOffer(subscription.offerId);
  const features = useOfferFeatures();

  if (offer.isPending || features.isPending) return <LoadingRows rows={5} />;
  if (offer.isError) return <ErrorState error={offer.error} onRetry={() => offer.refetch()} />;

  const data = offer.data;
  const included = new Set(data.featureKeys);
  const modules = groupFeaturesByModule((features.data ?? []).filter((f) => included.has(f.key)));
  const status = offerStatusMeta[data.status];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {data.name} <span className="font-mono text-muted-foreground text-xs">{data.code}</span>
          </CardTitle>
          <CardDescription>{data.description ?? "Aucune description."}</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/offers" prefetch={false}>
                Catalogue
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DetailList
            items={[
              { label: "Statut au catalogue", value: <StatusBadge tone={status.tone}>{status.label}</StatusBadge> },
              { label: "Tarif actuel du catalogue", value: formatMoney(data.referencePrice, data.currency) },
              { label: "Tarif au moment de la souscription", value: formatMoney(subscription.referencePrice) },
              { label: "Périodicité de l'offre", value: offerPeriodicityLabels[data.periodicity] },
              { label: "Historique GPS", value: formatLimit(data.limitations.historyDays, "jours") },
              { label: "SMS / mois", value: formatLimit(data.limitations.smsPerMonth, "SMS") },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fonctionnalités incluses ({included.size})</CardTitle>
          <CardDescription>
            Droits commerciaux. Un véhicule n'en profite que si son équipement le permet (icône puce).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ module, items }) => (
            <div key={module} className="flex flex-col gap-1.5">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{module}</span>
              {items.map((f) => (
                <span key={f.key} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                  {f.label}
                  {f.requiresHardware ? (
                    <Cpu className="size-3.5 text-muted-foreground" aria-label="Matériel requis" />
                  ) : null}
                </span>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
