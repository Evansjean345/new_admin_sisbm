"use client";

import { useState } from "react";

import { FlaskConical, Package, Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOfferFeatures, useOffers } from "@/hooks/api/use-offers";

import { FeatureMatrix } from "./feature-matrix";
import { OfferCard } from "./offer-card";
import { OfferFormDialog } from "./offer-form-dialog";

export function Offers() {
  const [createOpen, setCreateOpen] = useState(false);
  const offers = useOffers({ perPage: 100 });
  const features = useOfferFeatures();

  const rows = offers.data?.data ?? [];
  const featureList = features.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Catalogue des offres"
        description="Offres commerciales, tarifs de référence et fonctionnalités incluses."
        actions={
          <>
            <Button variant="outline" onClick={() => offers.refetch()} disabled={offers.isFetching}>
              <RefreshCw data-icon="inline-start" className={offers.isFetching ? "animate-spin" : undefined} />
              Actualiser
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Nouvelle offre
            </Button>
          </>
        }
      />

      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          L'API des offres n'est pas encore disponible : les modifications sont perdues au rechargement de la page.
        </AlertDescription>
      </Alert>

      {offers.isPending || features.isPending ? (
        <Card>
          <CardContent>
            <LoadingRows rows={6} />
          </CardContent>
        </Card>
      ) : offers.isError ? (
        <ErrorState error={offers.error} onRetry={() => offers.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Aucune offre"
          description="Créez la première offre du catalogue."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Nouvelle offre
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {rows.map((offer) => (
              <OfferCard key={offer.id} offer={offer} featureCount={featureList.length} />
            ))}
          </div>
          <FeatureMatrix offers={rows} features={featureList} />
        </>
      )}

      <OfferFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
