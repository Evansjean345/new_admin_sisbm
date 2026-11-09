"use client";

import { useState } from "react";

import Link from "next/link";

import { Download, FileSignature, FlaskConical, Plus, RefreshCw, Search } from "lucide-react";

import {
  OrganizationCell,
  OrganizationFilter,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { SubscriptionFormDialog } from "@/app/(main)/dashboard/_components/subscriptions/subscription-form-dialog";
import { SubscriptionRowActions } from "@/app/(main)/dashboard/_components/subscriptions/subscription-row-actions";
import {
  activeVehicleCount,
  effectiveUnitPrice,
  formatUnitPrice,
} from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { offerPeriodicityLabels, subscriptionStatusMeta } from "@/components/status-labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOffers } from "@/hooks/api/use-offers";
import { useSubscriptions } from "@/hooks/api/use-subscriptions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { downloadCsv, formatDate } from "@/lib/format";
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@/types/subscription";

const ALL = "all";

export function Subscriptions() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus | typeof ALL>(ALL);
  const [offerId, setOfferId] = useState<string>(ALL);
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const offers = useOffers({ perPage: 100 });
  const subscriptions = useSubscriptions({
    page,
    perPage,
    search: debouncedSearch || undefined,
    status: status === ALL ? undefined : status,
    offerId: offerId === ALL ? undefined : offerId,
    organizationId,
  });
  const rows = subscriptions.data?.data ?? [];

  function exportCsv() {
    downloadCsv(
      `souscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((s) => ({
        reference: s.reference,
        client: s.organization.name,
        offre: s.offer.name,
        debut: s.startDate,
        fin: s.endDate ?? "",
        periodicite: offerPeriodicityLabels[s.periodicity],
        tarif_reference: s.referencePrice,
        tarif_negocie: s.negotiatedPrice ?? "",
        remise_pct: s.discountPercent,
        tarif_applique: effectiveUnitPrice(s),
        vehicules_actifs: activeVehicleCount(s),
        statut: subscriptionStatusMeta[s.status].label,
      })),
    );
  }

  const resetPage = () => setPage(1);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Souscriptions"
        description="Contrats client × offre et véhicules affectés. Un véhicule n'a qu'une affectation active à la fois."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download data-icon="inline-start" />
              Exporter
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Nouvelle souscription
            </Button>
          </>
        }
      />

      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          Les clients et les véhicules sont réels ; les souscriptions sont simulées en attendant l'API et sont perdues
          au rechargement.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <InputGroup className="md:max-w-lg">
          <InputGroupInput
            placeholder="Rechercher par référence ou client…"
            aria-label="Rechercher une souscription"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          <OrganizationFilter
            value={organizationId}
            onChange={(id) => {
              setOrganizationId(id);
              resetPage();
            }}
          />
          <Select
            value={offerId}
            onValueChange={(v) => {
              setOfferId(v);
              resetPage();
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Offre :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Toutes</SelectItem>
                {(offers.data?.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as SubscriptionStatus | typeof ALL);
              resetPage();
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Statut :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Tous</SelectItem>
                {SUBSCRIPTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {subscriptionStatusMeta[s].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => subscriptions.refetch()}
            disabled={subscriptions.isFetching}
          >
            <RefreshCw data-icon="inline-start" className={subscriptions.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          <SubscriptionsTable
            query={subscriptions}
            hasSearch={Boolean(debouncedSearch)}
            onCreate={() => setCreateOpen(true)}
          />
          {rows.length > 0 ? (
            <PaginationBar
              meta={subscriptions.data?.meta}
              perPage={perPage}
              label="souscriptions"
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                resetPage();
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <SubscriptionFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultOrganizationId={organizationId} />
    </div>
  );
}

function SubscriptionsTable({
  query,
  hasSearch,
  onCreate,
}: {
  query: ReturnType<typeof useSubscriptions>;
  hasSearch: boolean;
  onCreate: () => void;
}) {
  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) {
    return (
      <div className="px-4">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }
  const rows = query.data.data;
  if (rows.length === 0) {
    return (
      <div className="px-4">
        <EmptyState
          icon={<FileSignature />}
          title="Aucune souscription"
          description={
            hasSearch ? "Aucun résultat pour cette recherche." : "Créez la première souscription d'un client."
          }
          action={
            <Button size="sm" onClick={onCreate}>
              <Plus data-icon="inline-start" />
              Nouvelle souscription
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead className="hidden md:table-cell">Client</TableHead>
            <TableHead>Offre</TableHead>
            <TableHead className="hidden lg:table-cell">Période</TableHead>
            <TableHead className="hidden sm:table-cell">Véhicules</TableHead>
            <TableHead className="hidden lg:table-cell">Tarif appliqué</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const meta = subscriptionStatusMeta[s.status];
            return (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/subscriptions/${s.id}`}
                    prefetch={false}
                    className="font-medium font-mono text-xs hover:underline"
                  >
                    {s.reference}
                  </Link>
                </TableCell>
                <TableCell className="hidden max-w-48 md:table-cell">
                  <OrganizationCell organization={s.organization} />
                </TableCell>
                <TableCell>{s.offer.name}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDate(s.startDate)} → {s.endDate ? formatDate(s.endDate) : "sans échéance"}
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{activeVehicleCount(s)}</TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">{formatUnitPrice(s)}</TableCell>
                <TableCell>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <SubscriptionRowActions subscription={s} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
