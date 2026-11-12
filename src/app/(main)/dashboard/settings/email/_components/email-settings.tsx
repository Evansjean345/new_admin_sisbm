"use client";

import { useEffect, useState } from "react";

import { Save, Send } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useEmailSettings, useSaveEmailSettings, useTestEmail } from "@/hooks/api/use-settings";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime } from "@/lib/format";
import type { EmailPayload } from "@/types/settings";

import { ConnectionBadge, SecretField, SettingsHistoryCard } from "../../_components/settings-shared";

const PROVIDER_DEFAULTS: Record<EmailPayload["provider"], { label: string; host: string; port: number }> = {
  smtp: { label: "Serveur SMTP", host: "", port: 587 },
  sendgrid: { label: "SendGrid", host: "smtp.sendgrid.net", port: 587 },
  mailgun: { label: "Mailgun", host: "smtp.mailgun.org", port: 587 },
  ses: { label: "Amazon SES", host: "email-smtp.eu-west-1.amazonaws.com", port: 587 },
};

/** Écran 4 — Paramètres e-mail (§VII.2). */
export function EmailSettings() {
  const settings = useEmailSettings();
  const save = useSaveEmailSettings();
  const test = useTestEmail();
  const [form, setForm] = useState<EmailPayload | null>(null);
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    const { hasSecret: _h, status: _s, lastTestAt: _l, lastError: _e, ...rest } = settings.data;
    setForm({ ...rest, secret: "" });
  }, [settings.data]);

  if (settings.isPending || !form) return <LoadingRows rows={6} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  const s = settings.data;
  const set = <K extends keyof EmailPayload>(k: K, v: EmailPayload[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Paramètres e-mail"
        description="Serveur d'envoi des factures, relances, alertes et réinitialisations de mot de passe."
        actions={
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(form, {
                onSuccess: () =>
                  toast.success("Paramètres e-mail enregistrés", { description: "Envoyez un e-mail de test." }),
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
              <CardTitle>Statut de connexion</CardTitle>
              <CardDescription>Dernier test : {formatDateTime(s.lastTestAt, "jamais")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ConnectionBadge status={s.status} />
                {s.lastError ? <span className="text-destructive text-xs">{s.lastError}</span> : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="Adresse de réception du test"
                  aria-label="Adresse de réception du test"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={test.isPending || !testTo.includes("@")}
                  onClick={() =>
                    test.mutate(testTo, {
                      onSuccess: (r) =>
                        r.status === "connected"
                          ? toast.success("E-mail de test envoyé", { description: testTo })
                          : toast.error("Test en échec", { description: r.lastError ?? undefined }),
                    })
                  }
                >
                  {test.isPending ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                  Envoyer un test
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="mail-provider">Serveur SMTP ou fournisseur</FieldLabel>
                  <Select
                    value={form.provider}
                    onValueChange={(v) => {
                      const p = v as EmailPayload["provider"];
                      const d = PROVIDER_DEFAULTS[p];
                      setForm((f) => (f ? { ...f, provider: p, host: d.host || f.host, port: d.port } : f));
                    }}
                  >
                    <SelectTrigger id="mail-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {Object.entries(PROVIDER_DEFAULTS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="mail-host">Hôte</FieldLabel>
                  <Input
                    id="mail-host"
                    value={form.host}
                    onChange={(e) => set("host", e.target.value)}
                    placeholder="smtp.exemple.ci"
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="mail-port">Port</FieldLabel>
                  <Input
                    id="mail-port"
                    type="number"
                    value={form.port}
                    onChange={(e) => set("port", Number(e.target.value) || 0)}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="mail-enc">Chiffrement</FieldLabel>
                  <Select
                    value={form.encryption}
                    onValueChange={(v) => set("encryption", v as EmailPayload["encryption"])}
                  >
                    <SelectTrigger id="mail-enc" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="tls">STARTTLS (587)</SelectItem>
                        <SelectItem value="ssl">SSL/TLS (465)</SelectItem>
                        <SelectItem value="none">Aucun (déconseillé)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="mail-user">Identifiant</FieldLabel>
                  <Input
                    id="mail-user"
                    autoComplete="off"
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                  />
                </Field>
                <SecretField
                  id="mail-secret"
                  label="Clé secrète / mot de passe"
                  hasSecret={s.hasSecret}
                  value={form.secret ?? ""}
                  onChange={(v) => set("secret", v)}
                />
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="mail-from">Adresse d'expédition</FieldLabel>
                  <Input
                    id="mail-from"
                    type="email"
                    value={form.fromAddress}
                    onChange={(e) => set("fromAddress", e.target.value)}
                    placeholder="no-reply@sisbm.ci"
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="mail-from-name">Nom d'expéditeur</FieldLabel>
                  <Input id="mail-from-name" value={form.fromName} onChange={(e) => set("fromName", e.target.value)} />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
        <SettingsHistoryCard section="Paramètres e-mail" />
      </div>
    </div>
  );
}
