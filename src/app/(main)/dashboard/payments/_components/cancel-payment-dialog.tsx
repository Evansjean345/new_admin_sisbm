"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useCancelPayment } from "@/hooks/api/use-billing";
import { getErrorMessage } from "@/lib/axios";
import type { Payment } from "@/types/billing";

/** Annulation d'un paiement : motif obligatoire, le paiement reste visible (traçabilité). */
export function CancelPaymentDialog({
  payment,
  onOpenChange,
}: {
  /** null = fermé. */
  payment: Payment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const cancel = useCancelPayment();

  useEffect(() => {
    if (payment) setReason("");
  }, [payment]);

  if (!payment) return null;
  const tooShort = reason.trim().length < 5;

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Annuler le paiement ${payment.reference} ?`}
      description={`${formatMoney(payment.amount, payment.currency)} seront retirés de la facture ${payment.invoiceNumber}, qui redeviendra ouverte. Le paiement reste dans l'historique.`}
      confirmLabel="Annuler le paiement"
      destructive
      loading={cancel.isPending}
      onConfirm={() => {
        if (tooShort) {
          toast.error("Motif obligatoire", { description: "5 caractères minimum." });
          return;
        }
        cancel.mutate(
          { id: payment.id, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success("Paiement annulé", { description: payment.reference });
              onOpenChange(false);
            },
            onError: (error) => toast.error("Annulation impossible", { description: getErrorMessage(error) }),
          },
        );
      }}
    >
      <Field className="gap-1.5">
        <FieldLabel htmlFor="cancel-payment-reason">Motif</FieldLabel>
        <Textarea
          id="cancel-payment-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex. : chèque rejeté, saisie en double…"
        />
        <FieldDescription>Visible dans la liste des paiements.</FieldDescription>
      </Field>
    </ConfirmDialog>
  );
}
