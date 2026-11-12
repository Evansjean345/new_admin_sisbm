"use client";

import { useState } from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CircleCheck,
  CircleDashed,
  CircleDot,
  FlaskConical,
  HandCoins,
  ReceiptText,
  Scale,
} from "lucide-react";

import { OrganizationCell } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { MetricCard, metricGridClass } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingStats, useInvoices, usePayments } from "@/hooks/api/use-billing";
import { todayIso } from "@/lib/billing";
import { formatDate, formatNumber } from "@/lib/format";
import type { BillingStatsParams } from "@/types/billing";

const RANGES = {
  month: "Ce mois",
  quarter: "3 derniers mois",
  year: "Cette année",
  all: "Depuis le début",
} as const;
type Range = keyof typeof RANGES;

function rangeParams(range: Range): BillingStatsParams {
  const today = todayIso();
  const d = new Date(`${today}T00:00:00Z`);
  if (range === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (range === "quarter") {
    const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 2, 1)).toISOString().slice(0, 10);
    return { from, to: today };
  }
  if (range === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return {};
}

/** Écran 1 — tableau de bord financier (spec §II.2). Montants TTC, sur les factures émises de la période. */
export function FinancialDashboard() {
  const [range, setRange] = useState<Range>("quarter");
  const params = rangeParams(range);
  const stats = useBillingStats(params);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tableau de bord financier"
        description="Facturé, encaissé et restant dû sur les factures émises de la période (montants TTC)."
        actions={
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger size="sm" aria-label="Période">
              <span className="text-muted-foreground">Émises :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                {(Object.keys(RANGES) as Range[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RANGES[r]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      />

      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          Calculées à partir des factures simulées, en attendant l'API de facturation.
        </AlertDescription>
      </Alert>

      {stats.isPending ? (
        <div className="flex flex-col gap-4">
          {["amounts", "counts"].map((k) => (
            <div key={k} className={metricGridClass}>
              {["a", "b", "c", "d"].map((c) => (
                <Skeleton key={c} className="h-36 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      ) : (
        <>
          <div className={metricGridClass}>
            <MetricCard
              icon={ReceiptText}
              label="Total facturé"
              value={formatNumber(stats.data.totalInvoiced)}
              hint={stats.data.currency}
            />
            <MetricCard
              icon={HandCoins}
              label="Total encaissé"
              value={formatNumber(stats.data.totalCollected)}
              hint={`${stats.data.currency} · ${
                stats.data.totalInvoiced > 0
                  ? `${Math.round((stats.data.totalCollected / stats.data.totalInvoiced) * 100)} % du facturé`
                  : "—"
              }`}
            />
            <MetricCard
              icon={Banknote}
              label="Total restant dû"
              value={formatNumber(stats.data.totalDue)}
              hint={`${stats.data.currency} · dont ${formatNumber(stats.data.overdueAmount)} échu`}
            />
            <MetricCard
              icon={Scale}
              label="Avoirs émis"
              value={formatNumber(stats.data.totalCredited)}
              hint={`${stats.data.currency} · facturé = encaissé + avoirs + restant dû`}
            />
          </div>
          <div className={metricGridClass}>
            <MetricCard icon={CircleCheck} label="Factures payées" value={formatNumber(stats.data.counts.paid)} />
            <MetricCard
              icon={CircleDot}
              label="Factures partiellement payées"
              value={formatNumber(stats.data.counts.partial)}
            />
            <MetricCard
              icon={CircleDashed}
              label="Factures impayées"
              value={formatNumber(stats.data.counts.unpaid)}
              hint="Non échues, aucun paiement"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Factures en retard"
              value={formatNumber(stats.data.counts.overdue)}
              hint={
                stats.data.counts.draft > 0
                  ? `${stats.data.counts.draft} brouillon${stats.data.counts.draft > 1 ? "s" : ""} à émettre`
                  : undefined
              }
            />
          </div>
        </>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <OverdueCard />
        <RecentPaymentsCard />
      </div>
    </div>
  );
}

function OverdueCard() {
  const overdue = useInvoices({ status: "overdue", perPage: 6 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Factures en retard</CardTitle>
        <CardDescription>Les plus anciennes d'abord.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/reminders" prefetch={false}>
              Relancer
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {overdue.isPending ? (
          <LoadingRows rows={4} className="flex flex-col gap-2" />
        ) : overdue.isError ? (
          <ErrorState error={overdue.error} onRetry={() => overdue.refetch()} />
        ) : overdue.data.data.length === 0 ? (
          <EmptyState
            icon={<CircleCheck />}
            title="Aucun retard"
            description="Toutes les factures échues sont soldées."
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {overdue.data.data.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <OrganizationCell organization={inv.organization} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <Link
                    href={`/dashboard/invoice/${inv.id}`}
                    prefetch={false}
                    className="font-medium tabular-nums hover:underline"
                  >
                    {formatMoney(inv.balance, inv.currency)}
                  </Link>
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <span className="font-mono">{inv.number}</span>
                    <StatusBadge tone={inv.daysOverdue > 30 ? "danger" : "warning"}>{inv.daysOverdue} j</StatusBadge>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentPaymentsCard() {
  const payments = usePayments({ status: "confirmed", perPage: 6 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Derniers paiements</CardTitle>
        <CardDescription>Encaissements confirmés.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/payments" prefetch={false}>
              Tous les paiements
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {payments.isPending ? (
          <LoadingRows rows={4} className="flex flex-col gap-2" />
        ) : payments.isError ? (
          <ErrorState error={payments.error} onRetry={() => payments.refetch()} />
        ) : payments.data.data.length === 0 ? (
          <EmptyState icon={<HandCoins />} title="Aucun paiement" />
        ) : (
          <ul className="flex flex-col divide-y">
            {payments.data.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <OrganizationCell organization={p.organization} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-medium tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(p.paidAt)} · {p.methodLabel}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
