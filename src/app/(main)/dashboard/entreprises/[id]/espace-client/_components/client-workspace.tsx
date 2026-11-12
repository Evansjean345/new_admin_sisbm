"use client";

import { useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

import { Schedules } from "../../../../clock/_components/schedules";
import { Drivers } from "../../../../driver/_components/drivers";
import { RulesEngine } from "../../../../rules/_components/rules-engine";
import { SpeedControl } from "../../../../speed/_components/speed-control";
import { Zones } from "../../../../zones/_components/zones";

type WorkspaceTab = "overview" | "schedules" | "zones" | "speed" | "rules" | "drivers";
const WORKSPACE_TABS: WorkspaceTab[] = ["overview", "schedules", "zones", "speed", "rules", "drivers"];

const tabTriggerClass = "flex-none text-white/90 hover:text-white data-[state=active]:text-foreground";

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
  // `?tab=` : ouverture directe d'une rubrique depuis la fiche client.
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const [tab, setTab] = useState<WorkspaceTab>(
    WORKSPACE_TABS.includes(requested as WorkspaceTab) ? (requested as WorkspaceTab) : "overview",
  );

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
          <TabsTrigger value="overview" className={tabTriggerClass}>
            <LayoutDashboard data-icon="inline-start" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="schedules" className={tabTriggerClass}>
            <CalendarClock data-icon="inline-start" />
            Gestion des horaires
          </TabsTrigger>
          <TabsTrigger value="zones" className={tabTriggerClass}>
            <MapPinned data-icon="inline-start" />
            Zones géographiques
          </TabsTrigger>
          <TabsTrigger value="speed" className={tabTriggerClass}>
            <Gauge data-icon="inline-start" />
            Contrôle de vitesse
          </TabsTrigger>
          <TabsTrigger value="rules" className={tabTriggerClass}>
            <Workflow data-icon="inline-start" />
            Moteur de règles
          </TabsTrigger>
          <TabsTrigger value="drivers" className={tabTriggerClass}>
            <UsersRound data-icon="inline-start" />
            Conducteurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <ClientOverview organizationId={organizationId} vehicleCount={client.stats.vehicles} />
        </TabsContent>
        <TabsContent value="schedules" className="pt-4">
          <Schedules organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="zones" className="pt-4">
          <Zones organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="speed" className="pt-4">
          <SpeedControl organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="rules" className="pt-4">
          <RulesEngine organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="drivers" className="pt-4">
          <Drivers organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
