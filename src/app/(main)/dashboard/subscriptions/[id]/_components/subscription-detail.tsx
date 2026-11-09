"use client";

import Link from "next/link";

import { ArrowLeft, CalendarRange, FileText, Package, ReceiptText, RefreshCw, Truck, Wallet } from "lucide-react";

import { SubscriptionRowActions } from "@/app/(main)/dashboard/_components/subscriptions/subscription-row-actions";
import {
  activeVehicleCount,
  formatUnitPrice,
} from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { DetailList } from "@/components/detail-list";
import { MetricCard, metricGridClass } from "@/components/metric-card";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { offerPeriodicityLabels, subscriptionStatusMeta } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubscription } from "@/hooks/api/use-subscriptions";
import { formatDate, formatDateTime } from "@/lib/format";

import { HistoryTab } from "./history-tab";
import { OfferTab } from "./offer-tab";
import { PricingTab } from "./pricing-tab";
import { VehiclesTab } from "./vehicles-tab";

/** Détail d'une souscription : les 7 onglets du §III.4. */
export function SubscriptionDetail({ id }: { id: string }) {
  const subscription = useSubscription(id);

  if (subscription.isPending) return <LoadingRows rows={8} />;
  if (subscription.isError) {
    return (
      <ErrorState error={subscription.error} onRetry={() => subscription.refetch()} title="Souscription indisponible" />
    );
  }

  const data = subscription.data;
  const status = subscriptionStatusMeta[data.status];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/subscriptions" prefetch={false}>
            <ArrowLeft data-icon="inline-start" />
            Souscriptions
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-medium font-mono text-2xl leading-none tracking-tight sm:text-3xl">{data.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <Link href={`/dashboard/entreprises/${data.organizationId}`} prefetch={false} className="hover:underline">
              {data.organization.name}
            </Link>
            <span>·</span>
            <span>Offre {data.offer.name}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => subscription.refetch()} disabled={subscription.isFetching}>
            <RefreshCw className={subscription.isFetching ? "animate-spin" : undefined} />
            <span className="sr-only">Actualiser</span>
          </Button>
          <SubscriptionRowActions subscription={data} showView={false} />
        </div>
      </div>

      <div className={metricGridClass}>
        <MetricCard icon={Package} label="Offre" value={data.offer.name} hint={`Code ${data.offer.code}`} />
        <MetricCard
          icon={Truck}
          label="Véhicules actifs"
          value={activeVehicleCount(data)}
          hint={`${data.assignments.length} affectation(s) au total`}
        />
        <MetricCard icon={Wallet} label="Tarif appliqué" value={formatUnitPrice(data)} hint="Par véhicule." />
        <MetricCard
          icon={CalendarRange}
          label="Échéance"
          value={data.endDate ? formatDate(data.endDate) : "Aucune"}
          hint={`Depuis le ${formatDate(data.startDate)}`}
        />
      </div>

      <Tabs defaultValue="general">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="general">Informations</TabsTrigger>
            <TabsTrigger value="offer">Offre</TabsTrigger>
            <TabsTrigger value="vehicles">Véhicules</TabsTrigger>
            <TabsTrigger value="pricing">Tarification</TabsTrigger>
            <TabsTrigger value="billing">Facturation</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                items={[
                  { label: "Référence", value: data.reference, mono: true },
                  { label: "Client", value: data.organization.name },
                  { label: "Code client", value: data.organization.code, mono: true },
                  { label: "Offre", value: data.offer.name },
                  { label: "Statut", value: status.label },
                  { label: "Périodicité", value: offerPeriodicityLabels[data.periodicity] },
                  { label: "Date de début", value: formatDate(data.startDate) },
                  { label: "Fin ou échéance", value: data.endDate ? formatDate(data.endDate) : "Sans échéance" },
                  { label: "Créée le", value: formatDateTime(data.createdAt) },
                  { label: "Dernière modification", value: formatDateTime(data.updatedAt) },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="offer" className="pt-4">
          <OfferTab subscription={data} />
        </TabsContent>
        <TabsContent value="vehicles" className="pt-4">
          <VehiclesTab subscription={data} />
        </TabsContent>
        <TabsContent value="pricing" className="pt-4">
          <PricingTab subscription={data} />
        </TabsContent>
        <TabsContent value="billing" className="pt-4">
          <EmptyState
            icon={<ReceiptText />}
            title="Facturation à venir"
            description="Les factures de cette souscription apparaîtront ici avec le module Facturation (phase 11)."
          />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <HistoryTab subscription={data} />
        </TabsContent>
        <TabsContent value="documents" className="pt-4">
          <EmptyState
            icon={<FileText />}
            title="Aucun document contractuel"
            description="Le dépôt de contrats et d'avenants sera disponible avec l'API de stockage."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
