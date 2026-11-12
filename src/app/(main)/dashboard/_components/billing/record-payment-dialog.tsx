"use client";

import { useEffect, useState } from "react";

import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useInvoices, usePaymentMethods, useRecordPayment } from "@/hooks/api/use-billing";
import { getErrorMessage } from "@/lib/axios";
import { formatDate } from "@/lib/format";
import type { Attachment, Invoice } from "@/types/billing";

const MAX_ATTACHMENT_KB = 5 * 1024;

/**
 * Écran 4 — saisie d'un paiement (total ou partiel) sur une facture émise.
 * Client → facture ouverte de ce client → montant (prérempli avec le reste à payer).
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice: presetInvoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Facture présélectionnée (depuis une fiche, une liste ou les relances). */
  invoice?: Invoice | null;
}) {
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [comment, setComment] = useState("");
  const record = useRecordPayment();
  const methods = usePaymentMethods();
  const invoices = useInvoices(
    { openOnly: true, organizationId, perPage: 100 },
    { enabled: open && Boolean(organizationId) },
  );

  const openInvoices = invoices.data?.data ?? [];
  const invoice =
    openInvoices.find((i) => i.id === invoiceId) ?? (presetInvoice?.id === invoiceId ? presetInvoice : null);
  const activeMethods = (methods.data ?? []).filter((m) => m.active);
  const value = Number(amount.replace(/\s/g, "").replace(",", "."));
  let amountError: string | null = null;
  if (amount !== "" && invoice) {
    if (!Number.isFinite(value) || value <= 0) amountError = "Montant invalide.";
    else if (value > invoice.balance) {
      amountError = `Supérieur au reste à payer (${formatMoney(invoice.balance, invoice.currency)}).`;
    }
  }
  const partial = invoice && !amountError && amount !== "" && value < invoice.balance;

  useEffect(() => {
    if (!open) return;
    setOrganizationId(presetInvoice?.organizationId);
    setInvoiceId(presetInvoice?.id ?? "");
    setAmount(presetInvoice ? String(presetInvoice.balance) : "");
    setMethodId("");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setTransactionRef("");
    setAttachment(null);
    setComment("");
  }, [open, presetInvoice]);

  useEffect(() => {
    if (!methodId && activeMethods.length > 0) setMethodId(activeMethods[0].id);
  }, [methodId, activeMethods]);

  function chooseInvoice(id: string) {
    setInvoiceId(id);
    const chosen = openInvoices.find((i) => i.id === id);
    if (chosen) setAmount(String(chosen.balance));
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const sizeKb = Math.ceil(file.size / 1024);
    if (sizeKb > MAX_ATTACHMENT_KB) {
      toast.error("Fichier trop lourd", { description: "5 Mo maximum." });
      return;
    }
    // Service simulé : seules les métadonnées sont conservées, le fichier sera envoyé à l'API.
    setAttachment({ name: file.name, sizeKb, type: file.type || "application/octet-stream" });
  }

  function submit() {
    if (!invoice || amountError || !paidAt || !methodId) return;
    record.mutate(
      { invoiceId: invoice.id, amount: value, methodId, paidAt, transactionRef, attachment, comment },
      {
        onSuccess: (payment) => {
          toast.success(partial ? "Paiement partiel enregistré" : "Paiement enregistré", {
            description: `${payment.reference} · ${formatMoney(payment.amount, payment.currency)} sur ${invoice.number}`,
          });
          onOpenChange(false);
        },
        onError: (error) => toast.error("Enregistrement impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !record.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Un paiement partiel laisse la facture ouverte ; son solde est mis à jour automatiquement.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="payment-client">Client</FieldLabel>
              <OrganizationSelect
                id="payment-client"
                className="w-full"
                value={organizationId}
                disabled={Boolean(presetInvoice)}
                onChange={(id) => {
                  setOrganizationId(id);
                  setInvoiceId("");
                  setAmount("");
                }}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="payment-invoice">Facture concernée</FieldLabel>
              <Select
                value={invoiceId}
                onValueChange={chooseInvoice}
                disabled={!organizationId || Boolean(presetInvoice) || invoices.isFetching}
              >
                <SelectTrigger id="payment-invoice" className="w-full">
                  <SelectValue
                    placeholder={organizationId ? "Choisir une facture ouverte" : "Choisir d'abord le client"}
                  >
                    {invoice ? invoice.number : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectGroup>
                    {openInvoices.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.number} · {i.periodLabel} · reste {formatMoney(i.balance, i.currency)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {organizationId && !invoices.isFetching && openInvoices.length === 0 && !presetInvoice ? (
                <FieldDescription>Aucune facture ouverte pour ce client.</FieldDescription>
              ) : null}
            </Field>
          </div>

          {invoice ? (
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">TTC · échéance {formatDate(invoice.dueDate)}</span>
                <span className="font-medium tabular-nums">{formatMoney(invoice.amountTTC, invoice.currency)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Déjà réglé / avoirs</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(invoice.paidAmount + invoice.creditedAmount, invoice.currency)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Reste à payer</span>
                <span className="font-semibold tabular-nums">{formatMoney(invoice.balance, invoice.currency)}</span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="payment-date">Date du paiement</FieldLabel>
              <Input id="payment-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
            <Field className="gap-1.5" data-invalid={Boolean(amountError)}>
              <FieldLabel htmlFor="payment-amount">Montant reçu ({invoice?.currency ?? "XOF"})</FieldLabel>
              <Input
                id="payment-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={Boolean(amountError)}
                disabled={!invoice}
              />
              {amountError ? <FieldError>{amountError}</FieldError> : null}
              {partial ? (
                <FieldDescription>
                  Paiement partiel : il restera {formatMoney(invoice.balance - value, invoice.currency)}.
                </FieldDescription>
              ) : null}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="payment-method">Mode de paiement</FieldLabel>
              <Select value={methodId} onValueChange={setMethodId} disabled={methods.isPending}>
                <SelectTrigger id="payment-method" className="w-full">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {activeMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="payment-ref">Référence de transaction</FieldLabel>
              <Input
                id="payment-ref"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="N° d'opération, de chèque…"
              />
            </Field>
          </div>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="payment-attachment">Pièce justificative</FieldLabel>
            {attachment ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Paperclip className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                <span className="text-muted-foreground text-xs">{attachment.sizeKb} Ko</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Retirer la pièce justificative"
                  onClick={() => setAttachment(null)}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <Input
                id="payment-attachment"
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            )}
            <FieldDescription>Reçu, avis de virement, capture Mobile Money… PDF ou image, 5 Mo max.</FieldDescription>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="payment-comment">Commentaire</FieldLabel>
            <Textarea
              id="payment-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optionnel"
              rows={2}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" disabled={record.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={record.isPending || !invoice || amount === "" || Boolean(amountError) || !paidAt || !methodId}
            onClick={submit}
          >
            {record.isPending ? <Spinner data-icon="inline-start" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
