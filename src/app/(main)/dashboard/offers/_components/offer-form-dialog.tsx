"use client";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { groupFeaturesByModule } from "@/app/(main)/dashboard/_components/offers/offer-utils";
import { offerPeriodicityLabels, offerStatusMeta } from "@/components/status-labels";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCreateOffer, useOfferFeatures, useUpdateOffer } from "@/hooks/api/use-offers";
import { getErrorMessage } from "@/lib/axios";
import {
  type CreateOfferPayload,
  OFFER_PERIODICITIES,
  OFFER_STATUSES,
  type Offer,
  type OfferPeriodicity,
  type OfferStatus,
} from "@/types/offer";

/** Entier positif optionnel saisi en texte ; vide = illimité. */
const optionalCount = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), { message: `${label} : nombre entier attendu.` });

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, { message: "2 caractères minimum." })
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, { message: "Lettres, chiffres, - et _ uniquement." }),
  name: z.string().trim().min(2, { message: "2 caractères minimum." }).max(60),
  description: z.string().trim().max(300),
  referencePrice: z.string().trim().regex(/^\d+$/, { message: "Montant entier en FCFA." }),
  periodicity: z.enum(OFFER_PERIODICITIES),
  status: z.enum(OFFER_STATUSES),
  launchDate: z.string(),
  featureKeys: z.array(z.string()),
  options: z.string().trim().max(500),
  maxVehicles: optionalCount("Véhicules"),
  historyDays: optionalCount("Historique"),
  smsPerMonth: optionalCount("SMS"),
});

type Values = z.infer<typeof schema>;

function toDefaults(offer?: Offer): Values {
  const count = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    code: offer?.code ?? "",
    name: offer?.name ?? "",
    description: offer?.description ?? "",
    referencePrice: offer ? String(offer.referencePrice) : "",
    periodicity: offer?.periodicity ?? "monthly",
    status: offer?.status ?? "draft",
    launchDate: offer?.launchDate ?? "",
    featureKeys: offer?.featureKeys ?? [],
    options: offer?.options ?? "",
    maxVehicles: count(offer?.limitations.maxVehicles),
    historyDays: count(offer?.limitations.historyDays),
    smsPerMonth: count(offer?.limitations.smsPerMonth),
  };
}

function toPayload(values: Values): CreateOfferPayload {
  const opt = (v: string) => (v === "" ? undefined : v);
  const count = (v: string) => (v === "" ? null : Number(v));
  return {
    code: values.code.toUpperCase(),
    name: values.name,
    description: opt(values.description),
    referencePrice: Number(values.referencePrice),
    periodicity: values.periodicity,
    status: values.status,
    launchDate: opt(values.launchDate),
    featureKeys: values.featureKeys,
    options: opt(values.options),
    limitations: {
      maxVehicles: count(values.maxVehicles),
      historyDays: count(values.historyDays),
      smsPerMonth: count(values.smsPerMonth),
    },
  };
}

const LIMIT_FIELDS = [
  { name: "maxVehicles", label: "Véhicules max." },
  { name: "historyDays", label: "Historique GPS (jours)" },
  { name: "smsPerMonth", label: "SMS / mois" },
] as const;

