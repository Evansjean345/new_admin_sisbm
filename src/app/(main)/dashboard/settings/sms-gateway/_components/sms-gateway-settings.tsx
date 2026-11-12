"use client";

import { useEffect, useState } from "react";

import { PlugZap, Save } from "lucide-react";
import { toast } from "sonner";

import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useSaveSmsGateway, useSmsGatewaySettings, useTestSmsGateway } from "@/hooks/api/use-settings";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime } from "@/lib/format";
import type { SmsGatewayPayload } from "@/types/settings";

import { ConnectionBadge, SecretField, SettingsHistoryCard } from "../../_components/settings-shared";

const PROVIDERS = ["Orange CI", "MTN CI", "Moov Africa", "Twilio", "Infobip", "Autre"];

/** Écran 3 — Passerelle SMS (§VII.2). */
export function SmsGatewaySettings() {
  const settings = useSmsGatewaySettings();
  const save = useSaveSmsGateway();
  const test = useTestSmsGateway();
  const [form, setForm] = useState<SmsGatewayPayload | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    const { hasSecret: _h, status: _s, lastTestAt: _l, lastError: _e, balance: _b, ...rest } = settings.data;
    setForm({ ...rest, secret: "" });
  }, [settings.data]);

  if (settings.isPending || !form) return <LoadingRows rows={6} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  const s = settings.data;
  const set = <K extends keyof SmsGatewayPayload>(k: K, v: SmsGatewayPayload[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Passerelle SMS"
        description="Fournisseur utilisé pour les alertes, relances et notifications par SMS."
        actions={
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(form, {
                onSuccess: () =>
                  toast.success("Passerelle enregistrée", { description: "Relancez le test de connexion." }),
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
              <CardTitle>Statut</CardTitle>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={test.isPending}
                  onClick={() =>
                    test.mutate(undefined, {
                      onSuccess: (r) =>
                        r.status === "connected"
                          ? toast.success("Connexion réussie")
                          : toast.error("Connexion en échec", { description: r.lastError ?? undefined }),
                    })
                  }
                >
                  {test.isPending ? <Spinner data-icon="inline-start" /> : <PlugZap data-icon="inline-start" />}
                  Tester la connexion
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Statut</span>
                <ConnectionBadge status={s.status} />
                {s.lastError ? <span className="text-destructive text-xs">{s.lastError}</span> : null}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Solde / crédits</span>
                <span className="font-medium tabular-nums">
                  {s.balance === null ? "—" : `${s.balance.toLocaleString("fr-FR")} SMS`}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Dernier test</span>
                <span className="text-sm">{formatDateTime(s.lastTestAt, "Jamais")}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Toute modification repasse la passerelle en « non testée ».</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sms-provider">Fournisseur</FieldLabel>
                  <Select value={form.provider} onValueChange={(v) => set("provider", v)}>
                    <SelectTrigger id="sms-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sms-url">URL de service</FieldLabel>
                  <Input id="sms-url" value={form.serviceUrl} onChange={(e) => set("serviceUrl", e.target.value)} />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sms-user">Identifiant</FieldLabel>
                  <Input
                    id="sms-user"
                    autoComplete="off"
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                  />
                </Field>
                <SecretField
                  id="sms-secret"
                  label="Clé d'API / mot de passe"
                  hasSecret={s.hasSecret}
                  value={form.secret ?? ""}
                  onChange={(v) => set("secret", v)}
                />
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sms-sender">Expéditeur</FieldLabel>
                  <Input
                    id="sms-sender"
                    maxLength={11}
                    value={form.sender}
                    onChange={(e) => set("sender", e.target.value)}
                  />
                  <FieldDescription>11 caractères maximum, affiché sur le téléphone du destinataire.</FieldDescription>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sms-cost">Coût unitaire (XOF)</FieldLabel>
                  <Input
                    id="sms-cost"
                    type="number"
                    min={0}
                    value={form.unitCost}
                    onChange={(e) => set("unitCost", Math.max(0, Number(e.target.value) || 0))}
                  />
                  <FieldDescription>
                    Sert au calcul des coûts dans Gestion des SMS ({formatMoney(form.unitCost)} / SMS).
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Alert>
            <AlertTitle>Quotas SMS et facturation</AlertTitle>
            <AlertDescription>
              Les quotas par offre et leur refacturation restent une décision SISBM à valider (§15). Les limites par
              offre se règlent dans le Catalogue des offres (SMS / mois).
            </AlertDescription>
          </Alert>
        </div>
        <SettingsHistoryCard section="Passerelle SMS" />
      </div>
    </div>
  );
}
