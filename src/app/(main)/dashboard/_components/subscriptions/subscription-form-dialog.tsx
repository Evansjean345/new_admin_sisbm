"use client";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { offerPeriodicityLabels } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
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
import { useOffers } from "@/hooks/api/use-offers";
import { useCreateSubscription, useUpdateSubscription } from "@/hooks/api/use-subscriptions";
import { getErrorMessage } from "@/lib/axios";
import { OFFER_PERIODICITIES, type OfferPeriodicity } from "@/types/offer";
import type { CreateSubscriptionPayload, Subscription } from "@/types/subscription";

import { effectiveUnitPrice, formatMoney, suggestReference } from "./subscription-utils";
import { VehiclePicker } from "./vehicle-picker";

const amount = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+$/.test(v), { message: "Montant entier en FCFA." });

const schema = z
  .object({
    organizationId: z.string().min(1, { message: "Choisir le client." }),
    offerId: z.string().min(1, { message: "Choisir l'offre." }),
    reference: z.string().trim().min(3, { message: "3 caractères minimum." }).max(30),
    startDate: z.string().min(1, { message: "Date de début obligatoire." }),
    endDate: z.string(),
    periodicity: z.enum(OFFER_PERIODICITIES),
    negotiatedPrice: amount,
    discountPercent: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) <= 100), { message: "Entre 0 et 100 %." }),
    specialConditions: z.string().trim().max(1000),
    vehicleIds: z.array(z.string()),
    status: z.enum(["draft", "active"]),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "L'échéance doit suivre la date de début.",
    path: ["endDate"],
  });

type Values = z.infer<typeof schema>;

function toDefaults(sub?: Subscription, organizationId?: string): Values {
  return {
    organizationId: sub?.organizationId ?? organizationId ?? "",
    offerId: sub?.offerId ?? "",
    reference: sub?.reference ?? suggestReference(),
    startDate: sub?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: sub?.endDate ?? "",
    periodicity: sub?.periodicity ?? "monthly",
    negotiatedPrice: sub?.negotiatedPrice === null || sub === undefined ? "" : String(sub.negotiatedPrice),
    discountPercent: sub && sub.discountPercent > 0 ? String(sub.discountPercent) : "",
    specialConditions: sub?.specialConditions ?? "",
    vehicleIds: [],
    status: "active",
  };
}

