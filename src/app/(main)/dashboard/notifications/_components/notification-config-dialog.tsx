"use client";

import { useEffect, useState } from "react";

import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { channelLabels, eventTypeLabels, severityMeta, weekDayLabels } from "@/components/alerting-labels";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useNotificationTemplates, useSaveNotificationConfig } from "@/hooks/api/use-alerting";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { getErrorMessage } from "@/lib/axios";
import {
  type EventType,
  type NotificationChannel,
  type NotificationConfig,
  type NotificationConfigPayload,
  type Recipient,
  SEVERITIES,
  type Severity,
} from "@/types/alerting";
import { RULE_FORM_EVENT_TYPES } from "@/types/client-rules";

const CONFIGURABLE_NOTIFICATION_CHANNELS: readonly NotificationChannel[] = ["sms", "email"];

const EMPTY: NotificationConfigPayload = {
  name: "",
  trigger: "overspeed",
  organizationId: null,
  vehicleIds: [],
  recipients: [],
  channels: ["sms"],
  templateId: null,
  priority: "medium",
  window: { always: true, days: [1, 2, 3, 4, 5, 6, 7], from: "00:00", to: "23:59" },
  cooldownMinutes: 15,
  active: true,
};

/** Écran 2 — création / modification d'une configuration de notification (§IV.2). */
export function NotificationConfigDialog({
  open,
  onOpenChange,
  config,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: NotificationConfig | null;
}) {
  const [form, setForm] = useState<NotificationConfigPayload>(EMPTY);
  const [draft, setDraft] = useState("");
  const save = useSaveNotificationConfig();
  const templates = useNotificationTemplates();
  const vehicles = useVehicles(
    { organizationId: form.organizationId ?? undefined, perPage: 100 },
    { enabled: open && Boolean(form.organizationId) },
  );

  useEffect(() => {
    if (!open) return;
    if (config) {
      const { id: _id, organization: _org, updatedAt: _u, ...rest } = config;
      setForm({
        ...rest,
        channels: rest.channels.filter((channel) => CONFIGURABLE_NOTIFICATION_CHANNELS.includes(channel)),
      });
    } else setForm(EMPTY);
    setDraft("");
  }, [open, config]);

  const set = <K extends keyof NotificationConfigPayload>(k: K, v: NotificationConfigPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function addRecipient() {
    const v = draft.trim();
    if (!v) return;
    const r: Recipient = { kind: v.includes("@") ? "email" : "phone", value: v, label: v };
    set("recipients", [...form.recipients, r]);
    setDraft("");
  }

  function submit() {
    save.mutate(
      { payload: form, id: config?.id },
      {
        onSuccess: () => {
          toast.success(config ? "Configuration modifiée" : "Configuration créée", { description: form.name });
          onOpenChange(false);
        },
        onError: (e) => toast.error("Enregistrement impossible", { description: getErrorMessage(e) }),
      },
    );
  }

  const usableTemplates = (templates.data ?? []).filter(
    (t) => form.channels.includes(t.channel) && (t.type === "general" || t.type === form.trigger),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{config ? "Modifier la configuration" : "Nouvelle configuration de notification"}</DialogTitle>
          <DialogDescription>
            Quand l'événement survient, qui est prévenu, par quel canal et à quelles heures.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="nc-name">Nom de la configuration</FieldLabel>
            <Input
              id="nc-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex. : Excès de vitesse — direction"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="nc-client">Organisation</FieldLabel>
              <OrganizationSelect
                id="nc-client"
                className="w-full"
                allowAll
                placeholder="Toutes les organisations"
                value={form.organizationId ?? undefined}
                onChange={(id) => setForm((f) => ({ ...f, organizationId: id ?? null, vehicleIds: [] }))}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="nc-trigger">Règle déclencheur</FieldLabel>
              <Select value={form.trigger} onValueChange={(v) => set("trigger", v as EventType)}>
                <SelectTrigger id="nc-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectGroup>
                    {RULE_FORM_EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {eventTypeLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="nc-priority">Priorité</FieldLabel>
              <Select value={form.priority} onValueChange={(v) => set("priority", v as Severity)}>
                <SelectTrigger id="nc-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {severityMeta[s].label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="nc-vehicles">Véhicules concernés</FieldLabel>
              <Select
                value=""
                onValueChange={(v) => !form.vehicleIds.includes(v) && set("vehicleIds", [...form.vehicleIds, v])}
                disabled={!form.organizationId}
              >
                <SelectTrigger id="nc-vehicles" className="w-full">
                  <SelectValue
                    placeholder={
                      !form.organizationId
                        ? "Tous (choisir un client pour restreindre)"
                        : form.vehicleIds.length
                          ? `${form.vehicleIds.length} véhicule(s)`
                          : "Tous les véhicules du client"
                    }
                  />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectGroup>
                    {(vehicles.data?.data ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.registration}
                        {v.label ? ` — ${v.label}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {form.vehicleIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {form.vehicleIds.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1 font-mono">
                      {vehicles.data?.data.find((v) => v.id === id)?.registration ?? "…"}
                      <button
                        type="button"
                        aria-label="Retirer"
                        onClick={() =>
                          set(
                            "vehicleIds",
                            form.vehicleIds.filter((x) => x !== id),
                          )
                        }
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Field>
          </div>

          <FieldSet>
            <FieldLegend variant="label">Canaux</FieldLegend>
            <div className="flex flex-wrap gap-4">
              {CONFIGURABLE_NOTIFICATION_CHANNELS.map((c) => (
                <Field key={c} orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={`nc-ch-${c}`}
                    checked={form.channels.includes(c)}
                    onCheckedChange={(v) =>
                      set(
                        "channels",
                        v === true ? [...form.channels, c] : form.channels.filter((x) => x !== c),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`nc-ch-${c}`} className="font-normal">
                    {channelLabels[c]}
                  </FieldLabel>
                </Field>
              ))}
            </div>
            {form.channels.length === 0 ? (
              <FieldDescription role="alert">
                Sélectionnez SMS ou e-mail pour enregistrer cette configuration.
              </FieldDescription>
            ) : null}
          </FieldSet>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="nc-recipient">Destinataires</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="nc-recipient"
                value={draft}
                placeholder="+225 07 00 00 00 00 ou contact@client.ci"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" aria-label="Ajouter" onClick={addRecipient}>
                <Plus />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.recipients.map((r, i) => (
                <Badge key={`${r.value}-${i}`} variant="secondary" className="gap-1">
                  {r.label}
                  <button
                    type="button"
                    aria-label={`Retirer ${r.label}`}
                    onClick={() =>
                      set(
                        "recipients",
                        form.recipients.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="nc-template">Modèle de message</FieldLabel>
            <Select value={form.templateId ?? "none"} onValueChange={(v) => set("templateId", v === "none" ? null : v)}>
              <SelectTrigger id="nc-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="none">Message par défaut</SelectItem>
                  {usableTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({channelLabels[t.channel]})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Horaires d'envoi</FieldLegend>
            <Field orientation="horizontal">
              <Switch
                id="nc-always"
                checked={form.window.always}
                onCheckedChange={(v) => set("window", { ...form.window, always: v })}
              />
              <FieldLabel htmlFor="nc-always" className="font-normal">
                24 h/24, 7 j/7
              </FieldLabel>
            </Field>
            {form.window.always ? null : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1">
                  {weekDayLabels.map((d, i) => {
                    const day = i + 1;
                    const on = form.window.days.includes(day);
                    return (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={on ? "default" : "outline"}
                        aria-pressed={on}
                        onClick={() =>
                          set("window", {
                            ...form.window,
                            days: on ? form.window.days.filter((x) => x !== day) : [...form.window.days, day].sort(),
                          })
                        }
                      >
                        {d}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  De
                  <Input
                    type="time"
                    className="w-32"
                    value={form.window.from}
                    onChange={(e) => set("window", { ...form.window, from: e.target.value })}
                  />
                  à
                  <Input
                    type="time"
                    className="w-32"
                    value={form.window.to}
                    onChange={(e) => set("window", { ...form.window, to: e.target.value })}
                  />
                </div>
              </div>
            )}
          </FieldSet>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="nc-cooldown">Délai anti-répétition (minutes)</FieldLabel>
              <Input
                id="nc-cooldown"
                type="number"
                min={0}
                value={form.cooldownMinutes}
                onChange={(e) => set("cooldownMinutes", Math.max(0, Number(e.target.value) || 0))}
              />
              <FieldDescription>
                Pas deux envois pour le même véhicule et le même événement dans ce délai.
              </FieldDescription>
            </Field>
            <Field orientation="horizontal" className="self-center">
              <Switch id="nc-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
              <FieldLabel htmlFor="nc-active" className="font-normal">
                Configuration active
              </FieldLabel>
            </Field>
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={save.isPending} onClick={submit}>
            {save.isPending ? <Spinner data-icon="inline-start" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
