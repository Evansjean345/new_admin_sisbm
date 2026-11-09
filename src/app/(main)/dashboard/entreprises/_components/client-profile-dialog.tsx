"use client";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { clientStatusMeta, clientTypeLabels } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateClientProfile } from "@/hooks/api/use-client-profiles";
import { getErrorMessage } from "@/lib/axios";
import {
  CLIENT_STATUSES,
  CLIENT_TYPES,
  type ClientProfile,
  type ClientStatus,
  type ClientType,
} from "@/types/client-profile";
import type { Organization } from "@/types/organization";

import { OrganizationTextField } from "./organization-form-fields";

const PHONE = /^\+[1-9]\d{7,14}$/;
const text = (max: number) => z.string().trim().max(max);

const schema = z.object({
  legalName: text(150),
  tradeName: text(150),
  clientType: z.enum(CLIENT_TYPES),
  registrationNumber: text(60),
  address: text(200),
  city: text(80),
  country: text(80),
  managerName: text(120),
  managerPosition: text(80),
  managerPhone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE.test(v), { message: "Format international attendu : +2250700000000." }),
  managerEmail: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, { message: "Adresse e-mail invalide." }),
  relationStartDate: z.string(),
  salesRep: text(120),
  specialConditions: text(2000),
  notes: text(2000),
  status: z.enum(CLIENT_STATUSES),
});

type Values = z.infer<typeof schema>;

function toDefaults(profile: ClientProfile | undefined, organization: Organization): Values {
  return {
    legalName: profile?.legalName ?? organization.name,
    tradeName: profile?.tradeName ?? "",
    clientType: profile?.clientType ?? "owner",
    registrationNumber: profile?.registrationNumber ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? organization.countryCode ?? "",
    managerName: profile?.manager.name ?? "",
    managerPosition: profile?.manager.position ?? "",
    managerPhone: profile?.manager.phone ?? organization.contactPhone ?? "",
    managerEmail: profile?.manager.email ?? organization.contactEmail ?? "",
    relationStartDate: profile?.relationStartDate ?? organization.createdAt.slice(0, 10),
    salesRep: profile?.salesRep ?? "",
    specialConditions: profile?.specialConditions ?? "",
    notes: profile?.notes ?? "",
    status: profile?.status ?? (organization.isActive ? "active" : "suspended"),
  };
}

/** Fiche commerciale du §III.3 : informations générales, contacts, informations commerciales, statut. */
export function ClientProfileDialog({
  organization,
  profile,
  open,
  onOpenChange,
}: {
  organization: Organization;
  profile: ClientProfile | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateClientProfile();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toDefaults(profile, organization) });

  useEffect(() => {
    if (open) form.reset(toDefaults(profile, organization));
  }, [open, profile, organization, form]);

  function onSubmit(v: Values) {
    const opt = (s: string) => (s === "" ? null : s);
    update.mutate(
      {
        organizationId: organization.id,
        payload: {
          legalName: opt(v.legalName),
          tradeName: opt(v.tradeName),
          clientType: v.clientType,
          registrationNumber: opt(v.registrationNumber),
          address: opt(v.address),
          city: opt(v.city),
          country: opt(v.country),
          manager: {
            name: opt(v.managerName),
            position: opt(v.managerPosition),
            phone: opt(v.managerPhone),
            email: opt(v.managerEmail),
          },
          relationStartDate: opt(v.relationStartDate),
          salesRep: opt(v.salesRep),
          specialConditions: opt(v.specialConditions),
          notes: opt(v.notes),
          status: v.status,
        },
      },
      {
        onSuccess: () => {
          toast.success("Fiche commerciale enregistrée", { description: organization.name });
          onOpenChange(false);
        },
        onError: (error) => toast.error("Enregistrement impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !update.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fiche commerciale — {organization.name}</DialogTitle>
          <DialogDescription>
            Le statut commercial ne bloque pas les comptes : l'accès se gère avec « Désactiver » sur l'organisation.
          </DialogDescription>
        </DialogHeader>

        <form id="client-profile-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-6">
            <FieldSet>
              <FieldLegend>Informations générales</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <OrganizationTextField control={form.control} name="legalName" label="Raison sociale" />
                <OrganizationTextField
                  control={form.control}
                  name="tradeName"
                  label="Nom commercial"
                  placeholder="Si différent"
                />
                <Controller
                  control={form.control}
                  name="clientType"
                  render={({ field }) => (
                    <Field className="gap-1.5">
                      <FieldLabel htmlFor="client-type">Type de client</FieldLabel>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v as ClientType)}>
                        <SelectTrigger id="client-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {CLIENT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {clientTypeLabels[t]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <OrganizationTextField
                  control={form.control}
                  name="registrationNumber"
                  label="N° RCCM ou identifiant"
                  placeholder="CI-ABJ-2026-B-12345"
                  className="font-mono"
                />
                <OrganizationTextField control={form.control} name="address" label="Adresse" />
                <div className="grid grid-cols-2 gap-4">
                  <OrganizationTextField control={form.control} name="city" label="Ville" placeholder="Abidjan" />
                  <OrganizationTextField control={form.control} name="country" label="Pays" placeholder="CI" />
                </div>
              </div>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Contact responsable</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <OrganizationTextField control={form.control} name="managerName" label="Nom du responsable" />
                <OrganizationTextField
                  control={form.control}
                  name="managerPosition"
                  label="Fonction"
                  placeholder="Directeur des opérations"
                />
                <OrganizationTextField
                  control={form.control}
                  name="managerPhone"
                  label="Téléphone"
                  placeholder="+2250700000001"
                />
                <OrganizationTextField control={form.control} name="managerEmail" label="E-mail" type="email" />
              </div>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Informations commerciales</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-3">
                <OrganizationTextField
                  control={form.control}
                  name="relationStartDate"
                  label="Entrée en relation"
                  type="date"
                />
                <OrganizationTextField control={form.control} name="salesRep" label="Commercial responsable" />
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Field className="gap-1.5">
                      <FieldLabel htmlFor="client-status">Statut</FieldLabel>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v as ClientStatus)}>
                        <SelectTrigger id="client-status" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {CLIENT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {clientStatusMeta[s].label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>
              <Controller
                control={form.control}
                name="specialConditions"
                render={({ field }) => (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="client-conditions">Conditions particulières</FieldLabel>
                    <Textarea {...field} id="client-conditions" rows={2} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="client-notes">Observations</FieldLabel>
                    <Textarea {...field} id="client-notes" rows={2} />
                  </Field>
                )}
              />
            </FieldSet>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" disabled={update.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="client-profile-form" disabled={update.isPending}>
            {update.isPending ? <Spinner data-icon="inline-start" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
