"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  BellRing,
  CheckCheck,
  CircleCheck,
  Clock,
  Download,
  Eye,
  FlaskConical,
  MapPin,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import {
  OrganizationCell,
  OrganizationFilter,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { alertStatusMeta, eventTypeLabels, severityMeta } from "@/components/alerting-labels";
import { MetricCard, metricGridClass } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { AlertDescription, AlertTitle, Alert as UiAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAcknowledgeAlert, useAlertStats, useAlerts } from "@/hooks/api/use-alerting";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getErrorMessage } from "@/lib/axios";
import { downloadCsv, formatDateTime, formatRelative } from "@/lib/format";
import {
  ALERT_STATUSES,
  type Alert,
  type AlertStatus,
  EVENT_TYPES,
  type EventType,
  SEVERITIES,
  type Severity,
} from "@/types/alerting";

import { AssignAlertDialog, ResolveAlertDialog, SendNotificationDialog } from "./alert-dialogs";

const ALL = "all";
type Dialog = { kind: "assign" | "notify" | "resolve"; alert: Alert } | null;

/** Écran 1 — Centre des alertes (§IV.2). */
export function AlertCenter() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [eventType, setEventType] = useState<EventType | typeof ALL>(ALL);
  const [severity, setSeverity] = useState<Severity | typeof ALL>(ALL);
  const [status, setStatus] = useState<AlertStatus | typeof ALL>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const debounced = useDebouncedValue(search.trim());
  const acknowledge = useAcknowledgeAlert();
  const stats = useAlertStats();

  const alerts = useAlerts({
    page,
    perPage,
    search: debounced || undefined,
    organizationId,
    eventType: eventType === ALL ? undefined : eventType,
    severity: severity === ALL ? undefined : severity,
    status: status === ALL ? undefined : status,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  });
  const rows = alerts.data?.data ?? [];
  const reset = () => setPage(1);
  // La fiche ouverte suit les mises à jour de la liste.
  const current = selected ? (rows.find((a) => a.id === selected.id) ?? selected) : null;

  function onAcknowledge(a: Alert) {
    acknowledge.mutate(a.id, {
      onSuccess: () => toast.success("Alerte prise en compte", { description: a.reference }),
      onError: (e) => toast.error("Action impossible", { description: getErrorMessage(e) }),
    });
  }

  const actions = (a: Alert) => ({
    acknowledge: a.status === "new",
    assign: a.status !== "resolved",
    incident: !a.incidentId,
    resolve: a.status !== "resolved",
  });

  function exportCsv() {
    downloadCsv(
      `alertes-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((a) => ({
        reference: a.reference,
        date: formatDateTime(a.occurredAt),
        client: a.organization.name,
        vehicule: a.vehicle?.registration ?? "",
        evenement: eventTypeLabels[a.eventType],
        gravite: severityMeta[a.severity].label,
        localisation: a.location?.address ?? "",
        statut: alertStatusMeta[a.status].label,
        regle: a.ruleName ?? "",
        responsable: a.assignee?.name ?? "",
        incident: a.incidentReference ?? "",
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Centre des alertes"
        description="Événements détectés par les boîtiers GPS et le moteur de règles. Une alerte n'est jamais supprimée : elle se traite."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download data-icon="inline-start" />
            Exporter
          </Button>
        }
      />

      <UiAlert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          Clients et véhicules réels ; les alertes sont simulées en attendant l'ingestion GPS et le moteur de règles.
        </AlertDescription>
      </UiAlert>

      <div className={metricGridClass}>
        <MetricCard icon={BellRing} label="Alertes" value={stats.data?.total ?? "—"} hint="Toutes périodes" />
        <MetricCard
          icon={ShieldAlert}
          label="Critiques ouvertes"
          value={stats.data?.critical ?? "—"}
          hint="Non traitées"
        />
        <MetricCard
          icon={TriangleAlert}
          label="Non prises en compte"
          value={stats.data?.untreated ?? "—"}
          hint="Statut « Nouvelle »"
        />
        <MetricCard icon={Clock} label="Dernières 24 h" value={stats.data?.last24h ?? "—"} />
      </div>

      <div className="flex flex-col gap-3">
        <InputGroup className="md:max-w-md">
          <InputGroupInput
            placeholder="Référence, immatriculation, client, règle…"
            aria-label="Rechercher une alerte"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <OrganizationFilter
            value={organizationId}
            onChange={(id) => {
              setOrganizationId(id);
              reset();
            }}
          />
          <FilterSelect
            label="Type"
            value={eventType}
            onChange={(v) => {
              setEventType(v as EventType | typeof ALL);
              reset();
            }}
            options={EVENT_TYPES.map((t) => [t, eventTypeLabels[t]])}
          />
          <FilterSelect
            label="Priorité"
            value={severity}
            onChange={(v) => {
              setSeverity(v as Severity | typeof ALL);
              reset();
            }}
            options={SEVERITIES.map((s) => [s, severityMeta[s].label])}
          />
          <FilterSelect
            label="Statut"
            value={status}
            onChange={(v) => {
              setStatus(v as AlertStatus | typeof ALL);
              reset();
            }}
            options={ALERT_STATUSES.map((s) => [s, alertStatusMeta[s].label])}
          />
          <Input
            type="date"
            aria-label="Du"
            className="h-8 w-36"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input type="date" aria-label="Au" className="h-8 w-36" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" size="sm" onClick={() => alerts.refetch()} disabled={alerts.isFetching}>
            <RefreshCw data-icon="inline-start" className={alerts.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          {alerts.isPending ? (
            <LoadingRows rows={8} />
          ) : alerts.isError ? (
            <div className="px-4">
              <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4">
              <EmptyState icon={<CircleCheck />} title="Aucune alerte" description="Aucune alerte pour ces filtres." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="**:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead className="hidden sm:table-cell">Date et heure</TableHead>
                    <TableHead className="hidden lg:table-cell">Client</TableHead>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Événement</TableHead>
                    <TableHead>Gravité</TableHead>
                    <TableHead className="hidden xl:table-cell">Localisation</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden 2xl:table-cell">Règle déclenchée</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => {
                    const can = actions(a);
                    return (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                        <TableCell className="font-mono text-xs">{a.reference}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                          {formatDateTime(a.occurredAt)}
                        </TableCell>
                        <TableCell className="hidden max-w-40 lg:table-cell">
                          <OrganizationCell organization={a.organization} />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">{a.vehicle?.registration ?? "—"}</span>
                        </TableCell>
                        <TableCell className="max-w-44">
                          <span className="line-clamp-2">{eventTypeLabels[a.eventType]}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={severityMeta[a.severity].tone}>
                            {severityMeta[a.severity].label}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="hidden max-w-52 truncate text-muted-foreground text-xs xl:table-cell">
                          {a.location?.address ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={alertStatusMeta[a.status].tone}>
                            {alertStatusMeta[a.status].label}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="hidden max-w-48 truncate text-muted-foreground text-xs 2xl:table-cell">
                          {a.ruleName ?? "—"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${a.reference}`}>
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => setSelected(a)}>
                                <Eye />
                                Consulter
                              </DropdownMenuItem>
                              {can.acknowledge ? (
                                <DropdownMenuItem onClick={() => onAcknowledge(a)}>
                                  <CheckCheck />
                                  Marquer comme prise en compte
                                </DropdownMenuItem>
                              ) : null}
                              {can.assign ? (
                                <DropdownMenuItem onClick={() => setDialog({ kind: "assign", alert: a })}>
                                  <UserPlus />
                                  Assigner un responsable
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => setDialog({ kind: "notify", alert: a })}>
                                <Send />
                                Envoyer une notification
                              </DropdownMenuItem>
                              {can.incident ? (
                                <DropdownMenuItem
                                  onClick={() => router.push(`/dashboard/incidents/new?alertId=${a.id}`)}
                                >
                                  <ShieldAlert />
                                  Créer un incident
                                </DropdownMenuItem>
                              ) : null}
                              {can.resolve ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDialog({ kind: "resolve", alert: a })}>
                                    <CircleCheck />
                                    Marquer comme traitée
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {rows.length > 0 ? (
            <PaginationBar
              meta={alerts.data?.meta}
              perPage={perPage}
              label="alertes"
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                reset();
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <AlertSheet
        alert={current}
        onOpenChange={(o) => !o && setSelected(null)}
        onAction={(kind, a) => {
          if (kind === "acknowledge") onAcknowledge(a);
          else if (kind === "incident") router.push(`/dashboard/incidents/new?alertId=${a.id}`);
          else setDialog({ kind, alert: a });
        }}
        can={current ? actions(current) : null}
      />
      <AssignAlertDialog
        alert={dialog?.kind === "assign" ? dialog.alert : null}
        onOpenChange={(o) => !o && setDialog(null)}
      />
      <ResolveAlertDialog
        alert={dialog?.kind === "resolve" ? dialog.alert : null}
        onOpenChange={(o) => !o && setDialog(null)}
      />
      <SendNotificationDialog
        alert={dialog?.kind === "notify" ? dialog.alert : null}
        onOpenChange={(o) => !o && setDialog(null)}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm">
        <span className="text-muted-foreground">{label} :</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        <SelectGroup>
          <SelectItem value={ALL}>Tous</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

type SheetAction = "acknowledge" | "assign" | "notify" | "incident" | "resolve";

function AlertSheet({
  alert,
  onOpenChange,
  onAction,
  can,
}: {
  alert: Alert | null;
  onOpenChange: (open: boolean) => void;
  onAction: (kind: SheetAction, alert: Alert) => void;
  can: { acknowledge: boolean; assign: boolean; incident: boolean; resolve: boolean } | null;
}) {
  return (
    <Sheet open={Boolean(alert)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        {alert && can ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {eventTypeLabels[alert.eventType]}
                <StatusBadge tone={severityMeta[alert.severity].tone}>{severityMeta[alert.severity].label}</StatusBadge>
              </SheetTitle>
              <SheetDescription>
                {alert.reference} · {formatDateTime(alert.occurredAt)} ({formatRelative(alert.occurredAt)})
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-4 px-4 pb-6">
                <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 rounded-lg border p-3 text-sm">
                  <dt className="text-muted-foreground">Statut</dt>
                  <dd>
                    <StatusBadge tone={alertStatusMeta[alert.status].tone}>
                      {alertStatusMeta[alert.status].label}
                    </StatusBadge>
                  </dd>
                  <dt className="text-muted-foreground">Client</dt>
                  <dd>{alert.organization.name}</dd>
                  <dt className="text-muted-foreground">Véhicule</dt>
                  <dd>
                    {alert.vehicle ? (
                      <Link
                        className="font-mono hover:underline"
                        href={`/dashboard/vehicles/${alert.vehicle.id}`}
                        prefetch={false}
                      >
                        {alert.vehicle.registration}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                  {alert.detail ? (
                    <>
                      <dt className="text-muted-foreground">Mesure</dt>
                      <dd>{alert.detail}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>
                    {alert.source === "gps"
                      ? "Boîtier GPS"
                      : alert.source === "rule_engine"
                        ? "Moteur de règles"
                        : "Système"}
                  </dd>
                  <dt className="text-muted-foreground">Règle</dt>
                  <dd>{alert.ruleName ?? "—"}</dd>
                  <dt className="text-muted-foreground">Localisation</dt>
                  <dd className="flex items-start gap-1">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      {alert.location?.address ?? "—"}
                      {alert.location ? (
                        <a
                          className="block text-primary text-xs hover:underline"
                          href={`https://www.openstreetmap.org/?mlat=${alert.location.lat}&mlon=${alert.location.lng}#map=16/${alert.location.lat}/${alert.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Voir sur la carte
                        </a>
                      ) : null}
                    </span>
                  </dd>
                  <dt className="text-muted-foreground">Responsable</dt>
                  <dd>{alert.assignee?.name ?? "Non assignée"}</dd>
                  <dt className="text-muted-foreground">Incident</dt>
                  <dd>
                    {alert.incidentId ? (
                      <Link
                        className="font-mono hover:underline"
                        href={`/dashboard/incidents/${alert.incidentId}`}
                        prefetch={false}
                      >
                        {alert.incidentReference}
                      </Link>
                    ) : (
                      "Aucun"
                    )}
                  </dd>
                </dl>

                <div className="flex flex-wrap gap-2">
                  {can.acknowledge ? (
                    <Button size="sm" onClick={() => onAction("acknowledge", alert)}>
                      <CheckCheck data-icon="inline-start" />
                      Prendre en compte
                    </Button>
                  ) : null}
                  {can.assign ? (
                    <Button size="sm" variant="outline" onClick={() => onAction("assign", alert)}>
                      <UserPlus data-icon="inline-start" />
                      Assigner
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => onAction("notify", alert)}>
                    <Send data-icon="inline-start" />
                    Notifier
                  </Button>
                  {can.incident ? (
                    <Button size="sm" variant="outline" onClick={() => onAction("incident", alert)}>
                      <ShieldAlert data-icon="inline-start" />
                      Créer un incident
                    </Button>
                  ) : null}
                  {can.resolve ? (
                    <Button size="sm" variant="outline" onClick={() => onAction("resolve", alert)}>
                      <CircleCheck data-icon="inline-start" />
                      Traitée
                    </Button>
                  ) : null}
                </div>

                <section className="flex flex-col gap-2">
                  <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Historique</h3>
                  <ol className="flex flex-col gap-3 border-l pl-4">
                    {[...alert.history].reverse().map((h) => (
                      <li key={h.id} className="text-sm">
                        <p className="font-medium">{h.action}</p>
                        <p>{h.description}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatDateTime(h.at)} · {h.actor}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
