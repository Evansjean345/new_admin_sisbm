"use client";

import { useEffect, useState } from "react";

import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { PersonSelect } from "@/app/(main)/dashboard/_components/alerting/person-select";
import { channelLabels } from "@/components/alerting-labels";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useAssignAlert,
  useNotificationTemplates,
  useResolveAlert,
  useSendAlertNotification,
} from "@/hooks/api/use-alerting";
import { getErrorMessage } from "@/lib/axios";
import { renderTemplate } from "@/services/alerting.service";
import {
  type Alert,
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type PersonRef,
  type Recipient,
} from "@/types/alerting";

type Props = { alert: Alert | null; onOpenChange: (open: boolean) => void };

export function AssignAlertDialog({ alert, onOpenChange }: Props) {
  const [assignee, setAssignee] = useState<PersonRef | null>(null);
  const assign = useAssignAlert();
  useEffect(() => {
    if (alert) setAssignee(alert.assignee);
  }, [alert]);
  if (!alert) return null;
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Assigner l'alerte ${alert.reference}`}
      description="Le responsable reçoit l'alerte dans sa liste de travail."
      confirmLabel="Assigner"
      loading={assign.isPending}
      onConfirm={() => {
        if (!assignee) {
          toast.error("Choisissez un responsable");
          return;
        }
        assign.mutate(
          { id: alert.id, assignee },
          {
            onSuccess: () => {
              toast.success("Alerte assignée", { description: assignee.name });
              onOpenChange(false);
            },
            onError: (e) => toast.error("Assignation impossible", { description: getErrorMessage(e) }),
          },
        );
      }}
    >
      <Field className="gap-1.5">
        <FieldLabel htmlFor="alert-assignee">Responsable</FieldLabel>
        <PersonSelect id="alert-assignee" value={{ assignee, queue: null }} onChange={(v) => setAssignee(v.assignee)} />
      </Field>
    </ConfirmDialog>
  );
}

export function ResolveAlertDialog({ alert, onOpenChange }: Props) {
  const [note, setNote] = useState("");
  const resolve = useResolveAlert();
  useEffect(() => {
    if (alert) setNote("");
  }, [alert]);
  if (!alert) return null;
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Clore l'alerte ${alert.reference}`}
      description="L'alerte est marquée comme traitée. Elle reste consultable avec son historique."
      confirmLabel="Marquer comme traitée"
      loading={resolve.isPending}
      onConfirm={() => {
        if (note.trim().length < 5) {
          toast.error("Indiquez comment l'alerte a été traitée", { description: "5 caractères minimum." });
          return;
        }
        resolve.mutate(
          { id: alert.id, note: note.trim() },
          {
            onSuccess: () => {
              toast.success("Alerte traitée");
              onOpenChange(false);
            },
            onError: (e) => toast.error("Action impossible", { description: getErrorMessage(e) }),
          },
        );
      }}
    >
      <Field className="gap-1.5">
        <FieldLabel htmlFor="alert-note">Traitement réalisé</FieldLabel>
        <Textarea
          id="alert-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex. : client joint, fausse alerte (véhicule au garage)."
        />
      </Field>
    </ConfirmDialog>
  );
}

/** Envoi manuel d'une notification (SMS, e-mail) à propos d'une alerte. */
export function SendNotificationDialog({ alert, onOpenChange }: Props) {
  const [channel, setChannel] = useState<NotificationChannel>("sms");
  const [templateId, setTemplateId] = useState("none");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [draft, setDraft] = useState("");
  const templates = useNotificationTemplates();
  const send = useSendAlertNotification();

  useEffect(() => {
    if (!alert) return;
    setChannel("sms");
    setTemplateId("none");
    setMessage(
      "ALERTE {{evenement}} — {{immatriculation}} ({{client}}) le {{date}} à {{heure}}. Position : {{localisation}}.",
    );
    setRecipients([]);
    setDraft("");
  }, [alert]);

  if (!alert) return null;
  const usable = (templates.data ?? []).filter((t) => t.active && t.channel === channel);

  function addRecipient() {
    const v = draft.trim();
    if (!v) return;
    const kind = v.includes("@") ? "email" : "phone";
    setRecipients((r) => [...r, { kind, value: v, label: v }]);
    setDraft("");
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Notifier — ${alert.reference}`}
      description="Les variables {{…}} sont remplacées par les informations de l'alerte. L'envoi est historisé, même en cas d'échec."
      confirmLabel="Envoyer"
      loading={send.isPending}
      onConfirm={() =>
        send.mutate(
          { alertId: alert.id, channel, recipients, templateId: templateId === "none" ? null : templateId, message },
          {
            onSuccess: (sent) => {
              const failed = sent.filter((m) => m.transmission === "failed").length;
              if (failed > 0) toast.warning(`${failed} envoi(s) en échec`, { description: "Voir Gestion des SMS." });
              else toast.success("Notification envoyée");
              onOpenChange(false);
            },
            onError: (e) => toast.error("Envoi impossible", { description: getErrorMessage(e) }),
          },
        )
      }
    >
      <FieldGroup className="gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="notify-channel">Canal</FieldLabel>
            <Select value={channel} onValueChange={(v) => setChannel(v as NotificationChannel)}>
              <SelectTrigger id="notify-channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {NOTIFICATION_CHANNELS.filter((c) => c !== "push").map((c) => (
                    <SelectItem key={c} value={c}>
                      {channelLabels[c]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="notify-template">Modèle</FieldLabel>
            <Select
              value={templateId}
              onValueChange={(v) => {
                setTemplateId(v);
                const t = usable.find((x) => x.id === v);
                if (t) setMessage(t.content);
              }}
            >
              <SelectTrigger id="notify-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="none">Message libre</SelectItem>
                  {usable.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="notify-to">Destinataires</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="notify-to"
              value={draft}
              placeholder={channel === "sms" ? "+225 07 00 00 00 00" : "contact@client.ci"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRecipient();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Ajouter le destinataire"
              onClick={addRecipient}
            >
              <Plus />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recipients.map((r, i) => (
              <Badge key={`${r.value}-${i}`} variant="secondary" className="gap-1">
                {r.value}
                <button
                  type="button"
                  aria-label={`Retirer ${r.value}`}
                  onClick={() => setRecipients((all) => all.filter((_, j) => j !== i))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="notify-message">Message</FieldLabel>
          <Textarea id="notify-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          <FieldDescription className="rounded-md bg-muted/50 p-2 text-xs">
            Aperçu : {renderTemplate(message, alert)}
          </FieldDescription>
        </Field>
      </FieldGroup>
    </ConfirmDialog>
  );
}
