"use client";

import { useState } from "react";

import Link from "next/link";

import { Building2, CircleCheck, CirclePause, Download, Plus, RefreshCw, Search, UserPlus } from "lucide-react";

import { MetricCard, metricGridClass } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { clientStatusMeta } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganizationsStats } from "@/hooks/api/use-admin";
import { useClientProfiles } from "@/hooks/api/use-client-profiles";
import { useOffers } from "@/hooks/api/use-offers";
import { useOrganizations } from "@/hooks/api/use-organizations";
import { useSubscriptions } from "@/hooks/api/use-subscriptions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { downloadCsv, formatDate, formatNumber } from "@/lib/format";
import { CLIENT_STATUSES, type ClientStatus } from "@/types/client-profile";

import { OrganizationFormDialog } from "./organization-form-dialog";
import { OrganizationRowActions } from "./organization-row-actions";

const ALL = "all";

/**
 * Gestion des clients — écran « Liste des clients » (spécifications §III.3).
 *
 * Colonnes : code client, raison sociale, responsable, téléphone, e-mail, véhicules,
 * souscriptions, statut, date de création. Filtres : nom, statut, offre, date de création.
 *
 * Écran réservé à l'exploitant plateforme : un administrateur client reçoit
 * 403 sur `/organizations`. L'état d'erreur le dit explicitement plutôt que
 * d'afficher une liste vide trompeuse.
 */