export function OfferFormDialog({
  open,
  onOpenChange,
  offer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = création. */
  offer?: Offer;
}) {
  const create = useCreateOffer();
  const update = useUpdateOffer();
  const features = useOfferFeatures();
  const pending = create.isPending || update.isPending;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toDefaults(offer) });

  useEffect(() => {
    if (open) form.reset(toDefaults(offer));
  }, [open, offer, form]);

  function onSubmit(values: Values) {
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => {
        toast.success(offer ? "Offre mise à jour" : "Offre créée", { description: values.name });
        onOpenChange(false);
      },
      onError: (error: unknown) =>
        toast.error(offer ? "Mise à jour impossible" : "Création impossible", {
          description: getErrorMessage(error),
        }),
    };
    if (offer) {
      const { code: _code, ...rest } = payload;
      update.mutate({ id: offer.id, payload: rest }, handlers);
    } else {
      create.mutate(payload, handlers);
    }
  }

  const modules = groupFeaturesByModule(features.data ?? []);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{offer ? `Modifier l'offre ${offer.name}` : "Nouvelle offre"}</DialogTitle>
          <DialogDescription>
            Les fonctionnalités cochées définissent les droits commerciaux. La capacité réelle dépend aussi du matériel
            installé.
          </DialogDescription>
        </DialogHeader>

        <form id="offer-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                control={form.control}
                name="code"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="offer-code">Code</FieldLabel>
                    <Input
                      {...field}
                      id="offer-code"
                      placeholder="GOLD"
                      className="uppercase"
                      disabled={Boolean(offer)}
                      aria-invalid={fieldState.invalid}
                    />
                    {offer ? <FieldDescription>Non modifiable.</FieldDescription> : null}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5 sm:col-span-2" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="offer-name">Nom</FieldLabel>
                    <Input {...field} id="offer-name" placeholder="Gold" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>

            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="offer-description">Description</FieldLabel>
                  <Textarea {...field} id="offer-description" rows={2} />
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Controller
                control={form.control}
                name="referencePrice"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="offer-price">Tarif de référence (FCFA)</FieldLabel>
                    <Input
                      {...field}
                      id="offer-price"
                      inputMode="numeric"
                      placeholder="15000"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>Par véhicule et par période.</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="periodicity"
                render={({ field }) => (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="offer-periodicity">Périodicité</FieldLabel>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as OfferPeriodicity)}>
                      <SelectTrigger id="offer-periodicity" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          {OFFER_PERIODICITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {offerPeriodicityLabels[p]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="offer-status">Statut</FieldLabel>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as OfferStatus)}>
                      <SelectTrigger id="offer-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          {OFFER_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {offerStatusMeta[s].label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="launchDate"
                render={({ field }) => (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="offer-launch">Commercialisation</FieldLabel>
                    <Input {...field} id="offer-launch" type="date" />
                  </Field>
                )}
              />
            </div>

            <FieldSet>
              <FieldLegend variant="label">Limitations</FieldLegend>
              <FieldDescription>Laisser vide pour « illimité ».</FieldDescription>
              <div className="grid gap-4 sm:grid-cols-3">
                {LIMIT_FIELDS.map((f) => (
                  <Controller
                    key={f.name}
                    control={form.control}
                    name={f.name}
                    render={({ field, fieldState }) => (
                      <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`offer-${f.name}`}>{f.label}</FieldLabel>
                        <Input
                          {...field}
                          id={`offer-${f.name}`}
                          inputMode="numeric"
                          placeholder="Illimité"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                ))}
              </div>
            </FieldSet>

            <Controller
              control={form.control}
              name="featureKeys"
              render={({ field }) => {
                const selected = new Set(field.value);
                const toggle = (key: string, checked: boolean) => {
                  const next = new Set(selected);
                  if (checked) next.add(key);
                  else next.delete(key);
                  field.onChange([...next]);
                };
                return (
                  <FieldSet>
                    <FieldLegend variant="label">
                      Fonctionnalités incluses ({selected.size}/{features.data?.length ?? 0})
                    </FieldLegend>
                    {features.isPending ? (
                      <p className="text-muted-foreground text-sm">Chargement du catalogue…</p>
                    ) : (
                      <div className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
                        {modules.map(({ module, items }) => (
                          <div key={module} className="flex flex-col gap-2">
                            <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                              {module}
                            </span>
                            {items.map((feature) => (
                              <Field key={feature.key} orientation="horizontal" className="items-start gap-2">
                                <Checkbox
                                  id={`feature-${feature.key}`}
                                  checked={selected.has(feature.key)}
                                  onCheckedChange={(c) => toggle(feature.key, c === true)}
                                />
                                <FieldLabel htmlFor={`feature-${feature.key}`} className="font-normal">
                                  {feature.label}
                                  {feature.requiresHardware ? (
                                    <span className="text-muted-foreground text-xs"> · matériel requis</span>
                                  ) : null}
                                </FieldLabel>
                              </Field>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </FieldSet>
                );
              }}
            />

            <Controller
              control={form.control}
              name="options"
              render={({ field }) => (
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="offer-options">Options complémentaires</FieldLabel>
                  <Textarea {...field} id="offer-options" rows={2} placeholder="Ex. : pack SMS supplémentaire" />
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="offer-form" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {offer ? "Enregistrer" : "Créer l'offre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
