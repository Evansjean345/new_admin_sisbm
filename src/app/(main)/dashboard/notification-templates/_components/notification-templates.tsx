"use client";

import { useEffect, useRef, useState } from "react";

import { FileText, FlaskConical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { channelLabels, eventTypeLabels } from "@/components/alerting-labels";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useNotificationTemplates, useSaveNotificationTemplate } from "@/hooks/api/use-alerting";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime } from "@/lib/format";
import {
  EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationTemplate,
  type NotificationTemplatePayload,
  TEMPLATE_VARIABLES,
} from "@/types/alerting";

/** Valeurs d'exemple pour l'aperçu. */
const SAMPLE: Record<string, string> = {
  client: "Transports Koné",
  vehicule: "Camion benne 12",
  immatriculation: "AB-1234-CI",
  date: "12/11/2026",
  heure: "14:32",
  localisation: "Autoroute du Nord, PK 24",
  evenement: "Excès de vitesse",
  vitesse: "112 km/h",
};

const preview = (text: string) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => SAMPLE[k] ?? m);

/** Écran 4 — Modèles de notifications (§IV.2). */
export function NotificationTemplates() {
  const templates = useNotificationTemplates();
  const [editing, setEditing] = useState<{ open: boolean; template: NotificationTemplate | null }>({
    open: false,
    template: null,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Modèles de notifications"
        description="Textes types des SMS, e-mails et notifications, avec variables remplacées à l'envoi."
        actions={
          <Button onClick={() => setEditing({ open: true, template: null })}>
            <Plus data-icon="inline-start" />
            Nouveau modèle
          </Button>
        }
      />
      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>Modèles simulés en attendant l'API ; perdus au rechargement.</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="px-0">
          {templates.isPending ? (
            <LoadingRows rows={4} />
          ) : templates.isError ? (
            <div className="px-4">
              <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
            </div>
          ) : templates.data.length === 0 ? (
            <div className="px-4">
              <EmptyState icon={<FileText />} title="Aucun modèle" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom du modèle</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="hidden lg:table-cell">Objet</TableHead>
                    <TableHead className="hidden xl:table-cell">Contenu</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Modifier</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.name}
                        <span className="block text-muted-foreground text-xs">
                          Modifié le {formatDateTime(t.updatedAt)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {t.type === "general" ? "Général" : eventTypeLabels[t.type]}
                      </TableCell>
                      <TableCell>{channelLabels[t.channel]}</TableCell>
                      <TableCell className="hidden lg:table-cell">{t.subject}</TableCell>
                      <TableCell className="hidden max-w-80 xl:table-cell">
                        <p className="line-clamp-2 text-muted-foreground text-xs">{t.content}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={t.active ? "success" : "neutral"}>
                          {t.active ? "Actif" : "Inactif"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Modifier ${t.name}`}
                          onClick={() => setEditing({ open: true, template: t })}
                        >
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateDialog
        open={editing.open}
        template={editing.template}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
      />
    </div>
  );
}

const EMPTY: NotificationTemplatePayload = {
  name: "",
  type: "general",
  subject: "",
  content: "",
  channel: "sms",
  active: true,
};

function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: NotificationTemplate | null;
}) {
  const [form, setForm] = useState<NotificationTemplatePayload>(EMPTY);
  const save = useSaveNotificationTemplate();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    if (template) {
      const { id: _i, updatedAt: _u, ...rest } = template;
      setForm(rest);
    } else setForm(EMPTY);
  }, [open, template]);

  const set = <K extends keyof NotificationTemplatePayload>(k: K, v: NotificationTemplatePayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  /** Insère la variable à la position du curseur. */
  function insert(variable: string) {
    const token = `{{${variable}}}`;
    const el = contentRef.current;
    const start = el?.selectionStart ?? form.content.length;
    const end = el?.selectionEnd ?? form.content.length;
    const next = form.content.slice(0, start) + token + form.content.slice(end);
    set("content", next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const smsLength = preview(form.content).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle>
          <DialogDescription>Cliquez sur une variable pour l'insérer dans le contenu.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="tpl-name">Nom du modèle</FieldLabel>
              <Input id="tpl-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="tpl-type">Type</FieldLabel>
              <Select value={form.type} onValueChange={(v) => set("type", v as NotificationTemplatePayload["type"])}>
                <SelectTrigger id="tpl-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectGroup>
                    <SelectItem value="general">Général (tous événements)</SelectItem>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {eventTypeLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="tpl-channel">Canal</FieldLabel>
              <Select value={form.channel} onValueChange={(v) => set("channel", v as NotificationChannel)}>
                <SelectTrigger id="tpl-channel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {NOTIFICATION_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {channelLabels[c]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="tpl-subject">Objet</FieldLabel>
              <Input id="tpl-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>
          </div>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="tpl-content">Contenu</FieldLabel>
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARIABLES.map((v) => (
                <Badge key={v} asChild variant="outline" className="cursor-pointer font-mono hover:bg-muted">
                  <button type="button" onClick={() => insert(v)}>{`{{${v}}}`}</button>
                </Badge>
              ))}
            </div>
            <Textarea
              id="tpl-content"
              ref={contentRef}
              rows={5}
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
            />
            {form.channel === "sms" ? (
              <FieldDescription>
                {smsLength} caractères · {Math.max(1, Math.ceil(smsLength / 160))} SMS facturé(s)
              </FieldDescription>
            ) : null}
          </Field>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="mb-1 font-medium text-muted-foreground text-xs uppercase">Aperçu</p>
            {form.channel !== "sms" && form.subject ? <p className="font-medium">{preview(form.subject)}</p> : null}
            <p className="whitespace-pre-line">{preview(form.content) || "—"}</p>
          </div>
          <Field orientation="horizontal">
            <Switch id="tpl-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
            <FieldLabel htmlFor="tpl-active" className="font-normal">
              Modèle actif
            </FieldLabel>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { payload: form, id: template?.id },
                {
                  onSuccess: () => {
                    toast.success("Modèle enregistré", { description: form.name });
                    onOpenChange(false);
                  },
                  onError: (e) => toast.error("Enregistrement impossible", { description: getErrorMessage(e) }),
                },
              )
            }
          >
            {save.isPending ? <Spinner data-icon="inline-start" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
