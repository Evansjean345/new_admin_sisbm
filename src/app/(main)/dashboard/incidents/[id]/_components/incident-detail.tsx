"use client";

import { useState } from "react";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowUpCircle,
  CircleCheck,
  Lock,
  MessageSquare,
  Paperclip,
  Pause,
  Play,
  RotateCcw,
  UserPlus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { PersonSelect } from "@/app/(main)/dashboard/_components/alerting/person-select";
import {
  alertStatusMeta,
  eventTypeLabels,
  incidentCategoryLabels,
  incidentEventLabels,
  incidentSourceLabels,
  incidentStatusMeta,
  incidentTypeLabels,
  severityMeta,
} from "@/components/alerting-labels";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailList } from "@/components/detail-list";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAlerts } from "@/hooks/api/use-alerting";
import {
  useAddIncidentAction,
  useAddIncidentAttachment,
  useAddIncidentComment,
  useAssignIncident,
  useEscalateIncident,
  useIncident,
  useReopenIncident,
  useSetIncidentPriority,
  useSetIncidentStatus,
} from "@/hooks/api/use-incidents";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime } from "@/lib/format";
import { type PersonRef, SEVERITIES, type Severity } from "@/types/alerting";
import type { Incident, IncidentStatus } from "@/types/incident";

type Dialog =
  | { kind: "assign" }
  | { kind: "priority" }
  | { kind: "escalate" }
  | { kind: "reopen" }
  | { kind: "status"; status: IncidentStatus }
  | null;

const STATUS_COPY: Partial<Record<IncidentStatus, { title: string; label: string; needsReport?: boolean }>> = {
  in_progress: { title: "Démarrer / reprendre le traitement", label: "Passer en cours" },
  on_hold: { title: "Mettre en attente", label: "Mettre en attente" },
  resolved: { title: "Résoudre l'incident", label: "Résoudre", needsReport: true },
  closed: { title: "Clôturer l'incident", label: "Clôturer", needsReport: true },
};