export function Organizations() {
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState<string>(ALL);
  const [commercialStatus, setCommercialStatus] = useState<ClientStatus | typeof ALL>(ALL);
  const [offerId, setOfferId] = useState<string>(ALL);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const organizations = useOrganizations({
    page,
    perPage,
    search: debouncedSearch || undefined,
    isActive: activity === ALL ? undefined : activity === "active",
  });

  const pageRows = organizations.data?.data ?? [];
  const profiles = useClientProfiles(pageRows.map((o) => o.id));
  const subscriptions = useSubscriptions({ perPage: 1000 });
  const offers = useOffers({ perPage: 100 });
  // Nombre de véhicules par client : déjà calculé par l'API pour le tableau de bord.
  const orgStats = useOrganizationsStats();
  const vehicleCount = new Map((orgStats.data ?? []).map((o) => [o.id, o.vehicles]));

  /** Souscriptions non résiliées par client, et clients ayant souscrit l'offre filtrée. */
  const subscriptionCount = new Map<string, number>();
  const withOffer = new Set<string>();
  for (const s of subscriptions.data?.data ?? []) {
    if (s.status === "terminated") continue;
    subscriptionCount.set(s.organizationId, (subscriptionCount.get(s.organizationId) ?? 0) + 1);
    if (s.offerId === offerId) withOffer.add(s.organizationId);
  }

  // Filtres statut commercial, offre et date de création : appliqués à la page affichée, faute de route serveur.
  const rows = pageRows.filter(
    (o) =>
      (commercialStatus === ALL || profiles.data?.[o.id]?.status === commercialStatus) &&
      (offerId === ALL || withOffer.has(o.id)) &&
      (!createdFrom || o.createdAt.slice(0, 10) >= createdFrom) &&
      (!createdTo || o.createdAt.slice(0, 10) <= createdTo),
  );
  const total = organizations.data?.meta.total ?? 0;
  const statusCount = (status: ClientStatus) =>
    pageRows.filter((o) => (profiles.data?.[o.id]?.status ?? "active") === status).length;

  function exportCsv() {
    downloadCsv(
      `clients-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((organization) => ({
        code_client: organization.code,
        raison_sociale: profiles.data?.[organization.id]?.legalName ?? organization.name,
        nom_commercial: organization.name,
        responsable: profiles.data?.[organization.id]?.manager.name ?? "",
        vehicules: vehicleCount.get(organization.id) ?? "",
        souscriptions: subscriptionCount.get(organization.id) ?? 0,
        statut_commercial: clientStatusMeta[profiles.data?.[organization.id]?.status ?? "active"].label,
        email: organization.contactEmail ?? "",
        telephone: organization.contactPhone ?? "",
        pays: organization.countryCode ?? "",
        fuseau: organization.timezone,
        statut: organization.isActive ? "active" : "inactive",
        creee_le: formatDate(organization.createdAt),
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Gestion des clients"
        description="Clients de SISBM : fiche commerciale, souscriptions, véhicules et accès à leur espace."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download data-icon="inline-start" />
              Exporter
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Nouveau client
            </Button>
          </>
        }
      />

      <div className={metricGridClass}>
        <MetricCard icon={Building2} label="Clients" value={formatNumber(total)} hint="Tous statuts confondus." />
        <MetricCard icon={CircleCheck} label="Actifs" value={statusCount("active")} hint="Sur la page affichée." />
        <MetricCard icon={UserPlus} label="Prospects" value={statusCount("prospect")} hint="Sur la page affichée." />
        <MetricCard
          icon={CirclePause}
          label="Suspendus"
          value={statusCount("suspended")}
          hint="Sur la page affichée."
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <InputGroup className="md:max-w-lg">
          <InputGroupInput
            placeholder="Rechercher par nom ou par code client…"
            aria-label="Rechercher un client"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          <Select value={offerId} onValueChange={setOfferId}>
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
          <Select value={commercialStatus} onValueChange={(v) => setCommercialStatus(v as ClientStatus | typeof ALL)}>
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Statut :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Tous</SelectItem>
                {CLIENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {clientStatusMeta[s].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">Créé du</span>
          <Input
            type="date"
            aria-label="Créé à partir du"
            className="h-8 w-36"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
          />
          <span className="text-muted-foreground text-sm">au</span>
          <Input
            type="date"
            aria-label="Créé jusqu'au"
            className="h-8 w-36"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
          />
          <Select
            value={activity}
            onValueChange={(value) => {
              setActivity(value);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Accès :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Toutes</SelectItem>
                <SelectItem value="active">Actives</SelectItem>
                <SelectItem value="inactive">Désactivées</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => organizations.refetch()}
            disabled={organizations.isFetching}
          >
            <RefreshCw data-icon="inline-start" className={organizations.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          {organizations.isPending ? (
            <LoadingRows rows={6} />
          ) : organizations.isError ? (
            <div className="px-4">
              <ErrorState
                error={organizations.error}
                onRetry={() => organizations.refetch()}
                title="Clients indisponibles"
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4">
              <EmptyState
                icon={<Building2 />}
                title="Aucun client"
                description={
                  debouncedSearch || createdFrom || createdTo || commercialStatus !== ALL || offerId !== ALL
                    ? "Aucun résultat pour ces filtres."
                    : "Créez votre premier client."
                }
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Nouveau client
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden md:table-cell">Responsable</TableHead>
                      <TableHead className="hidden xl:table-cell">Téléphone</TableHead>
                      <TableHead className="hidden xl:table-cell">E-mail</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Véhicules</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Souscriptions</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Accès</TableHead>
                      <TableHead className="hidden 2xl:table-cell">Créé le</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((organization) => {
                      const profile = profiles.data?.[organization.id];
                      const commercial = clientStatusMeta[profile?.status ?? "active"];
                      const phone = profile?.manager.phone ?? organization.contactPhone;
                      const email = profile?.manager.email ?? organization.contactEmail;
                      return (
                        <TableRow key={organization.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/entreprises/${organization.id}`}
                              prefetch={false}
                              className="flex flex-col hover:underline"
                            >
                              <span className="font-medium">{profile?.legalName ?? organization.name}</span>
                              <span className="text-muted-foreground text-xs">
                                <span className="font-mono">{organization.code}</span>
                                {profile?.legalName && profile.legalName !== organization.name
                                  ? ` · ${organization.name}`
                                  : ""}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-col">
                              <span>{profile?.manager.name ?? "—"}</span>
                              {profile?.manager.position ? (
                                <span className="text-muted-foreground text-xs">{profile.manager.position}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap xl:table-cell">{phone ?? "—"}</TableCell>
                          <TableCell className="hidden max-w-48 truncate xl:table-cell">{email ?? "—"}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">
                            {orgStats.isPending ? "…" : (vehicleCount.get(organization.id) ?? 0)}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">
                            {subscriptions.isPending ? "…" : (subscriptionCount.get(organization.id) ?? 0)}
                          </TableCell>
                          <TableCell>
                            {profile ? <StatusBadge tone={commercial.tone}>{commercial.label}</StatusBadge> : "…"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {organization.isActive ? (
                              <StatusBadge tone="success">Active</StatusBadge>
                            ) : (
                              <StatusBadge tone="orange">Désactivée</StatusBadge>
                            )}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                            {formatDate(organization.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <OrganizationRowActions organization={organization} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <PaginationBar
                meta={organizations.data?.meta}
                perPage={perPage}
                label="clients"
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <OrganizationFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
