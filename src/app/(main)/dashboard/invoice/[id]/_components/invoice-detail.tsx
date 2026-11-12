"use client";

import Link from "next/link";

import { ArrowLeft, FileMinus, History, Mail, Paperclip, Wallet } from "lucide-react";

import { InvoiceActions } from "@/app/(main)/dashboard/_components/billing/invoice-actions";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { DetailList } from "@/components/detail-list";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import {
  invoiceKindLabels,
  invoiceStatusMeta,
  paymentStatusMeta,
  reminderChannelLabels,
  reminderLevelMeta,
  reminderSendStatusMeta,
} from "@/components/status-labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoice, usePayments, useReminders } from "@/hooks/api/use-billing";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Invoice } from "@/types/billing";

export function InvoiceDetail({ id }: { id: string }) {
  const invoice = useInvoice(id);

  if (invoice.isPending) return <LoadingRows rows={8} />;
  if (invoice.isError) return <ErrorState error={invoice.error} onRetry={() => invoice.refetch()} />;
  const inv = invoice.data;
  const meta = invoiceStatusMeta[inv.status];
  const money = (n: number) => formatMoney(n, inv.currency);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/invoice" prefetch={false}>
            <ArrowLeft data-icon="inline-start" />
            Factures
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-extrabold font-mono text-2xl tracking-tight sm:text-3xl">
              {inv.number ?? "Brouillon"}
            </h1>
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
            {inv.kind !== "standard" ? <StatusBadge tone="info">{invoiceKindLabels[inv.kind]}</StatusBadge> : null}
          </div>
          <p className="text-muted-foreground text-sm">
            {inv.organization.name} · {inv.periodLabel} · {inv.offer.name}
          </p>
        </div>
        <InvoiceActions invoice={inv} variant="toolbar" />
      </div>

      {inv.status === "draft" ? (
        <Alert>
          <AlertTitle>Brouillon</AlertTitle>
          <AlertDescription>
            Modifiable tant qu'il n'est pas émis. L'émission attribue un numéro définitif et fige la facture.
          </AlertDescription>
        </Alert>
      ) : null}
      {inv.status === "cancelled" && inv.cancelReason ? (
        <Alert>
          <AlertTitle>Facture annulée</AlertTitle>
          <AlertDescription>{inv.cancelReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Amount
          label="Montant TTC"
          value={money(inv.amountTTC)}
          hint={`HT ${money(inv.amountHT)} + taxes ${money(inv.taxAmount)}`}
        />
        <Amount label="Payé" value={money(inv.paidAmount)} />
        <Amount label="Avoirs" value={money(inv.creditedAmount)} />
        <Amount
          label="Reste à payer"
          value={inv.status === "draft" || inv.status === "cancelled" ? "—" : money(inv.balance)}
          hint={inv.daysOverdue > 0 ? `${inv.daysOverdue} jours de retard` : `Échéance ${formatDate(inv.dueDate)}`}
          danger={inv.daysOverdue > 0}
        />
      </div>

      <Tabs defaultValue="details" className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="details">Détail</TabsTrigger>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
            <TabsTrigger value="credits">Avoirs ({inv.creditNotes.length})</TabsTrigger>
            <TabsTrigger value="reminders">Relances</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                items={[
                  { label: "Client", value: inv.organization.name },
                  {
                    label: "Souscription",
                    value: (
                      <Link
                        className="hover:underline"
                        href={`/dashboard/subscriptions/${inv.subscriptionId}`}
                        prefetch={false}
                      >
                        {inv.subscriptionReference}
                      </Link>
                    ),
                    mono: true,
                  },
                  { label: "Offre", value: `${inv.offer.name} (${inv.offer.code})` },
                  {
                    label: "Période facturée",
                    value: `${inv.periodLabel} (${formatDate(inv.periodStart)} → ${formatDate(inv.periodEnd)})`,
                  },
                  { label: "Date d'émission", value: formatDate(inv.issueDate) },
                  { label: "Date d'échéance", value: formatDate(inv.dueDate) },
                  { label: "Tarif unitaire", value: money(inv.unitPrice) },
                  { label: "Remise", value: `${inv.discountPercent} % (${money(inv.discountAmount)})` },
                  { label: "Taxes", value: `${inv.taxRate} % (${money(inv.taxAmount)})` },
                  {
                    label: "Envoi par e-mail",
                    value: inv.emailedAt ? `${formatDateTime(inv.emailedAt)} à ${inv.emailedTo}` : "Pas encore envoyée",
                  },
                  { label: "Observations", value: inv.observations ?? "—" },
                ]}
              />
            </CardContent>
          </Card>
          <LinesCard invoice={inv} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsCard invoiceId={inv.id} />
        </TabsContent>
        <TabsContent value="credits">
          <CreditNotesCard invoice={inv} />
        </TabsContent>
        <TabsContent value="reminders">
          <RemindersCard invoice={inv} />
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardContent>
              <ol className="relative flex flex-col gap-4 border-l pl-5">
                {[...inv.history].reverse().map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" />
                    <p className="font-medium text-sm">{e.action}</p>
                    <p className="text-sm">{e.description}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(e.at)} · {e.actor}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Amount({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="font-semibold text-lg tabular-nums sm:text-xl">{value}</span>
        {hint ? (
          <span className={danger ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>{hint}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LinesCard({ invoice }: { invoice: Invoice }) {
  const money = (n: number) => formatMoney(n, invoice.currency);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Véhicules facturés ({invoice.vehicleCount})</CardTitle>
        <CardDescription>Au prorata des jours d'affectation à la souscription sur la période.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead>Véhicule</TableHead>
                <TableHead className="hidden sm:table-cell">Période</TableHead>
                <TableHead className="text-right">Jours</TableHead>
                <TableHead className="hidden text-right md:table-cell">Tarif unitaire</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/vehicles/${l.vehicleId}`}
                      prefetch={false}
                      className="font-mono text-xs hover:underline"
                    >
                      {l.registration}
                    </Link>
                    {l.label ? <span className="text-muted-foreground text-xs"> · {l.label}</span> : null}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDate(l.startDate)} → {formatDate(l.endDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.days}/{l.periodDays}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{money(l.unitPrice)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right text-muted-foreground">
                  Sous-total · remise {invoice.discountPercent} % · HT · taxes {invoice.taxRate} %
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-xs tabular-nums">
                  {money(invoice.subtotal)} · −{money(invoice.discountAmount)} · {money(invoice.amountHT)} · +
                  {money(invoice.taxAmount)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">
                  Total TTC
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{money(invoice.amountTTC)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentsCard({ invoiceId }: { invoiceId: string }) {
  const payments = usePayments({ invoiceId, perPage: 100 });
  if (payments.isPending) return <LoadingRows rows={3} />;
  if (payments.isError) return <ErrorState error={payments.error} onRetry={() => payments.refetch()} />;
  const rows = payments.data.data;
  if (rows.length === 0)
    return (
      <EmptyState icon={<Wallet />} title="Aucun paiement" description="Aucun paiement imputé sur cette facture." />
    );
  return (
    <Card>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden sm:table-cell">Mode</TableHead>
                <TableHead className="hidden md:table-cell">Justificatif</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                  <TableCell>{formatDate(p.paidAt)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{p.methodLabel}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {p.attachment ? (
                      <span className="flex items-center gap-1 text-xs">
                        <Paperclip className="size-3.5" />
                        {p.attachment.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${p.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}
                  >
                    {formatMoney(p.amount, p.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={paymentStatusMeta[p.status].tone}>
                      {paymentStatusMeta[p.status].label}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CreditNotesCard({ invoice }: { invoice: Invoice }) {
  if (invoice.creditNotes.length === 0) {
    return <EmptyState icon={<FileMinus />} title="Aucun avoir" description="Aucun avoir émis sur cette facture." />;
  }
  return (
    <Card>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead>N° d'avoir</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.creditNotes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.number}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(c.createdAt)}</TableCell>
                  <TableCell className="max-w-80 truncate" title={c.reason}>
                    {c.reason}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(c.amount, c.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RemindersCard({ invoice }: { invoice: Invoice }) {
  const reminders = useReminders({ search: invoice.number ?? "—", perPage: 100 });
  if (!invoice.number) {
    return <EmptyState icon={<History />} title="Aucune relance" description="Un brouillon ne se relance pas." />;
  }
  if (reminders.isPending) return <LoadingRows rows={3} />;
  if (reminders.isError) return <ErrorState error={reminders.error} onRetry={() => reminders.refetch()} />;
  const rows = reminders.data.data.filter((r) => r.invoiceId === invoice.id);
  if (rows.length === 0)
    return <EmptyState icon={<Mail />} title="Aucune relance" description="Cette facture n'a jamais été relancée." />;
  return (
    <Card>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Montant dû</TableHead>
                <TableHead>Envoi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const level = reminderLevelMeta(r.level);
                const send = reminderSendStatusMeta[r.sendStatus];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.sentAt)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                    </TableCell>
                    <TableCell>{reminderChannelLabels[r.channel]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.amountDue, r.currency)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={send.tone}>{send.label}</StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
