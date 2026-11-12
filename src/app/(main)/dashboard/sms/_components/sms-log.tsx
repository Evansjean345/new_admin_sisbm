"use client";

import { useState } from "react";

import { CircleCheck, CircleX, Coins, Download, FlaskConical, MessageSquare, RefreshCw, Search } from "lucide-react";

import { OrganizationFilter } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { smsDeliveryMeta, smsTransmissionMeta } from "@/components/alerting-labels";
import { MetricCard, metricGridClass } from "@/components/metric-card";
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
import { useSmsMessages, useSmsStats } from "@/hooks/api/use-alerting";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { downloadCsv, formatDateTime, formatNumber } from "@/lib/format";
import type { SmsTransmission } from "@/types/alerting";

const ALL = "all";

/** Écran 3 — Gestion des SMS (§IV.2) : journal de la passerelle, coûts et échecs. */
export function SmsLog() {
  const [search, setSearch] = useState("");
  const [transmission, setTransmission] = useState<SmsTransmission | typeof ALL>(ALL);
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const debounced = useDebouncedValue(search.trim());
  const stats = useSmsStats();
  const sms = useSmsMessages({
    page,
    perPage,
    search: debounced || undefined,
    transmission: transmission === ALL ? undefined : transmission,
    organizationId,
  });
  const rows = sms.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Gestion des SMS"
        description="Tous les SMS envoyés par la passerelle : destinataire, contenu, coût, transmission et livraison."
        actions={
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `sms-${new Date().toISOString().slice(0, 10)}.csv`,
                rows.map((m) => ({
                  date: formatDateTime(m.sentAt),
                  passerelle: m.gateway,
                  destinataire: m.to,
                  contenu: m.content,
                  cout_xof: m.cost,
                  id_fournisseur: m.providerId ?? "",
                  transmission: smsTransmissionMeta[m.transmission].label,
                  livraison: smsDeliveryMeta[m.delivery].label,
                  motif_echec: m.failureReason ?? "",
                  client: m.organization?.name ?? "",
                  alerte: m.alertReference ?? "",
                })),
              )
            }
          >
            <Download data-icon="inline-start" />
            Exporter
          </Button>
        }
      />
      <Alert>
        <FlaskConical />
        <AlertTitle>Passerelle simulée</AlertTitle>
        <AlertDescription>
          Aucun SMS réel n'est envoyé. La passerelle se configure dans Paramètres › Passerelle SMS.
        </AlertDescription>
      </Alert>

      <div className={metricGridClass}>
        <MetricCard
          icon={MessageSquare}
          label="SMS transmis"
          value={stats.data ? formatNumber(stats.data.sent) : "—"}
        />
        <MetricCard
          icon={CircleCheck}
          label="Livrés"
          value={stats.data ? formatNumber(stats.data.delivered) : "—"}
          hint="Accusé de réception opérateur"
        />
        <MetricCard icon={CircleX} label="Échecs" value={stats.data ? formatNumber(stats.data.failed) : "—"} />
        <MetricCard icon={Coins} label="Coût total" value={stats.data ? formatMoney(stats.data.cost) : "—"} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <InputGroup className="md:max-w-md">
          <InputGroupInput
            placeholder="Numéro, contenu, identifiant fournisseur, alerte…"
            aria-label="Rechercher un SMS"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
          <OrganizationFilter
            value={organizationId}
            onChange={(id) => {
              setOrganizationId(id);
              setPage(1);
            }}
          />
          <Select
            value={transmission}
            onValueChange={(v) => {
              setTransmission(v as SmsTransmission | typeof ALL);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Transmission :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Toutes</SelectItem>
                <SelectItem value="sent">Transmis</SelectItem>
                <SelectItem value="failed">Échec</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => sms.refetch()} disabled={sms.isFetching}>
            <RefreshCw data-icon="inline-start" className={sms.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          {sms.isPending ? (
            <LoadingRows rows={6} />
          ) : sms.isError ? (
            <div className="px-4">
              <ErrorState error={sms.error} onRetry={() => sms.refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4">
              <EmptyState icon={<MessageSquare />} title="Aucun SMS" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="**:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date d'envoi</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead className="hidden md:table-cell">Contenu</TableHead>
                    <TableHead className="hidden lg:table-cell">Passerelle</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Coût</TableHead>
                    <TableHead className="hidden xl:table-cell">Id. fournisseur</TableHead>
                    <TableHead>Transmission</TableHead>
                    <TableHead className="hidden sm:table-cell">Livraison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(m.sentAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {m.to}
                        {m.organization ? (
                          <span className="block font-sans text-muted-foreground">{m.organization.name}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden max-w-80 md:table-cell">
                        <p className="line-clamp-2 text-xs" title={m.content}>
                          {m.content}
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-xs lg:table-cell">{m.gateway}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {formatMoney(m.cost)}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs xl:table-cell">{m.providerId ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge tone={smsTransmissionMeta[m.transmission].tone}>
                          {smsTransmissionMeta[m.transmission].label}
                        </StatusBadge>
                        {m.failureReason ? (
                          <span className="block text-destructive text-xs">{m.failureReason}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge tone={smsDeliveryMeta[m.delivery].tone}>
                          {smsDeliveryMeta[m.delivery].label}
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
              meta={sms.data?.meta}
              perPage={perPage}
              label="SMS"
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
