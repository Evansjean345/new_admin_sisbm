"use client";

import { useEffect, useState } from "react";

import { ArrowRight, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

import {
  OrganizationFilter,
  OrganizationSelect,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { eventTypeLabels, severityMeta } from "@/components/alerting-labels";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRules, useSaveRule, useToggleClientRule } from "@/hooks/api/use-client-rules";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime, formatRelative } from "@/lib/format";
import { mockId } from "@/lib/mock";
import { EVENT_TYPES, type EventType, SEVERITIES, type Severity } from "@/types/alerting";
import {
  RULE_ACTION_TYPES,
  RULE_FIELDS,
  RULE_OPERATORS,
  type Rule,
  type RuleActionType,
  type RuleField,
  type RuleOperator,
  type RulePayload,
} from "@/types/client-rules";

const FIELD_LABELS: Record<RuleField, { label: string; placeholder: string }> = {
  speed: { label: "Vitesse (km/h)", placeholder: "110" },
  zone: { label: "Zone", placeholder: "Dépôt principal" },
  time: { label: "Heure", placeholder: "22:00-05:00" },
  duration: { label: "Durée (s)", placeholder: "60" },
  ignition: { label: "Contact moteur", placeholder: "allumé" },
  vehicle: { label: "Véhicule", placeholder: "AB-1234-CI" },
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  gt: "supérieur à",
  lt: "inférieur à",
  eq: "égal à",
  neq: "différent de",
  in: "dans la plage",
  outside: "hors de la plage",
};

const ACTION_LABELS: Record<RuleActionType, { label: string; placeholder: string }> = {
  alert: { label: "Créer une alerte", placeholder: "Gravité" },
  notify: { label: "Envoyer une notification", placeholder: "SMS au gestionnaire de flotte" },
  incident: { label: "Ouvrir un incident", placeholder: "File : Sécurité / SOC" },
  command: { label: "Envoyer une commande boîtier", placeholder: "Coupure moteur (avec confirmation)" },
};

/** Phrase lisible d'une règle : « Quand Excès de vitesse et Vitesse supérieur à 110 → … ». */
function ruleSentence(r: Pick<Rule, "trigger" | "conditions" | "actions">): string {
  const conds = r.conditions.map((c) => `${FIELD_LABELS[c.field].label.toLowerCase()} ${OPERATOR_LABELS[c.operator]} ${c.value}`);
  const acts = r.actions.map((a) => ACTION_LABELS[a.type].label.toLowerCase());
  return `Quand « ${eventTypeLabels[r.trigger]} »${conds.length ? ` et ${conds.join(" et ")}` : ""}, alors ${acts.join(", ") || "rien"}.`;
}

/**
 * Moteur de règles (rubrique client) : générique et transversal (§16) — déclencheur, conditions
 * (ET logique) et actions. Même écran pour la plateforme Client et la fiche client.
 */