export function SubscriptionFormDialog({
  open,
  onOpenChange,
  subscription,
  defaultOrganizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = création. */
  subscription?: Subscription;
  defaultOrganizationId?: string;
}) {
  const editing = Boolean(subscription);
  const create = useCreateSubscription();
  const update = useUpdateSubscription();
  const offers = useOffers({ status: "active", perPage: 100 });
  const pending = create.isPending || update.isPending;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(subscription, defaultOrganizationId),
  });

  useEffect(() => {
    if (open) form.reset(toDefaults(subscription, defaultOrganizationId));
  }, [open, subscription, defaultOrganizationId, form]);

  const [organizationId, offerId, negotiatedPrice, discountPercent] = useWatch({
    control: form.control,
    name: ["organizationId", "offerId", "negotiatedPrice", "discountPercent"],
  });
  const offerList = offers.data?.data ?? [];
  const offer = offerList.find((o) => o.id === offerId);
  const referencePrice = subscription?.referencePrice ?? offer?.referencePrice;
  const preview =
    referencePrice === undefined
      ? null
      : effectiveUnitPrice({
          referencePrice,
          negotiatedPrice: negotiatedPrice === "" ? null : Number(negotiatedPrice),
          discountPercent: discountPercent === "" ? 0 : Number(discountPercent),
        });

  function onSubmit(values: Values) {
    const opt = (v: string) => (v === "" ? undefined : v);
    const num = (v: string) => (v === "" ? undefined : Number(v));
    const payload: CreateSubscriptionPayload = {
      organizationId: values.organizationId,
      offerId: values.offerId,
      reference: values.reference,
      startDate: values.startDate,
      endDate: opt(values.endDate),
      periodicity: values.periodicity,
      negotiatedPrice: num(values.negotiatedPrice),
      discountPercent: num(values.discountPercent),
      specialConditions: opt(values.specialConditions),
      vehicleIds: values.vehicleIds,
      status: values.status,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "Souscription mise à jour" : "Souscription créée", { description: values.reference });
        onOpenChange(false);
      },
      onError: (error: unknown) =>
        toast.error(editing ? "Mise à jour impossible" : "Création impossible", {
          description: getErrorMessage(error),
        }),
    };
    if (subscription) {
      const { organizationId: _o, offerId: _f, vehicleIds: _v, status: _s, ...rest } = payload;
      update.mutate(
        {
          id: subscription.id,
          payload: {
            ...rest,
            endDate: rest.endDate ?? null,
            negotiatedPrice: rest.negotiatedPrice ?? null,
            discountPercent: rest.discountPercent ?? 0,
            specialConditions: rest.specialConditions ?? null,
          },
        },
        handlers,
      );
    } else {
      create.mutate(payload, handlers);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{subscription ? `Modifier ${subscription.reference}` : "Nouvelle souscription"}</DialogTitle>
          <DialogDescription>
            Une souscription lie un client à une offre. Le tarif de référence est repris de l'offre ; le tarif négocié
            et la remise s'appliquent par véhicule.
          </DialogDescription>
        </DialogHeader>

        <form id="subscription-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="organizationId"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sub-organization">Client</FieldLabel>
                    <OrganizationSelect
                      id="sub-organization"
                      value={field.value || undefined}
                      onChange={(id) => {
                        field.onChange(id ?? "");
                        form.setValue("vehicleIds", []);
                      }}
                      invalid={fieldState.invalid}
                      disabled={editing}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="offerId"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sub-offer">Offre</FieldLabel>
                    <Select
                      value={field.value}
                      disabled={editing || offers.isPending}
                      onValueChange={(id) => {
                        field.onChange(id);
                        const picked = offerList.find((o) => o.id === id);
                        if (picked) form.setValue("periodicity", picked.periodicity);
                      }}
                    >
                      <SelectTrigger id="sub-offer" className="w-full" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder={editing ? subscription?.offer.name : "Choisir une offre"} />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          {offerList.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name} — {formatMoney(o.referencePrice, o.currency)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {editing ? (
                      <FieldDescription>
                        Pour changer d'offre, transférez les véhicules vers une autre souscription.
                      </FieldDescription>
                    ) : null}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Controller
                control={form.control}
                name="reference"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sub-reference">Référence</FieldLabel>
                    <Input {...field} id="sub-reference" className="uppercase" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="startDate"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sub-start">Date de début</FieldLabel>
                    <Input {...field} id="sub-start" type="date" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="endDate"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sub-end">Fin ou échéance</FieldLabel>
                    <Input {...field} id="sub-end" type="date" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="periodicity"
                render={({ field }) => (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="sub-periodicity">Périodicité</FieldLabel>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as OfferPeriodicity)}>
                      <SelectTrigger id="sub-periodicity" className="w-full">
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
            </div>

            <FieldSet>
              <FieldLegend variant="label">Tarification par véhicule</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sub-ref-price">Tarif de référence</FieldLabel>
                  <Input
                    id="sub-ref-price"
                    readOnly
                    disabled
                    value={referencePrice === undefined ? "—" : formatMoney(referencePrice)}
                  />
                </Field>
                <Controller
                  control={form.control}
                  name="negotiatedPrice"
                  render={({ field, fieldState }) => (
                    <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="sub-negotiated">Tarif négocié</FieldLabel>
                      <Input
                        {...field}
                        id="sub-negotiated"
                        inputMode="numeric"
                        placeholder="Aucun"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="discountPercent"
                  render={({ field, fieldState }) => (
                    <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="sub-discount">Remise (%)</FieldLabel>
                      <Input
                        {...field}
                        id="sub-discount"
                        inputMode="decimal"
                        placeholder="0"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sub-effective">Tarif appliqué</FieldLabel>
                  <Input
                    id="sub-effective"
                    readOnly
                    disabled
                    className="font-medium"
                    value={preview === null ? "—" : formatMoney(preview)}
                  />
                </Field>
              </div>
            </FieldSet>

            {editing ? null : (
              <>
                <Controller
                  control={form.control}
                  name="vehicleIds"
                  render={({ field }) => (
                    <FieldSet>
                      <FieldLegend variant="label">Véhicules à affecter</FieldLegend>
                      <VehiclePicker
                        organizationId={organizationId || undefined}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FieldSet>
                  )}
                />
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Field className="gap-1.5 sm:max-w-xs">
                      <FieldLabel htmlFor="sub-status">Statut initial</FieldLabel>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v as Values["status"])}>
                        <SelectTrigger id="sub-status" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="draft">Brouillon</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </>
            )}

            <Controller
              control={form.control}
              name="specialConditions"
              render={({ field }) => (
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="sub-conditions">Conditions particulières</FieldLabel>
                  <Textarea {...field} id="sub-conditions" rows={3} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="subscription-form" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {editing ? "Enregistrer" : "Créer la souscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