/** Écran 4 — détail d'un incident (§V.2), avec le cycle de vie §V.3. */
export function IncidentDetail({ id }: { id: string }) {
  const incident = useIncident(id);
  const [dialog, setDialog] = useState<Dialog>(null);

  if (incident.isPending) return <LoadingRows rows={8} />;
  if (incident.isError) return <ErrorState error={incident.error} onRetry={() => incident.refetch()} />;
  const inc = incident.data;
  const closed = inc.status === "closed";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/incidents" prefetch={false}>
            <ArrowLeft data-icon="inline-start" />
            Incidents
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-extrabold font-mono text-2xl tracking-tight">{inc.reference}</h1>
            <StatusBadge tone={incidentStatusMeta[inc.status].tone}>{incidentStatusMeta[inc.status].label}</StatusBadge>
            <StatusBadge tone={severityMeta[inc.priority].tone}>
              Priorité {severityMeta[inc.priority].label.toLowerCase()}
            </StatusBadge>
            {inc.escalationLevel > 0 ? (
              <StatusBadge tone="orange">Escaladé niveau {inc.escalationLevel}</StatusBadge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">
            {incidentEventLabels[inc.event]} · {incidentCategoryLabels[inc.eventCategory]} ·{" "}
            {incidentTypeLabels[inc.incidentType]} · {inc.organization.name}
            {inc.vehicle ? ` · ${inc.vehicle.registration}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {closed ? (
            <Button variant="outline" onClick={() => setDialog({ kind: "reopen" })}>
              <RotateCcw data-icon="inline-start" />
              Rouvrir
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setDialog({ kind: "assign" })}>
                <UserPlus data-icon="inline-start" />
                Assigner
              </Button>
              <Button variant="outline" onClick={() => setDialog({ kind: "priority" })}>
                Priorité
              </Button>
              <Button variant="outline" onClick={() => setDialog({ kind: "escalate" })}>
                <ArrowUpCircle data-icon="inline-start" />
                Escalader
              </Button>
              {inc.status === "on_hold" || inc.status === "new" || inc.status === "assigned" ? (
                <Button variant="outline" onClick={() => setDialog({ kind: "status", status: "in_progress" })}>
                  <Play data-icon="inline-start" />
                  {inc.status === "on_hold" ? "Reprendre" : "Démarrer"}
                </Button>
              ) : null}
              {inc.status === "in_progress" || inc.status === "assigned" ? (
                <Button variant="outline" onClick={() => setDialog({ kind: "status", status: "on_hold" })}>
                  <Pause data-icon="inline-start" />
                  En attente
                </Button>
              ) : null}
              {inc.status === "resolved" ? (
                <>
                  <Button variant="outline" onClick={() => setDialog({ kind: "reopen" })}>
                    <RotateCcw data-icon="inline-start" />
                    Rouvrir
                  </Button>
                  <Button onClick={() => setDialog({ kind: "status", status: "closed" })}>
                    <Lock data-icon="inline-start" />
                    Clôturer
                  </Button>
                </>
              ) : inc.status !== "new" ? (
                <Button onClick={() => setDialog({ kind: "status", status: "resolved" })}>
                  <CircleCheck data-icon="inline-start" />
                  Résoudre
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {closed ? (
        <Alert>
          <Lock />
          <AlertTitle>Incident clôturé le {formatDateTime(inc.closedAt)}</AlertTitle>
          <AlertDescription>
            Il n'est plus modifiable. Une réouverture (motif obligatoire) est tracée dans l'historique.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="general" className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="general">Informations</TabsTrigger>
            <TabsTrigger value="events">Événements</TabsTrigger>
            <TabsTrigger value="alerts">Alertes ({inc.alertIds.length})</TabsTrigger>
            <TabsTrigger value="actions">Actions ({inc.actions.length})</TabsTrigger>
            <TabsTrigger value="comments">Commentaires ({inc.comments.length})</TabsTrigger>
            <TabsTrigger value="files">Pièces jointes ({inc.attachments.length})</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general">
          <Card>
            <CardContent className="flex flex-col gap-5">
              <DetailList
                items={[
                  { label: "Client", value: inc.organization.name },
                  {
                    label: "Véhicule",
                    value: inc.vehicle ? (
                      <Link
                        className="font-mono hover:underline"
                        href={`/dashboard/vehicles/${inc.vehicle.id}`}
                        prefetch={false}
                      >
                        {inc.vehicle.registration}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  { label: "Conducteur", value: inc.driver?.name ?? "—" },
                  { label: "Catégorie d'événement", value: incidentCategoryLabels[inc.eventCategory] },
                  { label: "Événement", value: incidentEventLabels[inc.event] },
                  { label: "Type d'incident", value: incidentTypeLabels[inc.incidentType] },
                  { label: "Priorité", value: severityMeta[inc.priority].label },
                  { label: "Source", value: incidentSourceLabels[inc.source] },
                  { label: "Date de l'incident", value: formatDateTime(inc.occurredAt) },
                  { label: "Responsable", value: inc.assignee?.name ?? "—" },
                  { label: "File d'affectation", value: inc.queue ?? "—" },
                  { label: "Localisation", value: inc.location?.address ?? "—" },
                  { label: "Créé le", value: formatDateTime(inc.createdAt) },
                  { label: "Dernière mise à jour", value: formatDateTime(inc.updatedAt) },
                ]}
              />
              <div>
                <p className="mb-1 text-muted-foreground text-xs">Description</p>
                <p className="whitespace-pre-line text-sm">{inc.description}</p>
              </div>
              {inc.resolutionReport ? (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-1 font-medium text-sm">Compte rendu</p>
                  <p className="whitespace-pre-line text-sm">{inc.resolutionReport}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <LinkedAlerts incident={inc} mode="events" />
        </TabsContent>
        <TabsContent value="alerts">
          <LinkedAlerts incident={inc} mode="alerts" />
        </TabsContent>
        <TabsContent value="actions">
          <Entries
            incident={inc}
            kind="action"
            items={inc.actions.map((a) => ({ id: a.id, at: a.at, author: a.author, text: a.text }))}
          />
        </TabsContent>
        <TabsContent value="comments">
          <Entries
            incident={inc}
            kind="comment"
            items={inc.comments.map((c) => ({ id: c.id, at: c.at, author: c.author, text: c.text }))}
          />
        </TabsContent>
        <TabsContent value="files">
          <Attachments incident={inc} />
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardContent>
              <ol className="flex flex-col gap-3 border-l pl-4">
                {[...inc.history].reverse().map((h) => (
                  <li key={h.id} className="text-sm">
                    <p className="font-medium">{h.action}</p>
                    <p>{h.description}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(h.at)} · {h.actor}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <IncidentDialogs incident={inc} dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

/** Alertes rattachées (onglet Alertes) et leurs événements, à plat (onglet Événements). */
function LinkedAlerts({ incident, mode }: { incident: Incident; mode: "alerts" | "events" }) {
  const alerts = useAlerts({ organizationId: incident.organizationId, perPage: 100 });
  if (alerts.isPending) return <LoadingRows rows={3} />;
  const linked = (alerts.data?.data ?? []).filter((a) => incident.alertIds.includes(a.id));
  if (linked.length === 0) {
    return <EmptyState title={mode === "alerts" ? "Aucune alerte associée" : "Aucun événement associé"} />;
  }
  if (mode === "events") {
    const events = linked
      .flatMap((a) => a.history.map((h) => ({ ...h, ref: a.reference })))
      .sort((x, y) => y.at.localeCompare(x.at));
    return (
      <Card>
        <CardContent>
          <ol className="flex flex-col gap-3 border-l pl-4">
            {events.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="font-medium">
                  {e.action} <span className="font-mono text-muted-foreground text-xs">{e.ref}</span>
                </p>
                <p>{e.description}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(e.at)} · {e.actor}
                </p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="flex flex-col divide-y">
        {linked.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div>
              <p className="font-medium text-sm">{eventTypeLabels[a.eventType]}</p>
              <p className="text-muted-foreground text-xs">
                {a.reference} · {formatDateTime(a.occurredAt)} · {a.location?.address ?? "—"}
              </p>
            </div>
            <div className="flex gap-1.5">
              <StatusBadge tone={severityMeta[a.severity].tone}>{severityMeta[a.severity].label}</StatusBadge>
              <StatusBadge tone={alertStatusMeta[a.status].tone}>{alertStatusMeta[a.status].label}</StatusBadge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Entries({
  incident,
  kind,
  items,
}: {
  incident: Incident;
  kind: "action" | "comment";
  items: Array<{ id: string; at: string; author: string; text: string }>;
}) {
  const [text, setText] = useState("");
  const addAction = useAddIncidentAction();
  const addComment = useAddIncidentComment();
  const mutation = kind === "action" ? addAction : addComment;
  const closed = incident.status === "closed";
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {kind === "action" ? "Aucune action réalisée pour l'instant." : "Aucun commentaire."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((i) => (
              <li key={i.id} className="rounded-lg border p-3 text-sm">
                <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  {kind === "action" ? <Wrench className="size-3" /> : <MessageSquare className="size-3" />}
                  {i.author} · {formatDateTime(i.at)}
                </p>
                <p className="mt-1 whitespace-pre-line">{i.text}</p>
              </li>
            ))}
          </ul>
        )}
        {closed ? null : (
          <div className="flex flex-col gap-2">
            <Textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                kind === "action" ? "Ex. : technicien envoyé sur site, client rappelé…" : "Ajouter un commentaire…"
              }
              aria-label={kind === "action" ? "Nouvelle action" : "Nouveau commentaire"}
            />
            <Button
              size="sm"
              className="w-fit"
              disabled={!text.trim() || mutation.isPending}
              onClick={() =>
                mutation.mutate(
                  { id: incident.id, text },
                  {
                    onSuccess: () => {
                      setText("");
                      toast.success(kind === "action" ? "Action enregistrée" : "Commentaire ajouté");
                    },
                    onError: (e) => toast.error("Ajout impossible", { description: getErrorMessage(e) }),
                  },
                )
              }
            >
              {kind === "action" ? "Enregistrer l'action" : "Commenter"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Attachments({ incident }: { incident: Incident }) {
  const add = useAddIncidentAttachment();
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        {incident.attachments.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune pièce jointe.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {incident.attachments.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Paperclip className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground text-xs">{f.sizeKb} Ko</span>
              </li>
            ))}
          </ul>
        )}
        {incident.status === "closed" ? null : (
          <Input
            type="file"
            accept="image/*,.pdf"
            aria-label="Ajouter une pièce jointe"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              add.mutate(
                {
                  id: incident.id,
                  file: { name: f.name, sizeKb: Math.ceil(f.size / 1024), type: f.type || "fichier" },
                },
                {
                  onSuccess: () => toast.success("Pièce jointe ajoutée", { description: f.name }),
                  onError: (err) => toast.error("Ajout impossible", { description: getErrorMessage(err) }),
                },
              );
              e.target.value = "";
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function IncidentDialogs({ incident, dialog, onClose }: { incident: Incident; dialog: Dialog; onClose: () => void }) {
  const [text, setText] = useState("");
  const [owner, setOwner] = useState<{ assignee: PersonRef | null; queue: string | null }>({
    assignee: incident.assignee,
    queue: incident.queue,
  });
  const [priority, setPriority] = useState<Severity>(incident.priority);
  const assign = useAssignIncident();
  const setPrio = useSetIncidentPriority();
  const setStatus = useSetIncidentStatus();
  const reopen = useReopenIncident();
  const escalate = useEscalateIncident();
  if (!dialog) return null;

  const done = (msg: string) => ({
    onSuccess: () => {
      toast.success(msg, { description: incident.reference });
      setText("");
      onClose();
    },
    onError: (e: unknown) => toast.error("Action impossible", { description: getErrorMessage(e) }),
  });
  const close = (o: boolean) => {
    if (!o) {
      setText("");
      onClose();
    }
  };

  if (dialog.kind === "assign") {
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title="Assigner l'incident"
        description="Un responsable nominatif ou une file d'affectation est obligatoire."
        confirmLabel="Assigner"
        loading={assign.isPending}
        onConfirm={() => assign.mutate({ id: incident.id, ...owner }, done("Incident assigné"))}
      >
        <Field className="gap-1.5">
          <FieldLabel htmlFor="inc-assign">Responsable ou file</FieldLabel>
          <PersonSelect id="inc-assign" allowQueues value={owner} onChange={setOwner} />
        </Field>
      </ConfirmDialog>
    );
  }
  if (dialog.kind === "priority") {
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title="Changer la priorité"
        confirmLabel="Enregistrer"
        loading={setPrio.isPending}
        onConfirm={() => setPrio.mutate({ id: incident.id, priority }, done("Priorité modifiée"))}
      >
        <Select value={priority} onValueChange={(v) => setPriority(v as Severity)}>
          <SelectTrigger className="w-full" aria-label="Priorité">
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
      </ConfirmDialog>
    );
  }
  const textual = {
    escalate: {
      title: "Escalader l'incident",
      description: "L'incident passe au niveau supérieur (Sécurité / SOC, puis Direction des opérations).",
      label: "Escalader",
      placeholder: "Motif de l'escalade",
      run: () => escalate.mutate({ id: incident.id, reason: text }, done("Incident escaladé")),
      loading: escalate.isPending,
    },
    reopen: {
      title: "Rouvrir l'incident",
      description: "La réouverture est tracée ; le motif est obligatoire.",
      label: "Rouvrir",
      placeholder: "Motif de la réouverture",
      run: () => reopen.mutate({ id: incident.id, reason: text }, done("Incident rouvert")),
      loading: reopen.isPending,
    },
  };
  if (dialog.kind === "escalate" || dialog.kind === "reopen") {
    const t = textual[dialog.kind];
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title={t.title}
        description={t.description}
        confirmLabel={t.label}
        loading={t.loading}
        onConfirm={t.run}
      >
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
        />
      </ConfirmDialog>
    );
  }
  const copy = STATUS_COPY[dialog.status];
  if (!copy) return null;
  return (
    <ConfirmDialog
      open
      onOpenChange={close}
      title={copy.title}
      description={copy.needsReport ? "Un compte rendu est obligatoire (10 caractères minimum)." : undefined}
      confirmLabel={copy.label}
      loading={setStatus.isPending}
      onConfirm={() =>
        setStatus.mutate(
          { id: incident.id, status: dialog.status, note: text || undefined },
          done(`Incident : ${incidentStatusMeta[dialog.status].label.toLowerCase()}`),
        )
      }
    >
      <Textarea
        rows={copy.needsReport ? 4 : 2}
        value={text || (copy.needsReport ? (incident.resolutionReport ?? "") : "")}
        onChange={(e) => setText(e.target.value)}
        placeholder={copy.needsReport ? "Compte rendu : cause, intervention, résultat…" : "Note (optionnelle)"}
        aria-label="Compte rendu"
      />
    </ConfirmDialog>
  );
}