export function RulesEngine({ organizationId: scoped }: { organizationId?: string } = {}) {
  const [filterOrg, setFilterOrg] = useState<string | undefined>();
  const organizationId = scoped ?? filterOrg;
  const rules = useRules(organizationId);
  const toggle = useToggleClientRule();
  const [editing, setEditing] = useState<{ open: boolean; rule: Rule | null }>({ open: false, rule: null });
  const rows = rules.data ?? [];

  const newButton = (
    <Button onClick={() => setEditing({ open: true, rule: null })}>
      <Plus data-icon="inline-start" />
      Nouvelle règle
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      {scoped ? (
        <div className="flex justify-end">{newButton}</div>
      ) : (
        <PageHeader
          title="Moteur de règles"
          description="Automatisations : quand un événement survient et que les conditions sont réunies, le système agit."
          actions={
            <>
              <OrganizationFilter value={filterOrg} onChange={setFilterOrg} />
              {newButton}
            </>
          }
        />
      )}
      {scoped ? null : (
        <Alert>
          <Workflow />
          <AlertTitle>Données de démonstration</AlertTitle>
          <AlertDescription>Règles simulées ; leur évaluation sur les événements GPS sera faite côté serveur.</AlertDescription>
        </Alert>
      )}

      {rules.isPending ? (
        <LoadingRows rows={4} />
      ) : rules.isError ? (
        <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Workflow />} title="Aucune règle" description="Créez la première automatisation." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className={r.active ? undefined : "opacity-70"}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {r.name}
                  <StatusBadge tone={severityMeta[r.severity].tone}>{severityMeta[r.severity].label}</StatusBadge>
                </CardTitle>
                <CardDescription>{r.description ?? (scoped ? "" : r.organization.name)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="rounded-md bg-muted/50 p-2.5 text-sm">{ruleSentence(r)}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="outline">{eventTypeLabels[r.trigger]}</Badge>
                  {r.conditions.map((c) => (
                    <Badge key={c.id} variant="secondary">
                      {FIELD_LABELS[c.field].label} {OPERATOR_LABELS[c.operator]} {c.value}
                    </Badge>
                  ))}
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  {r.actions.map((a) => (
                    <Badge key={a.id}>{ACTION_LABELS[a.type].label}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-muted-foreground text-xs">
                    Déclenchée {r.triggerCount} fois
                    {r.lastTriggeredAt ? ` · dernière ${formatRelative(r.lastTriggeredAt)}` : " · jamais"}
                    {scoped ? "" : ` · ${r.organization.name}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={r.active}
                      aria-label={r.active ? "Désactiver la règle" : "Activer la règle"}
                      onCheckedChange={(active) =>
                        toggle.mutate(
                          { kind: "rule", id: r.id, active },
                          { onSuccess: () => toast.success(active ? "Règle activée" : "Règle désactivée") },
                        )
                      }
                    />
                    <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${r.name}`} onClick={() => setEditing({ open: true, rule: r })}>
                      <Pencil />
                    </Button>
                  </div>
                </div>
                <span className="sr-only">Modifiée le {formatDateTime(r.updatedAt)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RuleDialog
        open={editing.open}
        rule={editing.rule}
        organizationId={organizationId}
        lockOrganization={Boolean(scoped)}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
      />
    </div>
  );
}

function RuleDialog({
  open,
  rule,
  organizationId,
  lockOrganization,
  onOpenChange,
}: {
  open: boolean;
  rule: Rule | null;
  organizationId?: string;
  lockOrganization: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<RulePayload | null>(null);
  const save = useSaveRule();

  useEffect(() => {
    if (!open) return;
    if (rule) {
      const { id: _i, organization: _o, updatedAt: _u, triggerCount: _t, lastTriggeredAt: _l, ...rest } = rule;
      setForm(rest);
    } else {
      setForm({
        organizationId: organizationId ?? "",
        name: "",
        description: null,
        trigger: "overspeed",
        conditions: [],
        actions: [{ id: mockId(), type: "alert", value: "medium" }],
        severity: "medium",
        active: true,
      });
    }
  }, [open, rule, organizationId]);

  if (!form) return null;
  const set = <K extends keyof RulePayload>(k: K, v: RulePayload[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Modifier la règle" : "Nouvelle règle"}</DialogTitle>
          <DialogDescription>{ruleSentence(form)}</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {lockOrganization ? null : (
              <Field className="gap-1.5 sm:col-span-2">
                <FieldLabel htmlFor="rule-org">Client</FieldLabel>
                <OrganizationSelect id="rule-org" className="w-full" value={form.organizationId || undefined} onChange={(id) => set("organizationId", id ?? "")} />
              </Field>
            )}
            <Field className="gap-1.5">
              <FieldLabel htmlFor="rule-name">Nom</FieldLabel>
              <Input id="rule-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="rule-sev">Gravité</FieldLabel>
              <Select value={form.severity} onValueChange={(v) => set("severity", v as Severity)}>
                <SelectTrigger id="rule-sev" className="w-full">
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
            <Field className="gap-1.5 sm:col-span-2">
              <FieldLabel htmlFor="rule-desc">Description</FieldLabel>
              <Textarea id="rule-desc" rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
            </Field>
          </div>

          <FieldSet>
            <FieldLegend variant="label">1. Quand cet événement survient</FieldLegend>
            <Select value={form.trigger} onValueChange={(v) => set("trigger", v as EventType)}>
              <SelectTrigger className="w-full" aria-label="Événement déclencheur">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                <SelectGroup>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {eventTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">2. Et que toutes ces conditions sont vraies</FieldLegend>
            {form.conditions.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Select
                  value={c.field}
                  onValueChange={(v) => set("conditions", form.conditions.map((x, j) => (j === i ? { ...x, field: v as RuleField } : x)))}
                >
                  <SelectTrigger className="w-full" aria-label="Critère">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {RULE_FIELDS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FIELD_LABELS[f].label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  value={c.operator}
                  onValueChange={(v) => set("conditions", form.conditions.map((x, j) => (j === i ? { ...x, operator: v as RuleOperator } : x)))}
                >
                  <SelectTrigger className="w-full" aria-label="Opérateur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {RULE_OPERATORS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {OPERATOR_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Valeur"
                  value={c.value}
                  placeholder={FIELD_LABELS[c.field].placeholder}
                  onChange={(e) => set("conditions", form.conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <Button variant="ghost" size="icon" aria-label="Retirer la condition" onClick={() => set("conditions", form.conditions.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => set("conditions", [...form.conditions, { id: mockId(), field: "speed", operator: "gt", value: "" }])}
            >
              <Plus data-icon="inline-start" />
              Ajouter une condition
            </Button>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">3. Alors exécuter ces actions</FieldLegend>
            {form.actions.map((a, i) => (
              <div key={a.id} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                <Select
                  value={a.type}
                  onValueChange={(v) => set("actions", form.actions.map((x, j) => (j === i ? { ...x, type: v as RuleActionType } : x)))}
                >
                  <SelectTrigger className="w-full" aria-label="Action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {RULE_ACTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ACTION_LABELS[t].label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Paramètre de l'action"
                  value={a.value}
                  placeholder={ACTION_LABELS[a.type].placeholder}
                  onChange={(e) => set("actions", form.actions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <Button variant="ghost" size="icon" aria-label="Retirer l'action" onClick={() => set("actions", form.actions.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-fit" onClick={() => set("actions", [...form.actions, { id: mockId(), type: "notify", value: "" }])}>
              <Plus data-icon="inline-start" />
              Ajouter une action
            </Button>
            {form.actions.some((a) => a.type === "command") ? (
              <p className="text-amber-600 text-xs dark:text-amber-400">
                Une commande boîtier passe par les contrôles des commandes sensibles : identité, droits, souscription,
                compatibilité matérielle, confirmation et traçabilité.
              </p>
            ) : null}
          </FieldSet>

          <Field orientation="horizontal">
            <Switch id="rule-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
            <FieldLabel htmlFor="rule-active" className="font-normal">
              Règle active
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
                { payload: form, id: rule?.id },
                {
                  onSuccess: () => {
                    toast.success("Règle enregistrée", { description: form.name });
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
