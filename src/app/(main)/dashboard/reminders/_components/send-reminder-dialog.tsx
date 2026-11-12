"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { StatusBadge } from "@/components/status-badge";
import { reminderChannelLabels, reminderLevelMeta } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useSendReminders } from "@/hooks/api/use-billing";
import { getErrorMessage } from "@/lib/axios";
import { type Invoice, REMINDER_CHANNELS, type ReminderChannel } from "@/types/billing";

/** Envoi d'une relance sur une ou plusieurs factures : chaque facture passe au niveau suivant. */
export function SendReminderDialog({
  invoices,
  onOpenChange,
  onSent,
}: {
  /** Liste vide = fermé. */
  invoices: Invoice[];
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) {
  const open = invoices.length > 0;
  const [channels, setChannels] = useState<ReminderChannel[]>(["email"]);
  const [message, setMessage] = useState("");
  const send = useSendReminders();

  useEffect(() => {
    if (open) {
      setChannels(["email"]);
      setMessage("");
    }
  }, [open]);

  const total = invoices.reduce((sum, i) => sum + i.balance, 0);
  const currency = invoices[0]?.currency ?? "XOF";

  function toggle(channel: ReminderChannel, checked: boolean) {
    setChannels((prev) => (checked ? [...new Set([...prev, channel])] : prev.filter((c) => c !== channel)));
  }

  function submit() {
    send.mutate(
      { invoiceIds: invoices.map((i) => i.id), channels, message },
      {
        onSuccess: (sent) => {
          toast.success(`${sent.length} relance${sent.length > 1 ? "s" : ""} envoyée${sent.length > 1 ? "s" : ""}`, {
            description: `${invoices.length} facture${invoices.length > 1 ? "s" : ""} · ${channels
              .map((c) => reminderChannelLabels[c])
              .join(" + ")}`,
          });
          onSent?.();
          onOpenChange(false);
        },
        onError: (error) => toast.error("Envoi impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !send.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Relancer {invoices.length > 1 ? `${invoices.length} factures` : invoices[0]?.number}
          </DialogTitle>
          <DialogDescription>
            Reste à payer total : {formatMoney(total, currency)}. Chaque facture passe au niveau de relance suivant.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <ul className="flex max-h-48 flex-col divide-y overflow-y-auto rounded-lg border text-sm">
            {invoices.map((i) => {
              const next = reminderLevelMeta(Math.min(3, i.reminderLevel + 1));
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{i.organization.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {i.number} · {formatMoney(i.balance, i.currency)} · {i.daysOverdue} j de retard
                    </span>
                  </div>
                  <StatusBadge tone={next.tone}>{next.label}</StatusBadge>
                </li>
              );
            })}
          </ul>

          <FieldSet>
            <FieldLegend variant="label">Canaux d'envoi</FieldLegend>
            <div className="flex flex-wrap gap-4">
              {REMINDER_CHANNELS.map((c) => (
                <Field key={c} orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={`reminder-channel-${c}`}
                    checked={channels.includes(c)}
                    onCheckedChange={(v) => toggle(c, v === true)}
                  />
                  <FieldLabel htmlFor={`reminder-channel-${c}`} className="font-normal">
                    {reminderChannelLabels[c]}
                  </FieldLabel>
                </Field>
              ))}
            </div>
            {channels.length === 0 ? <FieldDescription>Choisissez au moins un canal.</FieldDescription> : null}
          </FieldSet>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="reminder-message">Message personnalisé</FieldLabel>
            <Textarea
              id="reminder-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Laisser vide pour utiliser le modèle du niveau de relance (montant et échéance renseignés automatiquement)."
              rows={3}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" disabled={send.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={send.isPending || channels.length === 0} onClick={submit}>
            {send.isPending ? <Spinner data-icon="inline-start" /> : null}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
