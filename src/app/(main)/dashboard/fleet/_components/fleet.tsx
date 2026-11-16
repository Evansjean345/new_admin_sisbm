"use client";

import { useCallback, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { ErrorState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleet, useTrack } from "@/hooks/api/use-fleet";
import { useGroupMembers, useVehicleGroups } from "@/hooks/api/use-groups";
import { useVehicle } from "@/hooks/api/use-vehicles";
import { getErrorMessage } from "@/lib/axios";
import { toNumber } from "@/lib/format";
import { summarizeTrack, toSegments } from "@/lib/track";
import type { VehicleDetail } from "@/types/vehicle";

import { FleetAlerts } from "./fleet-alerts";
import { FleetKpis } from "./fleet-kpis";
import { FleetMapCard, type TypeFilter } from "./fleet-map-card";
import { FleetQuickLinks } from "./fleet-quick-links";
import { CATEGORY_OF, deriveAlerts, type FleetCategory, fleetState } from "./fleet-state";
import { FleetVehicleList } from "./fleet-vehicle-list";
import { REPLAY_IDLE, type ReplayState } from "./trip-replay";
import { type TrackPeriod, useTrackRange } from "./use-track-range";
import { VehicleTripPanel } from "./vehicle-trip-panel";

interface FleetProps {
  /** Vue dédiée à un véhicule (/dashboard/fleet/[id]). */
  vehicleId?: string;
  /** Limite la vue à une organisation depuis son espace client. */
  organizationId?: string;
}

export function Fleet({ vehicleId, organizationId }: FleetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const single = Boolean(vehicleId);

  // `?organizationId=` : supervision d'un client ouverte depuis sa fiche (accès contextualisé).
  const scopedOrganizationId = organizationId ?? searchParams.get("organizationId") ?? undefined;
  const [filterOrganizationId, setFilterOrganizationId] = useState<string | undefined>();
  const [selectedFleetId, setSelectedFleetId] = useState<string | undefined>();
  const activeOrganizationId = scopedOrganizationId ?? filterOrganizationId;
  const fleet = useFleet(!single, activeOrganizationId);
  const singleVehicle = useVehicle(vehicleId);
  const vehicleGroups = useVehicleGroups(
    { organizationId: activeOrganizationId, page: 1, perPage: 100 },
    { enabled: !single && Boolean(activeOrganizationId) },
  );
  const fleetMembers = useGroupMembers("vehicle_group", selectedFleetId);
  const selectedId = vehicleId ?? searchParams.get("vehicle");

  const [period, setPeriod] = useState<TrackPeriod>("today");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [onlyValidFix, setOnlyValidFix] = useState(false);
  const [replay, setReplay] = useState<ReplayState>(REPLAY_IDLE);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [hidden, setHidden] = useState<Set<FleetCategory>>(() => new Set());
  const [sideTab, setSideTab] = useState<"alerts" | "vehicles">("alerts");

  const allVehicles: VehicleDetail[] = useMemo(() => {
    if (!single) {
      const organizationVehicles = activeOrganizationId
        ? fleet.vehicles.filter((vehicle) => vehicle.organizationId === activeOrganizationId)
        : fleet.vehicles;
      if (!selectedFleetId) return organizationVehicles;
      if (!fleetMembers.data) return [];
      const memberIds = new Set(fleetMembers.data.map((member) => member.id));
      return organizationVehicles.filter((vehicle) => memberIds.has(vehicle.id));
    }
    return singleVehicle.data ? [singleVehicle.data] : [];
  }, [single, activeOrganizationId, fleet.vehicles, selectedFleetId, fleetMembers.data, singleVehicle.data]);

  const visibleVehicles = useMemo(
    () =>
      allVehicles.filter(
        (v) =>
          v.id === selectedId ||
          ((typeFilter === "all" || v.vehicleType === typeFilter) && !hidden.has(CATEGORY_OF[fleetState(v)])),
      ),
    [allVehicles, typeFilter, hidden, selectedId],
  );

  const alerts = useMemo(() => deriveAlerts(allVehicles), [allVehicles]);
  const selected = allVehicles.find((v) => v.id === selectedId) ?? null;

  const range = useTrackRange(period, day);
  const track = useTrack(selected?.device?.id, range, onlyValidFix);
  const limit = toNumber(selected?.speedLimitKph);
  const trackData = useMemo(() => {
    const points = track.data ?? [];
    if (points.length === 0) return null;
    const summary = summarizeTrack(points, limit);
    return {
      points,
      segments: toSegments(points, limit),
      stops: summary.stops,
      summary,
    };
  }, [track.data, limit]);
  const lastHeading = trackData?.points[trackData.points.length - 1]?.direction ?? null;

  const select = useCallback(
    (id: string | null) => {
      setReplay(REPLAY_IDLE);
      if (single) return;
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("vehicle", id);
      else params.delete("vehicle");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [single, searchParams, router, pathname],
  );

  const changeOrganizationFilter = (id: string | undefined) => {
    setFilterOrganizationId(id);
    setSelectedFleetId(undefined);
    select(null);
  };

  const changeFleetFilter = (id: string | undefined) => {
    setSelectedFleetId(id);
    select(null);
  };

  const filterLoading = Boolean(selectedFleetId) && fleetMembers.isPending;
  const availableGroups = vehicleGroups.isPlaceholderData ? [] : (vehicleGroups.data?.data ?? []);
  const filterError = vehicleGroups.isError
    ? getErrorMessage(vehicleGroups.error)
    : selectedFleetId && fleetMembers.isError
      ? getErrorMessage(fleetMembers.error)
      : null;

  function toggleCategory(category: FleetCategory) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const refresh = () => {
    if (single) void singleVehicle.refetch();
    else fleet.refetch();
    if (selectedFleetId) void fleetMembers.refetch();
    void track.refetch();
  };

  const tripPanel = selected ? (
    <VehicleTripPanel
      vehicle={selected}
      period={period}
      onPeriodChange={(p) => {
        setPeriod(p);
        setReplay(REPLAY_IDLE);
      }}
      day={day}
      onDayChange={(d) => {
        setDay(d);
        setReplay(REPLAY_IDLE);
      }}
      onlyValidFix={onlyValidFix}
      onOnlyValidFixChange={setOnlyValidFix}
      points={trackData?.points ?? []}
      summary={trackData?.summary ?? null}
      loading={track.isPending && Boolean(selected.device)}
      fetching={track.isFetching}
      error={track.isError ? track.error : null}
      onRetry={() => void track.refetch()}
      replay={replay}
      onReplayChange={setReplay}
      onClose={single ? undefined : () => select(null)}
      className="xl:h-full xl:overflow-y-auto"
    />
  ) : null;

  if (single && singleVehicle.isError) {
    return <ErrorState error={singleVehicle.error} onRetry={() => void singleVehicle.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Indicateur pour la flotte et kpi  */}
      {single ? (
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={`/dashboard/fleet?vehicle=${vehicleId}`} prefetch={false}>
              <ArrowLeft data-icon="inline-start" />
              Toute la flotte
            </Link>
          </Button>
        </div>
      ) : (
        <FleetKpis
          vehicles={allVehicles}
          total={selectedFleetId ? allVehicles.length : fleet.total}
          loading={fleet.isPending || filterLoading}
        />
      )}

      {!single ? (
        <div className="flex flex-wrap items-end justify-end gap-3">
          {!scopedOrganizationId ? (
            <Field className="w-full gap-1.5 sm:w-56">
              <FieldLabel htmlFor="fleet-organization-filter">Client</FieldLabel>
              <OrganizationSelect
                id="fleet-organization-filter"
                allowAll
                value={filterOrganizationId}
                onChange={changeOrganizationFilter}
                className="w-full"
                placeholder="Tous les clients"
              />
            </Field>
          ) : null}
          <Field className="w-full gap-1.5 sm:w-56">
            <FieldLabel htmlFor="fleet-group-filter">Flotte</FieldLabel>
            <Select
              value={activeOrganizationId ? (selectedFleetId ?? "__all_vehicles__") : ""}
              onValueChange={(id) => changeFleetFilter(id === "__all_vehicles__" ? undefined : id)}
              disabled={
                !activeOrganizationId ||
                vehicleGroups.isPending ||
                vehicleGroups.isPlaceholderData ||
                vehicleGroups.isError ||
                availableGroups.length === 0
              }
            >
              <SelectTrigger id="fleet-group-filter" className="w-full">
                <SelectValue
                  placeholder={
                    !activeOrganizationId
                      ? "Choisissez d'abord un client"
                      : vehicleGroups.isPending || vehicleGroups.isPlaceholderData
                        ? "Chargement des flottes…"
                        : "Toutes les flottes"
                  }
                />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectGroup>
                  <SelectItem value="__all_vehicles__">Tous les véhicules du client</SelectItem>
                  {availableGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} · {group.membersCount} véhicule(s)
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {filterLoading ? (
            <p className="text-muted-foreground text-sm" role="status">
              Chargement des véhicules de la flotte…
            </p>
          ) : null}
          {filterError ? (
            <Alert variant="destructive" className="basis-full">
              <AlertDescription>{filterError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:h-[calc(100dvh-var(--dashboard-header-height)-12rem)] xl:min-h-[600px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <FleetMapCard
          className="h-[70dvh] xl:h-full"
          title={single && selected ? `Suivi de ${selected.registration}` : "Suivi en temps réel"}
          compact={single}
          allVehicles={allVehicles}
          vehicles={visibleVehicles}
          selectedId={selectedId}
          onSelect={(id) => select(id)}
          track={trackData}
          replayIndex={replay.index}
          selectedHeading={lastHeading}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          hiddenCategories={hidden}
          onToggleCategory={toggleCategory}
          refreshing={
            fleet.isFetching || singleVehicle.isFetching || fleetMembers.isFetching || track.isFetching
          }
          onRefresh={refresh}
        />

        {tripPanel ?? (
          <Card className="min-h-0 gap-3 xl:h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {sideTab === "alerts" ? "Alertes en direct" : "Véhicules"}
                <Badge
                  variant={sideTab === "alerts" && alerts.length > 0 ? "destructive" : "secondary"}
                  className="rounded-full"
                >
                  {sideTab === "alerts" ? alerts.length : visibleVehicles.length}
                </Badge>
              </CardTitle>
              <CardAction>
                <Tabs value={sideTab} onValueChange={(v) => setSideTab(v as "alerts" | "vehicles")}>
                  <TabsList>
                    <TabsTrigger value="alerts" className="text-xs">
                      Alertes
                    </TabsTrigger>
                    <TabsTrigger value="vehicles" className="text-xs">
                      Véhicules
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardAction>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 px-0">
              <ScrollArea className="h-[420px] xl:h-full">
                <div className="px-4 pb-2">
                  {fleet.isPending || filterLoading ? (
                    <div className="flex flex-col gap-2.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: squelettes statiques
                        <Skeleton key={i} className="h-20 rounded-xl" />
                      ))}
                    </div>
                  ) : fleet.isError ? (
                    <ErrorState error={fleet.error} onRetry={fleet.refetch} />
                  ) : filterError ? (
                    <p className="text-destructive text-sm">Impossible de charger les véhicules pour ce filtre.</p>
                  ) : sideTab === "alerts" ? (
                    allVehicles.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {selectedFleetId
                          ? "Aucun véhicule actif dans cette flotte."
                          : activeOrganizationId
                            ? "Aucun véhicule actif pour ce client."
                            : "Aucun véhicule actif dans le périmètre sélectionné."}
                      </p>
                    ) : (
                      <FleetAlerts alerts={alerts} onSelect={(id) => select(id)} />
                    )
                  ) : (
                    <FleetVehicleList
                      vehicles={visibleVehicles}
                      selectedId={selectedId}
                      onSelect={(id) => select(id)}
                    />
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {!single && !organizationId ? <FleetQuickLinks /> : null}
    </div>
  );
}
