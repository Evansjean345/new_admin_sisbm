"use client";

import { useState } from "react";

import Link from "next/link";

import { BadgeCheck, Banknote, MoreVertical, RefreshCw, Search, Send } from "lucide-react";

import { RecordPaymentDialog } from "@/app/(main)/dashboard/_components/billing/record-payment-dialog";
import {
  OrganizationCell,
  OrganizationFilter,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { reminderLevelMeta } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInvoices } from "@/hooks/api/use-billing";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDate, formatRelative } from "@/lib/format";
import type { Invoice } from "@/types/billing";

import { SendReminderDialog } from "./send-reminder-dialog";

/** Factures échues non soldées, les plus en retard d'abord, avec sélection pour relance groupée. */
export function OverdueInvoices() {
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<Record<string, Invoice>>({});
  const [toRemind, setToRemind] = useState<Invoice[]>([]);
  const [toPay, setToPay] = useState<Invoice | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const invoices = useInvoices({
    page,
    perPage,
    status: "overdue",
    search: debouncedSearch || undefined,
    organizationId,
  });
  const rows = invoices.data?.data ?? [];
  const selectedList = Object.values(selected);
  const allChecked = rows.length > 0 && rows.every((r) => selected[r.id]);
  const someChecked = rows.some((r) => selected[r.id]);

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
    setSelected({});
  }

  function toggleRow(invoice: Invoice, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[invoice.id] = invoice;
      else delete next[invoice.id];
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (checked) next[r.id] = r;
        else delete next[r.id];
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <InputGroup className="md:max-w-lg">
          <InputGroupInput
            placeholder="Rechercher par facture, client, souscription…"
            aria-label="Rechercher une facture à relancer"
            value={search}
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          <OrganizationFilter value={organizationId} onChange={(id) => changeFilter(() => setOrganizationId(id))} />
          <Button variant="outline" size="sm" onClick={() => invoices.refetch()} disabled={invoices.isFetching}>
            <RefreshCw data-icon="inline-start" className={invoices.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
          <Button size="sm" disabled={selectedList.length === 0} onClick={() => setToRemind(selectedList)}>
            <Send data-icon="inline-start" />
            Relancer{selectedList.length > 0 ? ` (${selectedList.length})` : ""}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          {invoices.isPending ? (
            <LoadingRows rows={6} />
          ) : invoices.isError ? (
            <div className="px-4">
              <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4">
              <EmptyState
                icon={<BadgeCheck />}
                title="Aucune facture en retard"
                description={
                  debouncedSearch || organizationId
                    ? "Aucun résultat pour ces filtres."
                    : "Toutes les factures échues sont soldées."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Tout sélectionner sur cette page"
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={(v) => toggleAll(v === true)}
                      />
                    </TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead className="hidden lg:table-cell">Échéance</TableHead>
                    <TableHead>Retard</TableHead>
                    <TableHead className="text-right">Reste à payer</TableHead>
                    <TableHead className="hidden sm:table-cell">Dernière relance</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inv) => {
                    const level = reminderLevelMeta(inv.reminderLevel);
                    return (
                      <TableRow key={inv.id} data-state={selected[inv.id] ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Sélectionner ${inv.number}`}
                            checked={Boolean(selected[inv.id])}
                            onCheckedChange={(v) => toggleRow(inv, v === true)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Link
                              href={`/dashboard/invoice/${inv.id}`}
                              prefetch={false}
                              className="font-medium font-mono text-xs hover:underline"
                            >
                              {inv.number}
                            </Link>
                            <span className="text-muted-foreground text-xs">
                              {inv.periodLabel} · {inv.subscriptionReference}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-48 md:table-cell">
                          <OrganizationCell organization={inv.organization} />
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {formatDate(inv.dueDate)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={inv.daysOverdue > 30 ? "danger" : "warning"}>
                            {inv.daysOverdue} j
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-medium tabular-nums">{formatMoney(inv.balance, inv.currency)}</span>
                            {inv.paidAmount + inv.creditedAmount > 0 ? (
                              <span className="text-muted-foreground text-xs tabular-nums">
                                sur {formatMoney(inv.amountTTC, inv.currency)} TTC
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col items-start gap-0.5">
                            <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                            {inv.lastReminderAt ? (
                              <span className="text-muted-foreground text-xs">
                                {formatRelative(inv.lastReminderAt)}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${inv.number}`}>
                                  <MoreVertical />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-56" align="end">
                                <DropdownMenuItem onClick={() => setToRemind([inv])}>
                                  <Send />
                                  {inv.reminderLevel >= 3 ? "Renouveler la mise en demeure" : "Relancer"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setToPay(inv)}>
                                  <Banknote />
                                  Enregistrer un paiement
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
          )}
          {rows.length > 0 ? (
            <PaginationBar
              meta={invoices.data?.meta}
              perPage={perPage}
              label="factures"
              onPageChange={(p) => {
                setPage(p);
                setSelected({});
              }}
              onPerPageChange={(n) => changeFilter(() => setPerPage(n))}
            />
          ) : null}
        </CardContent>
      </Card>

      <SendReminderDialog
        invoices={toRemind}
        onOpenChange={(o) => !o && setToRemind([])}
        onSent={() => setSelected({})}
      />
      <RecordPaymentDialog open={Boolean(toPay)} onOpenChange={(o) => !o && setToPay(null)} invoice={toPay} />
    </div>
  );
}
