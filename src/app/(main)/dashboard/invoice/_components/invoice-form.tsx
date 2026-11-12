"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Info, Save, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { invoiceKindLabels, offerPeriodicityLabels } from "@/components/status-labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCreateInvoice, useInvoice, useInvoicePreview, useUpdateInvoiceDraft } from "@/hooks/api/use-billing";
import { useSubscription, useSubscriptions } from "@/hooks/api/use-subscriptions";
import { getErrorMessage } from "@/lib/axios";
import {
  addDaysIso,
  computeInvoiceTotals,
  DEFAULT_PAYMENT_TERM_DAYS,
  periodLabel,
  repriceLines,
  todayIso,
  vehicleCount,
} from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { INVOICE_KINDS, type InvoiceDraftPayload, type InvoiceKind } from "@/types/billing";

function toNumber(value: string): number {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

/**
 * Écran 3 — création d'une facture, ou modification d'un brouillon (`invoiceId`).
 * Tout est prérempli depuis la souscription : offre, véhicules affectés sur la période
 * (au prorata), tarif unitaire et remise négociés.
 */
export function InvoiceForm({
  subscriptionId: presetSubscriptionId,
  invoiceId,
}: {
  subscriptionId?: string;
  invoiceId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(invoiceId);
  const existing = useInvoice(invoiceId);
  const presetSub = useSubscription(presetSubscriptionId);

  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [subscriptionId, setSubscriptionId] = useState<string | undefined>();
  const [kind, setKind] = useState<InvoiceKind>("standard");
  const [periodStart, setPeriodStart] = useState<string | undefined>();
  const [periodEnd, setPeriodEnd] = useState<string | undefined>();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [unitPrice, setUnitPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(addDaysIso(todayIso(), DEFAULT_PAYMENT_TERM_DAYS));
  const [observations, setObservations] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialisation depuis le brouillon (édition) ou depuis la souscription passée dans l'URL.
  useEffect(() => {
    if (initialized) return;
    if (editing && existing.data) {
      const inv = existing.data;
      setOrganizationId(inv.organizationId);
      setSubscriptionId(inv.subscriptionId);
      setKind(inv.kind);
      setPeriodStart(inv.periodStart);
      setPeriodEnd(inv.periodEnd);
      setSelected(new Set(inv.lines.map((l) => l.vehicleId)));
      setUnitPrice(String(inv.unitPrice));
      setDiscount(String(inv.discountPercent));
      setTaxRate(String(inv.taxRate));
      setIssueDate(inv.issueDate);
      setDueDate(inv.dueDate);
      setObservations(inv.observations ?? "");
      setInitialized(true);
    } else if (!editing && presetSubscriptionId && presetSub.data) {
      setOrganizationId(presetSub.data.organizationId);
      setSubscriptionId(presetSub.data.id);
      setInitialized(true);
    } else if (!editing && !presetSubscriptionId) {
      setInitialized(true);
    }
  }, [initialized, editing, existing.data, presetSubscriptionId, presetSub.data]);

  const subscriptions = useSubscriptions({ organizationId, perPage: 100 }, { enabled: Boolean(organizationId) });
  const billable = (subscriptions.data?.data ?? []).filter((s) => s.status !== "draft");
  const subscription = billable.find((s) => s.id === subscriptionId);
  const preview = useInvoicePreview(subscriptionId, periodStart, periodEnd);

  // Le premier aperçu fixe la période (cycle en cours) et les conditions commerciales.
  useEffect(() => {
    const p = preview.data;
    if (!p || p.subscriptionId !== subscriptionId) return;
    // Aperçu encore celui de l'ancienne période (placeholder) : on attend le bon.
    if (periodStart && periodEnd && (p.periodStart !== periodStart || p.periodEnd !== periodEnd)) return;
    if (!periodStart || !periodEnd) {
      setPeriodStart(p.periodStart);
      setPeriodEnd(p.periodEnd);
    }
    if (unitPrice === "") setUnitPrice(String(p.unitPrice));
    if (discount === "") setDiscount(String(p.discountPercent));
    if (taxRate === "") setTaxRate(String(p.taxRate));
    if (selected === null) setSelected(new Set(p.lines.map((l) => l.vehicleId)));
  }, [preview.data, subscriptionId, periodStart, periodEnd, unitPrice, discount, taxRate, selected]);

  function changeSubscription(id: string) {
    setSubscriptionId(id);
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setSelected(null);
    setUnitPrice("");
    setDiscount("");
    setTaxRate("");
  }

  const price = toNumber(unitPrice);
  const discountPct = toNumber(discount);
  const tax = toNumber(taxRate);
  const lines = useMemo(() => {
    const base = preview.data?.subscriptionId === subscriptionId ? (preview.data?.lines ?? []) : [];
    return Number.isFinite(price) ? repriceLines(base, price) : base;
  }, [preview.data, subscriptionId, price]);
  const chosen = lines.filter((l) => selected?.has(l.vehicleId));
  const totals = computeInvoiceTotals(
    chosen,
    Number.isFinite(discountPct) ? discountPct : 0,
    Number.isFinite(tax) ? tax : 0,
  );
  const currency = preview.data?.currency ?? subscription?.currency ?? "XOF";
  const money = (n: number) => formatMoney(n, currency);
  const duplicate =
    kind === "standard" && preview.data?.duplicateOf && preview.data.duplicateOf.id !== invoiceId
      ? preview.data.duplicateOf
      : null;

  const errors: string[] = [];
  if (!subscriptionId) errors.push("Choisissez une souscription.");
  if (periodStart && periodEnd && periodEnd < periodStart) errors.push("La fin de période précède son début.");
  if (chosen.length === 0 && subscriptionId) errors.push("Sélectionnez au moins un véhicule.");
  if (!Number.isFinite(price) || price < 0) errors.push("Tarif unitaire invalide.");
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) errors.push("Remise entre 0 et 100 %.");
  if (!Number.isFinite(tax) || tax < 0) errors.push("Taux de taxe invalide.");
  if (dueDate < issueDate) errors.push("L'échéance précède la date d'émission.");
  if (duplicate) errors.push("Période déjà facturée : choisissez « Complément » ou « Correction ».");

  const create = useCreateInvoice();
  const update = useUpdateInvoiceDraft();
  const saving = create.isPending || update.isPending;

  function save(issue: boolean) {
    if (errors.length > 0 || !subscriptionId || !periodStart || !periodEnd) {
      toast.error("Formulaire incomplet", { description: errors[0] });
      return;
    }
    const payload: InvoiceDraftPayload = {
      subscriptionId,
      kind,
      periodStart,
      periodEnd,
      vehicleIds: [...new Set(chosen.map((l) => l.vehicleId))],
      unitPrice: price,
      discountPercent: discountPct,
      taxRate: tax,
      issueDate,
      dueDate,
      observations,
      issue,
    };
    const handlers = {
      onSuccess: (inv: { id: string; number: string | null }) => {
        toast.success(issue ? "Facture émise" : "Brouillon enregistré", { description: inv.number ?? undefined });
        router.push(`/dashboard/invoice/${inv.id}`);
      },
      onError: (error: unknown) => toast.error("Enregistrement impossible", { description: getErrorMessage(error) }),
    };
    if (invoiceId) update.mutate({ id: invoiceId, payload }, handlers);
    else create.mutate(payload, handlers);
  }

  if (editing && existing.isPending) return <LoadingRows rows={8} />;
  if (editing && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  if (editing && existing.data && existing.data.status !== "draft") {
    return (
      <Alert>
        <Info />
        <AlertTitle>Facture émise : modification impossible</AlertTitle>
        <AlertDescription>
          Une facture émise ne se modifie pas directement. Émettez un avoir ou annulez-la depuis{" "}
          <Link className="underline" href={`/dashboard/invoice/${invoiceId}`} prefetch={false}>
            sa fiche
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  const allChecked = lines.length > 0 && lines.every((l) => selected?.has(l.vehicleId));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={editing ? "Modifier le brouillon" : "Nouvelle facture"}
        description="Préremplie à partir de la souscription : offre, véhicules affectés sur la période et conditions commerciales."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={invoiceId ? `/dashboard/invoice/${invoiceId}` : "/dashboard/invoice"} prefetch={false}>
                <ArrowLeft data-icon="inline-start" />
                Retour
              </Link>
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => save(false)}>
              {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              Enregistrer le brouillon
            </Button>
            <Button disabled={saving} onClick={() => save(true)}>
              <Send data-icon="inline-start" />
              Émettre
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Client et souscription</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="invoice-client">Client</FieldLabel>
                  <OrganizationSelect
                    id="invoice-client"
                    className="w-full"
                    value={organizationId}
                    disabled={editing}
                    onChange={(id) => {
                      setOrganizationId(id);
                      changeSubscription("");
                      setSubscriptionId(undefined);
                    }}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="invoice-subscription">Souscription</FieldLabel>
                  <Select
                    value={subscriptionId ?? ""}
                    onValueChange={changeSubscription}
                    disabled={editing || !organizationId || subscriptions.isPending}
                  >
                    <SelectTrigger id="invoice-subscription" className="w-full">
                      <SelectValue
                        placeholder={organizationId ? "Choisir une souscription" : "Choisir d'abord le client"}
                      />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {billable.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.reference} — {s.offer.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {organizationId && !subscriptions.isPending && billable.length === 0 ? (
                    <FieldDescription>Ce client n'a aucune souscription facturable.</FieldDescription>
                  ) : null}
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel>Offre</FieldLabel>
                  <Input
                    readOnly
                    value={subscription ? `${subscription.offer.name} (${subscription.offer.code})` : ""}
                  />
                  {subscription ? (
                    <FieldDescription>
                      Facturation {offerPeriodicityLabels[subscription.periodicity].toLowerCase()}
                    </FieldDescription>
                  ) : null}
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="invoice-kind">Type de facture</FieldLabel>
                  <Select value={kind} onValueChange={(v) => setKind(v as InvoiceKind)}>
                    <SelectTrigger id="invoice-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {INVOICE_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {invoiceKindLabels[k]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Complément ou correction : seulement si la période est déjà facturée.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Période et véhicules concernés</CardTitle>
              <CardDescription>
                Un véhicule affecté une partie de la période (ajout, retrait, changement d'offre) est facturé au prorata
                des jours.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="period-start">Début de période</FieldLabel>
                  <Input
                    id="period-start"
                    type="date"
                    value={periodStart ?? ""}
                    disabled={!subscriptionId}
                    onChange={(e) => {
                      setPeriodStart(e.target.value || undefined);
                      setSelected(null);
                    }}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="period-end">Fin de période</FieldLabel>
                  <Input
                    id="period-end"
                    type="date"
                    value={periodEnd ?? ""}
                    disabled={!subscriptionId}
                    onChange={(e) => {
                      setPeriodEnd(e.target.value || undefined);
                      setSelected(null);
                    }}
                  />
                </Field>
              </FieldGroup>
              {periodStart && periodEnd && periodEnd >= periodStart ? (
                <p className="text-muted-foreground text-sm">
                  Période facturée : {periodLabel(periodStart, periodEnd)}
                </p>
              ) : null}

              {duplicate ? (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertTitle>Période déjà facturée</AlertTitle>
                  <AlertDescription>
                    <span>
                      La facture{" "}
                      <Link className="underline" href={`/dashboard/invoice/${duplicate.id}`} prefetch={false}>
                        {duplicate.number ?? "brouillon"}
                      </Link>{" "}
                      couvre déjà cette période. Pour facturer en plus, choisissez le type « Complément » ou «
                      Correction ».
                    </span>
                  </AlertDescription>
                </Alert>
              ) : null}

              {!subscriptionId ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                  Choisissez une souscription pour charger ses véhicules.
                </p>
              ) : preview.isPending ? (
                <LoadingRows rows={3} />
              ) : preview.isError ? (
                <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
              ) : lines.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                  Aucun véhicule affecté à cette souscription sur la période.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="**:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            aria-label="Tout sélectionner"
                            checked={allChecked}
                            onCheckedChange={(v) =>
                              setSelected(v === true ? new Set(lines.map((l) => l.vehicleId)) : new Set())
                            }
                          />
                        </TableHead>
                        <TableHead>Véhicule</TableHead>
                        <TableHead className="hidden sm:table-cell">Affecté du … au …</TableHead>
                        <TableHead className="text-right">Jours</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <Checkbox
                              aria-label={`Facturer ${l.registration}`}
                              checked={selected?.has(l.vehicleId) ?? false}
                              onCheckedChange={(v) =>
                                setSelected((prev) => {
                                  const next = new Set(prev ?? []);
                                  if (v === true) next.add(l.vehicleId);
                                  else next.delete(l.vehicleId);
                                  return next;
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{l.registration}</span>
                            {l.label ? <span className="text-muted-foreground text-xs"> · {l.label}</span> : null}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {formatDate(l.startDate)} → {formatDate(l.endDate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {l.days < l.periodDays ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                {l.days}/{l.periodDays}
                              </span>
                            ) : (
                              `${l.days}/${l.periodDays}`
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{money(l.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates et observations</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="issue-date">Date d'émission</FieldLabel>
                  <Input
                    id="issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => {
                      setIssueDate(e.target.value);
                      if (e.target.value) setDueDate(addDaysIso(e.target.value, DEFAULT_PAYMENT_TERM_DAYS));
                    }}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="due-date">Date d'échéance</FieldLabel>
                  <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  <FieldDescription>Par défaut : {DEFAULT_PAYMENT_TERM_DAYS} jours après l'émission.</FieldDescription>
                </Field>
                <Field className="gap-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="observations">Observations</FieldLabel>
                  <Textarea
                    id="observations"
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Mention imprimée sur la facture (optionnel)"
                    rows={3}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle>Montants</CardTitle>
            <CardDescription>Repris des conditions commerciales de la souscription, modifiables.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup className="gap-3">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="unit-price">Tarif unitaire ({currency} / véhicule / période)</FieldLabel>
                <Input
                  id="unit-price"
                  inputMode="numeric"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="discount">Remise (%)</FieldLabel>
                  <Input
                    id="discount"
                    inputMode="decimal"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="tax-rate">Taxes / TVA (%)</FieldLabel>
                  <Input
                    id="tax-rate"
                    inputMode="decimal"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>

            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t pt-4 text-sm">
              <dt className="text-muted-foreground">Nombre de véhicules</dt>
              <dd className="text-right tabular-nums">{vehicleCount(chosen)}</dd>
              <dt className="text-muted-foreground">Sous-total</dt>
              <dd className="text-right tabular-nums">{money(totals.subtotal)}</dd>
              <dt className="text-muted-foreground">Remise</dt>
              <dd className="text-right tabular-nums">− {money(totals.discountAmount)}</dd>
              <dt className="font-medium">Montant HT</dt>
              <dd className="text-right font-medium tabular-nums">{money(totals.amountHT)}</dd>
              <dt className="text-muted-foreground">Taxes</dt>
              <dd className="text-right tabular-nums">{money(totals.taxAmount)}</dd>
              <dt className="border-t pt-2 font-semibold">Montant TTC</dt>
              <dd className="border-t pt-2 text-right font-semibold text-lg tabular-nums">{money(totals.amountTTC)}</dd>
            </dl>

            {errors.length > 0 && subscriptionId ? (
              <ul className="flex list-disc flex-col gap-1 pl-4 text-destructive text-xs">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
