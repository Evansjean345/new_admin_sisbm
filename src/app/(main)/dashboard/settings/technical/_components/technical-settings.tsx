"use client";

import { useEffect, useState } from "react";

import { DatabaseBackup, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  useRunBackup,
  useSaveTechnicalSettings,
  useServiceHealth,
  useTechnicalSettings,
} from "@/hooks/api/use-settings";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime } from "@/lib/format";
import type { TechnicalSettings as Settings } from "@/types/settings";

import { SettingsHistoryCard } from "../../_components/settings-shared";

const HEALTH = {
  up: { label: "Opérationnel", tone: "success" },
  degraded: { label: "À vérifier", tone: "warning" },
  down: { label: "Indisponible", tone: "danger" },
} as const;

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
  min = 0,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  min?: number;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="number" min={min} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

/** Écran 6 — Paramètres techniques (§VII.2). */
export function TechnicalSettings() {
  const settings = useTechnicalSettings();
  const save = useSaveTechnicalSettings();
  const backup = useRunBackup();
  const health = useServiceHealth();
  const [form, setForm] = useState<Settings | null>(null);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  if (settings.isPending || !form) return <LoadingRows rows={8} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setBackup = (patch: Partial<Settings["backup"]>) =>
    setForm((f) => (f ? { ...f, backup: { ...f.backup, ...patch } } : f));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Paramètres techniques"
        description="Journalisation, conservation des données, synchronisation, surveillance et sauvegardes."
        actions={
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(form, {
                onSuccess: () => toast.success("Paramètres techniques enregistrés"),
                onError: (e) => toast.error("Enregistrement impossible", { description: getErrorMessage(e) }),
              })
            }
          >
            {save.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            Enregistrer
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Surveillance des services</CardTitle>
              <CardDescription>
                API et Flespi interrogés en direct ; actualisation automatique toutes les minutes.
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" disabled={health.isFetching} onClick={() => health.refetch()}>
                  <RefreshCw data-icon="inline-start" className={health.isFetching ? "animate-spin" : undefined} />
                  Vérifier
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {health.isPending ? (
                <LoadingRows rows={4} className="flex flex-col gap-2" />
              ) : (
                <ul className="flex flex-col divide-y">
                  {(health.data ?? []).map((h) => (
                    <li key={h.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <p className="font-medium text-sm">{h.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {h.detail ?? `Vérifié ${formatDateTime(h.checkedAt)}`}
                          {h.latencyMs !== null ? ` · ${h.latencyMs} ms` : ""}
                        </p>
                      </div>
                      <StatusBadge tone={HEALTH[h.status].tone}>{HEALTH[h.status].label}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Journalisation et conservation</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="tech-log">Niveau de journalisation</FieldLabel>
                  <Select value={form.logLevel} onValueChange={(v) => set("logLevel", v as Settings["logLevel"])}>
                    <SelectTrigger id="tech-log" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="error">Erreurs uniquement</SelectItem>
                        <SelectItem value="warn">Avertissements et erreurs</SelectItem>
                        <SelectItem value="info">Informations (recommandé)</SelectItem>
                        <SelectItem value="debug">Débogage (temporaire)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <NumberField
                  id="tech-audit"
                  label="Conservation du journal d'audit (jours)"
                  min={365}
                  value={form.auditRetentionDays}
                  onChange={(n) => set("auditRetentionDays", n)}
                  hint="365 jours minimum (traçabilité)."
                />
                <NumberField
                  id="tech-gps"
                  label="Conservation des positions GPS (jours)"
                  value={form.gpsRetentionDays}
                  onChange={(n) => set("gpsRetentionDays", n)}
                  hint="Valeur par défaut ; chaque offre peut la fixer (décision SISBM §15)."
                />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Synchronisation</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  id="tech-sync"
                  label="Synchronisation Flespi (secondes)"
                  min={5}
                  value={form.syncIntervalSeconds}
                  onChange={(n) => set("syncIntervalSeconds", n)}
                />
                <NumberField
                  id="tech-offline"
                  label="Véhicule « hors ligne » après (minutes)"
                  value={form.offlineAfterMinutes}
                  onChange={(n) => set("offlineAfterMinutes", n)}
                />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sauvegardes</CardTitle>
              <CardDescription>
                Dernière sauvegarde : {formatDateTime(form.backup.lastBackupAt, "aucune")}
              </CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={backup.isPending}
                  onClick={() =>
                    backup.mutate(undefined, {
                      onSuccess: () => toast.success("Sauvegarde effectuée"),
                      onError: (e) => toast.error("Sauvegarde impossible", { description: getErrorMessage(e) }),
                    })
                  }
                >
                  {backup.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <DatabaseBackup data-icon="inline-start" />
                  )}
                  Sauvegarder maintenant
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-3">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="tech-bk-freq">Fréquence</FieldLabel>
                  <Select
                    value={form.backup.frequency}
                    onValueChange={(v) => setBackup({ frequency: v as Settings["backup"]["frequency"] })}
                  >
                    <SelectTrigger id="tech-bk-freq" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="hourly">Toutes les heures</SelectItem>
                        <SelectItem value="daily">Quotidienne</SelectItem>
                        <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="tech-bk-time">Heure</FieldLabel>
                  <Input
                    id="tech-bk-time"
                    type="time"
                    value={form.backup.time}
                    onChange={(e) => setBackup({ time: e.target.value })}
                  />
                </Field>
                <NumberField
                  id="tech-bk-ret"
                  label="Conservation (jours)"
                  value={form.backup.retentionDays}
                  onChange={(n) => setBackup({ retentionDays: n })}
                />
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
        <SettingsHistoryCard section="Paramètres techniques" />
      </div>
    </div>
  );
}
