"use client";

import { useState } from "react";

import Link from "next/link";

import { Building2, Download, Plus, PowerOff, RefreshCw, Search } from "lucide-react";

import { MetricCard, metricGridClass } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { clientStatusMeta } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClientProfiles } from "@/hooks/api/use-client-profiles";
import { useOffers } from "@/hooks/api/use-offers";
import { useOrganizations } from "@/hooks/api/use-organizations";
import { useSubscriptions } from "@/hooks/api/use-subscriptions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { downloadCsv, formatDate } from "@/lib/format";
import { CLIENT_STATUSES, type ClientStatus } from "@/types/client-profile";

import { OrganizationFormDialog } from "./organization-form-dialog";
import { OrganizationRowActions } from "./organization-row-actions";

const ALL = "all";

/**
 * Entreprises clientes.
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

  /** Souscriptions non résiliées par client, et clients ayant souscrit l'offre filtrée. */
  const subscriptionCount = new Map<string, number>();
  const withOffer = new Set<string>();
  for (const s of subscriptions.data?.data ?? []) {
    if (s.status === "terminated") continue;
    subscriptionCount.set(s.organizationId, (subscriptionCount.get(s.organizationId) ?? 0) + 1);
    if (s.offerId === offerId) withOffer.add(s.organizationId);
  }

  // Filtres statut commercial et offre : appliqués à la page affichée, faute de route serveur.
  const rows = pageRows.filter(
    (o) =>
      (commercialStatus === ALL || profiles.data?.[o.id]?.status === commercialStatus) &&
      (offerId === ALL || withOffer.has(o.id)),
  );
  const total = organizations.data?.meta.total ?? 0;
  const inactive = rows.filter((organization) => !organization.isActive).length;

  function exportCsv() {
    downloadCsv(
      `entreprises-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((organization) => ({
        code: organization.code,
        nom: organization.name,
        raison_sociale: profiles.data?.[organization.id]?.legalName ?? "",
        responsable: profiles.data?.[organization.id]?.manager.name ?? "",
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
        title="Entreprises"
        description="Organisations clientes de la plateforme : création, coordonnées et comptes rattachés."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download data-icon="inline-start" />
              Exporter
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Nouvelle entreprise
            </Button>
          </>
        }
      />

      <div className={metricGridClass}>
        <MetricCard icon={Building2} label="Entreprises" value={total} hint="Organisations enregistrées." />
        <MetricCard
          icon={PowerOff}
          label="Désactivées"
          value={inactive}
          hint="Sur la page affichée : leurs comptes ne peuvent plus se connecter."
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <InputGroup className="md:max-w-lg">
          <InputGroupInput
            placeholder="Rechercher par nom ou par code…"
            aria-label="Rechercher une entreprise"
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
                title="Entreprises indisponibles"
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4">
              <EmptyState
                icon={<Building2 />}
                title="Aucune entreprise"
                description={
                  debouncedSearch
                    ? "Aucun résultat pour cette recherche."
                    : "Créez votre première organisation cliente."
                }
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Nouvelle entreprise
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
                      <TableHead>Entreprise</TableHead>
                      <TableHead className="hidden md:table-cell">Responsable / contact</TableHead>
                      <TableHead className="hidden lg:table-cell">Souscriptions</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Accès</TableHead>
                      <TableHead className="hidden xl:table-cell">Créée le</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((organization) => {
                      const profile = profiles.data?.[organization.id];
                      const commercial = clientStatusMeta[profile?.status ?? "active"];
                      const managerContact = profile?.manager.name
                        ? [profile.manager.phone, profile.manager.email]
                        : [organization.contactPhone];
                      return (
                        <TableRow key={organization.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/entreprises/${organization.id}`}
                              prefetch={false}
                              className="flex flex-col hover:underline"
                            >
                              <span className="font-medium">{organization.name}</span>
                              <span className="font-mono text-muted-foreground text-xs">{organization.code}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-col">
                              <span>{profile?.manager.name ?? organization.contactEmail ?? "—"}</span>
                              <span className="text-muted-foreground text-xs">
                                {managerContact.filter(Boolean).join(" · ")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden tabular-nums lg:table-cell">
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
                          <TableCell className="hidden text-muted-foreground xl:table-cell">
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
                label="entreprises"
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
