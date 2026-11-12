"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useBillingContactEmail,
  useCancelInvoice,
  useCreateCreditNote,
  useEmailInvoice,
  useIssueInvoice,
} from "@/hooks/api/use-billing";
import { getErrorMessage } from "@/lib/axios";
import type { Invoice } from "@/types/billing";

/** Les dialogues reçoivent `invoice = null` quand ils sont fermés. */
type DialogProps = { invoice: Invoice | null; onOpenChange: (open: boolean) => void };

export function IssueInvoiceDialog({ invoice, onOpenChange }: DialogProps) {
  const issue = useIssueInvoice();
  if (!invoice) return null;
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Émettre la facture ?"
      description={`Un numéro définitif est attribué et la facture de ${formatMoney(invoice.amountTTC, invoice.currency)} TTC (${invoice.organization.name}, ${invoice.periodLabel}) ne pourra plus être modifiée : toute correction passera par un avoir.`}
      confirmLabel="Émettre"
      loading={issue.isPending}
      onConfirm={() =>
        issue.mutate(invoice.id, {
          onSuccess: (inv) => {
            toast.success("Facture émise", { description: inv.number ?? undefined });
            onOpenChange(false);
          },
          onError: (error) => toast.error("Émission impossible", { description: getErrorMessage(error) }),
        })
      }
    />
  );
}

/** Annulation selon les règles comptables : abandon d'un brouillon, avoir total pour une facture émise. */
export function CancelInvoiceDialog({ invoice, onOpenChange }: DialogProps) {
  const [reason, setReason] = useState("");
  const cancel = useCancelInvoice();

  useEffect(() => {
    if (invoice) setReason("");
  }, [invoice]);

  if (!invoice) return null;
  const draft = invoice.status === "draft";
  const blocked = !draft && invoice.paidAmount > 0;
  let description: string;
  if (draft) description = "Le brouillon est abandonné ; il reste consultable dans la liste, au statut « Annulée ».";
  else if (blocked) {
    description = `Des paiements (${formatMoney(invoice.paidAmount, invoice.currency)}) sont imputés sur cette facture : annulez-les d'abord, ou émettez un avoir partiel sur le reste à payer.`;
  } else {
    description = `Un avoir de ${formatMoney(invoice.balance, invoice.currency)} est émis automatiquement pour solder la facture. Le numéro ${invoice.number} n'est jamais réutilisé.`;
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={draft ? "Abandonner le brouillon ?" : `Annuler la facture ${invoice.number} ?`}
      description={description}
      confirmLabel={draft ? "Abandonner" : "Annuler la facture"}
      destructive
      loading={cancel.isPending}
      onConfirm={() => {
        if (blocked) {
          onOpenChange(false);
          return;
        }
        if (reason.trim().length < 5) {
          toast.error("Motif obligatoire", { description: "5 caractères minimum." });
          return;
        }
        cancel.mutate(
          { id: invoice.id, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success(draft ? "Brouillon abandonné" : "Facture annulée");
              onOpenChange(false);
            },
            onError: (error) => toast.error("Annulation impossible", { description: getErrorMessage(error) }),
          },
        );
      }}
    >
      {blocked ? null : (
        <Field className="gap-1.5">
          <FieldLabel htmlFor="cancel-invoice-reason">Motif</FieldLabel>
          <Textarea
            id="cancel-invoice-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : facture émise sur la mauvaise souscription…"
          />
          <FieldDescription>Enregistré dans l'historique de la facture.</FieldDescription>
        </Field>
      )}
    </ConfirmDialog>
  );
}

/** Avoir partiel ou total, plafonné au reste à payer. */
export function CreditNoteDialog({ invoice, onOpenChange }: DialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const create = useCreateCreditNote();

  useEffect(() => {
    if (invoice) {
      setAmount("");
      setReason("");
    }
  }, [invoice]);

  if (!invoice) return null;
  const value = Number(amount.replace(/\s/g, "").replace(",", "."));
  let amountError: string | null = null;
  if (amount !== "") {
    if (!Number.isFinite(value) || value <= 0) amountError = "Montant invalide.";
    else if (value > invoice.balance) {
      amountError = `Supérieur au reste à payer (${formatMoney(invoice.balance, invoice.currency)}).`;
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Émettre un avoir sur ${invoice.number}`}
      description={`L'avoir réduit le reste à payer (${formatMoney(invoice.balance, invoice.currency)}). Il est numéroté et historisé ; la facture d'origine n'est pas modifiée.`}
      confirmLabel="Émettre l'avoir"
      loading={create.isPending}
      onConfirm={() => {
        if (amount === "" || amountError) {
          toast.error("Montant à corriger", { description: amountError ?? "Saisissez un montant." });
          return;
        }
        if (reason.trim().length < 5) {
          toast.error("Motif obligatoire", { description: "5 caractères minimum." });
          return;
        }
        create.mutate(
          { id: invoice.id, amount: value, reason: reason.trim() },
          {
            onSuccess: (note) => {
              toast.success("Avoir émis", {
                description: `${note.number} · ${formatMoney(note.amount, note.currency)}`,
              });
              onOpenChange(false);
            },
            onError: (error) => toast.error("Avoir impossible", { description: getErrorMessage(error) }),
          },
        );
      }}
    >
      <FieldGroup className="gap-4">
        <Field className="gap-1.5" data-invalid={Boolean(amountError)}>
          <FieldLabel htmlFor="credit-amount">Montant TTC ({invoice.currency})</FieldLabel>
          <Input
            id="credit-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(invoice.balance)}
            aria-invalid={Boolean(amountError)}
          />
          {amountError ? <FieldError>{amountError}</FieldError> : null}
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="credit-reason">Motif</FieldLabel>
          <Textarea
            id="credit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : véhicule facturé après son retrait, geste commercial…"
          />
        </Field>
      </FieldGroup>
    </ConfirmDialog>
  );
}

/** Envoi par e-mail (passerelle e-mail simulée). */
export function EmailInvoiceDialog({ invoice, onOpenChange }: DialogProps) {
  const [to, setTo] = useState("");
  const send = useEmailInvoice();
  const contact = useBillingContactEmail(invoice?.organizationId);

  useEffect(() => {
    if (invoice) setTo(invoice.emailedTo ?? contact.data ?? "");
  }, [invoice, contact.data]);

  if (!invoice) return null;
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Envoyer ${invoice.number} par e-mail`}
      description="La facture est envoyée en PDF au destinataire. L'envoi est tracé dans l'historique."
      confirmLabel="Envoyer"
      loading={send.isPending}
      onConfirm={() =>
        send.mutate(
          { id: invoice.id, to: to.trim() },
          {
            onSuccess: () => {
              toast.success("Facture envoyée", { description: to.trim() });
              onOpenChange(false);
            },
            onError: (error) => toast.error("Envoi impossible", { description: getErrorMessage(error) }),
          },
        )
      }
    >
      <Field className="gap-1.5">
        <FieldLabel htmlFor="invoice-email-to">Destinataire</FieldLabel>
        <Input
          id="invoice-email-to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="comptabilite@client.ci"
        />
        <FieldDescription>
          {contact.data ? "Prérempli avec l'e-mail de contact du client." : "Aucun e-mail de contact sur le client."}
        </FieldDescription>
      </Field>
    </ConfirmDialog>
  );
}
