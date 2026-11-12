"use client";

import { useEffect, useState } from "react";

import { ImageUp, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useGeneralSettings, useSaveGeneralSettings } from "@/hooks/api/use-settings";
import { getErrorMessage } from "@/lib/axios";
import type { GeneralSettings as Settings } from "@/types/settings";

import { SettingsHistoryCard } from "../../_components/settings-shared";

const TIMEZONES = ["Africa/Abidjan", "Africa/Dakar", "Africa/Lagos", "Africa/Douala", "Europe/Paris", "UTC"];
const CURRENCIES = [
  ["XOF", "Franc CFA (XOF)"],
  ["XAF", "Franc CFA CEMAC (XAF)"],
  ["EUR", "Euro (EUR)"],
  ["USD", "Dollar américain (USD)"],
];

/** Écran 1 — Paramètres généraux (§VII.2). */
export function GeneralSettings() {
  const settings = useGeneralSettings();
  const save = useSaveGeneralSettings();
  const [form, setForm] = useState<Settings | null>(null);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  if (settings.isPending || !form) return <LoadingRows rows={8} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setContact = (k: keyof Settings["contact"], v: string) =>
    setForm((f) => (f ? { ...f, contact: { ...f.contact, [k]: v } } : f));
  const sample = new Date(2026, 10, 12, 14, 32);
  const datePreview = { "dd/MM/yyyy": "12/11/2026", "yyyy-MM-dd": "2026-11-12", "d MMM yyyy": "12 nov. 2026" }[
    form.dateFormat
  ];

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("Logo trop lourd", { description: "500 Ko maximum." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Paramètres généraux"
        description="Identité de la plateforme, formats d'affichage et coordonnées de SISBM."
        actions={
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(form, {
                onSuccess: () => toast.success("Paramètres enregistrés"),
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
              <CardTitle>Plateforme</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gs-name">Nom de la plateforme</FieldLabel>
                  <Input id="gs-name" value={form.platformName} onChange={(e) => set("platformName", e.target.value)} />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gs-logo">Logo</FieldLabel>
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      {form.logo ? (
                        // biome-ignore lint/performance/noImgElement: aperçu d'une data URL locale
                        <img src={form.logo} alt="Logo actuel" className="size-full object-contain" />
                      ) : (
                        <ImageUp className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <Input
                      id="gs-logo"
                      type="file"
                      accept="image/png,image/svg+xml,image/jpeg"
                      onChange={(e) => onLogo(e.target.files?.[0])}
                    />
                    {form.logo ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Retirer le logo"
                        onClick={() => set("logo", null)}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gs-lang">Langue</FieldLabel>
                  <Select value={form.language} onValueChange={(v) => set("language", v as Settings["language"])}>
                    <SelectTrigger id="gs-lang" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="en">Anglais</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gs-tz">Fuseau horaire</FieldLabel>
                  <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
                    <SelectTrigger id="gs-tz" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {TIMEZONES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gs-date">Format des dates</FieldLabel>
                  <Select value={form.dateFormat} onValueChange={(v) => set("dateFormat", v as Settings["dateFormat"])}>
                    <SelectTrigger id="gs-date" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="dd/MM/yyyy">JJ/MM/AAAA</SelectItem>
                        <SelectItem value="yyyy-MM-dd">AAAA-MM-JJ</SelectItem>
                        <SelectItem value="d MMM yyyy">J mois AAAA</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>Exemple : {datePreview}</FieldDescription>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gs-number">Format des nombres</FieldLabel>
                  <Select
                    value={form.numberFormat}
                    onValueChange={(v) => set("numberFormat", v as Settings["numberFormat"])}
                  >
                    <SelectTrigger id="gs-number" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="fr-FR">1 234 567,89</SelectItem>
                        <SelectItem value="en-US">1,234,567.89</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Exemple :{" "}
                    {new Intl.NumberFormat(form.numberFormat, { minimumFractionDigits: 2 }).format(1234567.89)}
                  </FieldDescription>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gs-currency">Devise</FieldLabel>
                  <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger id="gs-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {CURRENCIES.map(([c, l]) => (
                          <SelectItem key={c} value={c}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Aperçu : {sample.toLocaleDateString(form.numberFormat)} ·{" "}
                    {new Intl.NumberFormat(form.numberFormat, {
                      style: "currency",
                      currency: form.currency,
                      maximumFractionDigits: 0,
                    }).format(15000)}
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coordonnées SISBM</CardTitle>
              <CardDescription>Reprises sur les factures, les e-mails et les rapports.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["companyName", "Raison sociale"],
                    ["registrationNumber", "RCCM / identifiant fiscal"],
                    ["address", "Adresse"],
                    ["phone", "Téléphone"],
                    ["email", "E-mail"],
                    ["website", "Site web"],
                  ] as const
                ).map(([k, l]) => (
                  <Field key={k} className="gap-1.5">
                    <FieldLabel htmlFor={`gs-${k}`}>{l}</FieldLabel>
                    <Input id={`gs-${k}`} value={form.contact[k]} onChange={(e) => setContact(k, e.target.value)} />
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
        <SettingsHistoryCard section="Paramètres généraux" />
      </div>
    </div>
  );
}
