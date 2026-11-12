"use client";

import { useState } from "react";

import Link from "next/link";

import {
  ArrowLeft,
  CalendarClock,
  Construction,
  Gauge,
  LayoutDashboard,
  MapPinned,
  UsersRound,
  Workflow,
} from "lucide-react";

import { MetricCard, metricGridClass } from "@/components/metric-card";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDrivers } from "@/hooks/api/use-drivers";
import { useOrganization } from "@/hooks/api/use-organizations";
import { useSchedules } from "@/hooks/api/use-schedules";
import { useSubscriptions } from "@/hooks/api/use-subscriptions";

import { Drivers } from "../../../../driver/_components/drivers";
import { Fleet } from "../../../../fleet/_components/fleet";
import { Schedules } from "../../../../clock/_components/schedules";

type WorkspaceTab = "overview" | "supervision" | "schedules" | "zones" | "speed" | "rules" | "drivers";

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
          <Construction className="size-6" />
        </div>
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="max-w-lg text-muted-foreground text-sm">{description}</p>
        <p className="text-muted-foreground text-xs">
          Cette rubrique est prête dans l’espace du client, mais son module fonctionnel reste à développer.
        </p>
      </CardContent>
    </Card>
  );
}

function ClientOverview({ organizationId, vehicleCount }: { organizationId: string; vehicleCount: number }) {
  const subscriptions = useSubscriptions({ organizationId, status: "active", perPage: 1 });
  const drivers = useDrivers({ organizationId, perPage: 1 });
  const schedules = useSchedules({ organizationId, perPage: 1 });

  return (
    <div className="flex flex-col gap-4">
      {subscriptions.isError ? (
        <ErrorState error={subscriptions.error} onRetry={() => subscriptions.refetch()} />
      ) : null}
      {drivers.isError ? <ErrorState error={drivers.error} onRetry={() => drivers.refetch()} /> : null}
      {schedules.isError ? <ErrorState error={schedules.error} onRetry={() => schedules.refetch()} /> : null}
      <div className={metricGridClass}>
        <MetricCard
          icon={CalendarClock}
          label="Souscriptions actives"
          value={subscriptions.data?.meta.total ?? "—"}
          hint="Contrats actifs pour ce client."
        />
        <MetricCard
          icon={UsersRound}
          label="Conducteurs"
          value={drivers.data?.meta.total ?? "—"}
          hint="Conducteurs rattachés à ce client."
        />
        <MetricCard
          icon={CalendarClock}
          label="Calendriers"
          value={schedules.data?.meta.total ?? "—"}
          hint="Horaires enregistrés pour ce client."
        />
        <MetricCard icon={MapPinned} label="Véhicules" value={vehicleCount} hint="Véhicules rattachés à ce client." />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bienvenue dans l’espace client</CardTitle>
          <CardDescription>
            Les rubriques de supervision, horaires et conducteurs sont filtrées sur cette organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Utilisez les onglets pour consulter les fonctionnalités disponibles pour ce client.
        </CardContent>
      </Card>
    </div>
  );
}

export function ClientWorkspace({ organizationId }: { organizationId: string }) {
  const organization = useOrganization(organizationId);
  const [tab, setTab] = useState<WorkspaceTab>("overview");

  if (organization.isPending) return <LoadingRows rows={8} />;
  if (organization.isError) {
    return (
      <ErrorState
        error={organization.error}
        onRetry={() => organization.refetch()}
        title="Espace client indisponible"
      />
    );
  }

  const client = organization.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
            <Link href={`/dashboard/entreprises/${organizationId}`} prefetch={false}>
              <ArrowLeft data-icon="inline-start" />
              Fiche d’administration
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-medium text-2xl leading-none tracking-tight sm:text-3xl">{client.name}</h1>
            <StatusBadge tone={client.isActive ? "success" : "orange"}>
              {client.isActive ? "Active" : "Désactivée"}
            </StatusBadge>
          </div>
          <p className="font-mono text-muted-foreground text-xs">{client.code}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/entreprises/${organizationId}`} prefetch={false}>
            Retour à la fiche client
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as WorkspaceTab)}>
        <TabsList className="!h-auto !w-full flex-wrap justify-start">
          <TabsTrigger value="overview" className="flex-none">
            <LayoutDashboard data-icon="inline-start" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="supervision" className="flex-none">
            <MapPinned data-icon="inline-start" />
            Supervision
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex-none">
            <CalendarClock data-icon="inline-start" />
            Gestion des horaires
          </TabsTrigger>
          <TabsTrigger value="zones" className="flex-none">
            <MapPinned data-icon="inline-start" />
            Zones géographiques
          </TabsTrigger>
          <TabsTrigger value="speed" className="flex-none">
            <Gauge data-icon="inline-start" />
            Contrôle de vitesse
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex-none">
            <Workflow data-icon="inline-start" />
            Moteur de règles
          </TabsTrigger>
          <TabsTrigger value="drivers" className="flex-none">
            <UsersRound data-icon="inline-start" />
            Conducteurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <ClientOverview organizationId={organizationId} vehicleCount={client.stats.vehicles} />
        </TabsContent>
        <TabsContent value="supervision" className="pt-4">
          <Fleet organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="schedules" className="pt-4">
          <Schedules organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="zones" className="pt-4">
          <ComingSoon
            title="Zones géographiques"
            description="La gestion des zones n’est pas encore disponible pour les organisations clientes."
          />
        </TabsContent>
        <TabsContent value="speed" className="pt-4">
          <ComingSoon
            title="Contrôle de vitesse"
            description="Les réglages et alertes de vitesse ne sont pas encore disponibles dans cette interface."
          />
        </TabsContent>
        <TabsContent value="rules" className="pt-4">
          <ComingSoon
            title="Moteur de règles"
            description="La consultation et la configuration des règles seront ajoutées dans une prochaine étape."
          />
        </TabsContent>
        <TabsContent value="drivers" className="pt-4">
          <Drivers organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
