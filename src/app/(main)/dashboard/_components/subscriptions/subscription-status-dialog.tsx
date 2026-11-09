"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useSetSubscriptionStatus } from "@/hooks/api/use-subscriptions";
import { getErrorMessage } from "@/lib/axios";
import type { Subscription, SubscriptionStatus } from "@/types/subscription";

const COPY: Record<
  Exclude<SubscriptionStatus, "draft">,
  { title: string; description: string; confirm: string; success: string; destructive: boolean }
> = {
  active: {
    title: "Activer la souscription",
    description: "Les véhicules affectés bénéficieront des droits de l'offre.",
    confirm: "Activer",
    success: "Souscription activée",
    destructive: false,
  },
  suspended: {
    title: "Suspendre la souscription",
    description:
      "Une souscription suspendue n'ouvre plus de nouveaux droits commerciaux. Les affectations sont conservées.",
    confirm: "Suspendre",
    success: "Souscription suspendue",
    destructive: true,
  },
  terminated: {
    title: "Résilier la souscription",
    description:
      "Définitif : toutes les affectations de véhicules sont clôturées à la date du jour. L'historique est conservé.",
    confirm: "Résilier",
    success: "Souscription résiliée",
    destructive: true,
  },
};

/** Changement de statut avec motif obligatoire (historisé). */
export function SubscriptionStatusDialog({
  subscription,
  target,
  onOpenChange,
}: {
  subscription: Subscription;
  /** null = fermé. */
  target: Exclude<SubscriptionStatus, "draft"> | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const setStatus = useSetSubscriptionStatus();

  useEffect(() => {
    if (target) setReason("");
  }, [target]);

  if (!target) return null;
  const copy = COPY[target];
  const tooShort = reason.trim().length < 5;

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`${copy.title} ${subscription.reference} ?`}
      description={copy.description}
      confirmLabel={copy.confirm}
      destructive={copy.destructive}
      loading={setStatus.isPending}
      onConfirm={() => {
        if (tooShort) {
          toast.error("Motif obligatoire", { description: "5 caractères minimum." });
          return;
        }
        setStatus.mutate(
          { id: subscription.id, status: target, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success(copy.success, { description: subscription.reference });
              onOpenChange(false);
            },
            onError: (error) => toast.error("Changement impossible", { description: getErrorMessage(error) }),
          },
        );
      }}
    >
      <Field className="gap-1.5">
        <FieldLabel htmlFor="status-reason">Motif</FieldLabel>
        <Textarea
          id="status-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex. : impayé au 30/10, demande du client…"
        />
        <FieldDescription>Enregistré dans l'historique de la souscription.</FieldDescription>
      </Field>
    </ConfirmDialog>
  );
}
