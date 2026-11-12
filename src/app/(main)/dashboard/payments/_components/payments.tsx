"use client";

import { useState } from "react";

import Link from "next/link";

import {
  AlertTriangle,
  Ban,
  Banknote,
  CalendarClock,
  Download,
  FlaskConical,
  HandCoins,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";

import { RecordPaymentDialog } from "@/app/(main)/dashboard/_components/billing/record-payment-dialog";
import {
  OrganizationCell,
  OrganizationFilter,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { MetricCard, metricGridClass } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { paymentStatusMeta } from "@/components/status-labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBillingStats, usePaymentMethods, usePayments } from "@/hooks/api/use-billing";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { todayIso } from "@/lib/billing";
import { downloadCsv, formatDate, formatNumber } from "@/lib/format";
import type { Payment, PaymentStatus } from "@/types/billing";

import { CancelPaymentDialog } from "./cancel-payment-dialog";

const ALL = "all";

/** Écran 4 — gestion des paiements (spec §II.2). */
export function Payments() {
  const [search, setSearch] = useState("");
  const [methodId, setMethodId] = useState<string>(ALL);
  const [status, setStatus] = useState<PaymentStatus | typeof ALL>(ALL);
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [recordOpen, setRecordOpen] = useState(false);
  const [toCancel, setToCancel] = useState<Payment | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const methods = usePaymentMethods();

  const payments = usePayments({
    page,
    perPage,
    search: debouncedSearch || undefined,
    methodId: methodId === ALL ? undefined : methodId,
    status: status === ALL ? undefined : status,
    organizationId,
  });
  const rows = payments.data?.data ?? [];
  const resetPage = () => setPage(1);

  function exportCsv() {
    downloadCsv(
      `paiements-${todayIso()}.csv`,
      rows.map((p) => ({
        reference: p.reference,
        date: p.paidAt,
        client: p.organization.name,
        facture: p.invoiceNumber,
        montant: p.amount,
        devise: p.currency,
        mode: p.methodLabel,
        transaction: p.transactionRef ?? "",
        justificatif: p.attachment?.name ?? "",
        commentaire: p.comment ?? "",
        statut: paymentStatusMeta[p.status].label,
        motif_annulation: p.cancelReason ?? "",
        saisi_par: p.recordedBy,
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Paiements"
        description="Encaissements imputés sur les factures. Un paiement ne se supprime pas : il s'annule avec un motif."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download data-icon="inline-start" />
              Exporter
            </Button>
            <Button onClick={() => setRecordOpen(true)}>
              <Plus data-icon="inline-start" />
              Enregistrer un paiement
            </Button>
          </>
        }
      />

      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          Paiements simulés en attendant l'API de facturation ; les pièces justificatives ne sont pas envoyées. Perdus
          au rechargement.
        </AlertDescription>
      </Alert>

      <PaymentKpis />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <InputGroup className="md:max-w-lg">
          <InputGroupInput
            placeholder="Référence, facture, client, transaction…"
            aria-label="Rechercher un paiement"
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
            value={methodId}
            onValueChange={(v) => {
              setMethodId(v);
              resetPage();
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Mode :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Tous</SelectItem>
                {(methods.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as PaymentStatus | typeof ALL);
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
                <SelectItem value="confirmed">{paymentStatusMeta.confirmed.label}</SelectItem>
                <SelectItem value="cancelled">{paymentStatusMeta.cancelled.label}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => payments.refetch()} disabled={payments.isFetching}>
            <RefreshCw data-icon="inline-start" className={payments.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          <PaymentsTable
            query={payments}
            hasFilters={Boolean(debouncedSearch) || methodId !== ALL || status !== ALL || Boolean(organizationId)}
            onRecord={() => setRecordOpen(true)}
            onCancel={setToCancel}
          />
          {rows.length > 0 ? (
            <PaginationBar
              meta={payments.data?.meta}
              perPage={perPage}
              label="paiements"
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                resetPage();
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <CancelPaymentDialog payment={toCancel} onOpenChange={(o) => !o && setToCancel(null)} />
    </div>
  );
}

function PaymentKpis() {
  const today = todayIso();
  const month = useBillingStats({ from: `${today.slice(0, 7)}-01`, to: today });
  const all = useBillingStats({});
  if (month.isPending || all.isPending) {
    return (
      <div className={metricGridClass}>
        {["a", "b", "c", "d"].map((k) => (
          <Skeleton key={k} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }
  if (month.isError || all.isError) {
    return (
      <ErrorState error={month.error ?? all.error} onRetry={() => Promise.all([month.refetch(), all.refetch()])} />
    );
  }
  const c = all.data.currency;
  return (
    <div className={metricGridClass}>
      <MetricCard
        icon={HandCoins}
        label="Encaissé sur les factures du mois"
        value={formatNumber(month.data.totalCollected)}
        hint={`${c} · sur ${formatNumber(month.data.totalInvoiced)} facturés`}
      />
      <MetricCard icon={Banknote} label="Reste à encaisser" value={formatNumber(all.data.totalDue)} hint={c} />
      <MetricCard
        icon={AlertTriangle}
        label="Impayés échus"
        value={formatNumber(all.data.overdueAmount)}
        hint={`${c} · inclus dans le reste à encaisser`}
      />
      <MetricCard
        icon={CalendarClock}
        label="Factures en retard"
        value={formatNumber(all.data.counts.overdue)}
        hint={
          <Link href="/dashboard/reminders" prefetch={false} className="underline-offset-2 hover:underline">
            Voir les relances
          </Link>
        }
      />
    </div>
  );
}

function PaymentsTable({
  query,
  hasFilters,
  onRecord,
  onCancel,
}: {
  query: ReturnType<typeof usePayments>;
  hasFilters: boolean;
  onRecord: () => void;
  onCancel: (payment: Payment) => void;
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
          icon={<Wallet />}
          title="Aucun paiement"
          description={hasFilters ? "Aucun résultat pour ces filtres." : "Enregistrez le premier paiement reçu."}
          action={
            <Button size="sm" onClick={onRecord}>
              <Plus data-icon="inline-start" />
              Enregistrer un paiement
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
            <TableHead className="hidden sm:table-cell">Date</TableHead>
            <TableHead className="hidden md:table-cell">Client</TableHead>
            <TableHead className="hidden lg:table-cell">Facture</TableHead>
            <TableHead className="hidden lg:table-cell">Mode</TableHead>
            <TableHead className="hidden xl:table-cell">Justificatif</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const meta = paymentStatusMeta[p.status];
            const cancelled = p.status === "cancelled";
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium font-mono text-xs">{p.reference}</span>
                    {p.transactionRef ? (
                      <span className="text-muted-foreground text-xs">{p.transactionRef}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(p.paidAt)}</TableCell>
                <TableCell className="hidden max-w-48 md:table-cell">
                  <OrganizationCell organization={p.organization} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Link
                    href={`/dashboard/invoice/${p.invoiceId}`}
                    prefetch={false}
                    className="font-mono text-xs hover:underline"
                  >
                    {p.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{p.methodLabel}</TableCell>
                <TableCell className="hidden max-w-40 xl:table-cell">
                  {p.attachment ? (
                    <span className="flex items-center gap-1 text-xs" title={p.attachment.name}>
                      <Paperclip className="size-3.5 shrink-0" />
                      <span className="truncate">{p.attachment.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${cancelled ? "text-muted-foreground line-through" : "font-medium"}`}
                >
                  {formatMoney(p.amount, p.currency)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-0.5">
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    {p.cancelReason || p.comment ? (
                      <span
                        className="max-w-48 truncate text-muted-foreground text-xs"
                        title={p.cancelReason ?? p.comment ?? undefined}
                      >
                        {p.cancelReason ?? p.comment}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${p.reference}`}>
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-52" align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/invoice/${p.invoiceId}`} prefetch={false}>
                            <Banknote />
                            Voir la facture
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" disabled={cancelled} onClick={() => onCancel(p)}>
                          <Ban />
                          Annuler le paiement
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
