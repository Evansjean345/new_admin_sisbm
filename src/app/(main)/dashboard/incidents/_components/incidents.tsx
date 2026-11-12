"use client";

import { useState } from "react";

import Link from "next/link";

import {
  CircleCheck,
  CircleDot,
  Download,
  FlaskConical,
  Hourglass,
  Inbox,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Wrench,
} from "lucide-react";

import {
  OrganizationCell,
  OrganizationFilter,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { incidentCategoryLabels, incidentStatusMeta, severityMeta } from "@/components/alerting-labels";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIncidentStats, useIncidents } from "@/hooks/api/use-incidents";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { downloadCsv, formatDateTime } from "@/lib/format";
import { SEVERITIES, type Severity } from "@/types/alerting";
import { INCIDENT_CATEGORIES, INCIDENT_STATUSES, type IncidentCategory, type IncidentStatus } from "@/types/incident";

const ALL = "all";

/** Écrans 1 et 2 — tableau de bord et liste des incidents (§V.2). */
export function Incidents() {
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [status, setStatus] = useState<IncidentStatus | typeof ALL>(ALL);
  const [priority, setPriority] = useState<Severity | typeof ALL>(ALL);
  const [category, setCategory] = useState<IncidentCategory | typeof ALL>(ALL);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const debounced = useDebouncedValue(search.trim());
  const stats = useIncidentStats();
  const incidents = useIncidents({
    page,
    perPage,
    search: debounced || undefined,
    organizationId,
    status: status === ALL ? undefined : status,
    priority: priority === ALL ? undefined : priority,
    category: category === ALL ? undefined : category,
  });
  const rows = incidents.data?.data ?? [];
  const s = stats.data;
  const reset = () => setPage(1);

  /** Un compteur cliquable filtre la liste (accès aux données sources). */
  const tile = (icon: typeof Inbox, label: string, value: number | undefined, filter?: IncidentStatus) => (
    <button
      type="button"
      className="text-left [&>div]:h-full"
      onClick={() => {
        setStatus(filter ?? ALL);
        reset();
      }}
    >
      <MetricCard icon={icon} label={label} value={value ?? "—"} />
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Gestion des incidents"
        description="Anomalies et situations qui demandent une intervention, de l'ouverture à la clôture."
        actions={
          <>
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(
                  `incidents-${new Date().toISOString().slice(0, 10)}.csv`,
                  rows.map((i) => ({
                    reference: i.reference,
                    client: i.organization.name,
                    vehicule: i.vehicle?.registration ?? "",
                    categorie: incidentCategoryLabels[i.category],
                    priorite: severityMeta[i.priority].label,
                    creation: formatDateTime(i.createdAt),
                    responsable: i.assignee?.name ?? i.queue ?? "",
                    statut: incidentStatusMeta[i.status].label,
                  })),
                )
              }
            >
              <Download data-icon="inline-start" />
              Exporter
            </Button>
            <Button asChild>
              <Link href="/dashboard/incidents/new" prefetch={false}>
                <Plus data-icon="inline-start" />
                Nouvel incident
              </Link>
            </Button>
          </>
        }
      />
      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>Incidents simulés en attendant l'API ; ils sont perdus au rechargement.</AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile(Inbox, "Total", s?.total)}
        {tile(CircleDot, "Nouveaux", s?.new, "new")}
        {tile(ShieldAlert, "Critiques ouverts", s?.critical)}
        {tile(UserCheck, "Assignés", s?.assigned, "assigned")}
        {tile(Wrench, "En cours", s?.inProgress, "in_progress")}
        {tile(Hourglass, "En attente", s?.onHold, "on_hold")}
        {tile(CircleCheck, "Résolus", s?.resolved, "resolved")}
        {tile(Lock, "Clôturés", s?.closed, "closed")}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <InputGroup className="lg:max-w-sm">
          <InputGroupInput
            placeholder="Référence, client, immatriculation…"
            aria-label="Rechercher un incident"
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
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <OrganizationFilter
            value={organizationId}
            onChange={(id) => {
              setOrganizationId(id);
              reset();
            }}
          />
          <Filter
            label="Statut"
            value={status}
            onChange={(v) => {
              setStatus(v as IncidentStatus | typeof ALL);
              reset();
            }}
            options={INCIDENT_STATUSES.map((x) => [x, incidentStatusMeta[x].label])}
          />
          <Filter
            label="Priorité"
            value={priority}
            onChange={(v) => {
              setPriority(v as Severity | typeof ALL);
              reset();
            }}
            options={SEVERITIES.map((x) => [x, severityMeta[x].label])}
          />
          <Filter
            label="Catégorie"
            value={category}
            onChange={(v) => {
              setCategory(v as IncidentCategory | typeof ALL);
              reset();
            }}
            options={INCIDENT_CATEGORIES.map((x) => [x, incidentCategoryLabels[x]])}
          />
          <Button variant="outline" size="sm" onClick={() => incidents.refetch()} disabled={incidents.isFetching}>
            <RefreshCw data-icon="inline-start" className={incidents.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          {incidents.isPending ? (
            <LoadingRows rows={6} />
          ) : incidents.isError ? (
            <div className="px-4">
              <ErrorState error={incidents.error} onRetry={() => incidents.refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4">
              <EmptyState
                icon={<CircleCheck />}
                title="Aucun incident"
                description="Aucun incident pour ces filtres."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="**:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead className="hidden sm:table-cell">Véhicule</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead className="hidden lg:table-cell">Création</TableHead>
                    <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/incidents/${i.id}`}
                          prefetch={false}
                          className="font-mono text-xs hover:underline"
                        >
                          {i.reference}
                        </Link>
                        {i.escalationLevel > 0 ? (
                          <span className="block text-orange-600 text-xs dark:text-orange-400">
                            Escaladé N{i.escalationLevel}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden max-w-44 md:table-cell">
                        <OrganizationCell organization={i.organization} />
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs sm:table-cell">
                        {i.vehicle?.registration ?? "—"}
                      </TableCell>
                      <TableCell>{incidentCategoryLabels[i.category]}</TableCell>
                      <TableCell>
                        <StatusBadge tone={severityMeta[i.priority].tone}>{severityMeta[i.priority].label}</StatusBadge>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                        {formatDateTime(i.createdAt)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {i.assignee?.name ?? <span className="text-muted-foreground">File : {i.queue}</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={incidentStatusMeta[i.status].tone}>
                          {incidentStatusMeta[i.status].label}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {rows.length > 0 ? (
            <PaginationBar
              meta={incidents.data?.meta}
              perPage={perPage}
              label="incidents"
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                reset();
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Filter({
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
      <SelectContent position="popper" align="end" className="max-h-72">
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
