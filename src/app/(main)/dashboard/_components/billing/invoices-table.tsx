"use client";

import type { ReactNode } from "react";

import Link from "next/link";

import { ReceiptText } from "lucide-react";

import { OrganizationCell } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { invoiceKindLabels, invoiceStatusMeta } from "@/components/status-labels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { useInvoices } from "@/hooks/api/use-billing";
import { formatDate } from "@/lib/format";

import { InvoiceActions } from "./invoice-actions";

/** Écran 2 — colonnes de la liste des factures (spec §II.2). */
export function InvoicesTable({
  query,
  emptyTitle = "Aucune facture",
  emptyDescription,
  emptyAction,
  hideClient = false,
}: {
  query: ReturnType<typeof useInvoices>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  hideClient?: boolean;
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
        <EmptyState icon={<ReceiptText />} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="**:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
        <TableHeader>
          <TableRow>
            <TableHead>N° de facture</TableHead>
            {hideClient ? null : <TableHead className="hidden md:table-cell">Client</TableHead>}
            <TableHead className="hidden lg:table-cell">Émission</TableHead>
            <TableHead className="hidden sm:table-cell">Période facturée</TableHead>
            <TableHead className="hidden text-right xl:table-cell">Montant HT</TableHead>
            <TableHead className="hidden text-right xl:table-cell">Taxes</TableHead>
            <TableHead className="text-right">Montant TTC</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Payé</TableHead>
            <TableHead className="hidden text-right md:table-cell">Reste à payer</TableHead>
            <TableHead className="hidden lg:table-cell">Échéance</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inv) => {
            const meta = invoiceStatusMeta[inv.status];
            const money = (n: number) => formatMoney(n, inv.currency);
            return (
              <TableRow key={inv.id} className={inv.status === "cancelled" ? "text-muted-foreground" : undefined}>
                <TableCell>
                  <Link
                    href={`/dashboard/invoice/${inv.id}`}
                    prefetch={false}
                    className="flex flex-col hover:underline"
                  >
                    <span className="font-medium font-mono text-xs">{inv.number ?? "Brouillon"}</span>
                    {inv.kind !== "standard" ? (
                      <span className="text-muted-foreground text-xs">{invoiceKindLabels[inv.kind]}</span>
                    ) : null}
                  </Link>
                </TableCell>
                {hideClient ? null : (
                  <TableCell className="hidden max-w-44 md:table-cell">
                    <OrganizationCell organization={inv.organization} />
                  </TableCell>
                )}
                <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                  {formatDate(inv.issueDate)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex flex-col">
                    <span className="whitespace-nowrap">{inv.periodLabel}</span>
                    <span className="text-muted-foreground text-xs">
                      {inv.vehicleCount} véh. · {inv.subscriptionReference}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums xl:table-cell">{money(inv.amountHT)}</TableCell>
                <TableCell className="hidden text-right tabular-nums xl:table-cell">{money(inv.taxAmount)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{money(inv.amountTTC)}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{money(inv.paidAmount)}</TableCell>
                <TableCell className="hidden text-right font-medium tabular-nums md:table-cell">
                  {inv.status === "draft" || inv.status === "cancelled" ? "—" : money(inv.balance)}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap lg:table-cell">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">{formatDate(inv.dueDate)}</span>
                    {inv.daysOverdue > 0 ? (
                      <span className="text-destructive text-xs">{inv.daysOverdue} j de retard</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <InvoiceActions invoice={inv} />
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
