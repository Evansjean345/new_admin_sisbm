"use client";

import { useEffect, useMemo, useState } from "react";

import { Check } from "lucide-react";
import { toast } from "sonner";

import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { offerPeriodicityShort } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAssignClientOffer, useClientOffer } from "@/hooks/api/use-client-offers";
import { useOfferFeatures, useOffers } from "@/hooks/api/use-offers";
import { useSubscriptions } from "@/hooks/api/use-subscriptions";
import { useUsers } from "@/hooks/api/use-users";
import { getErrorMessage } from "@/lib/axios";

const AUTO = "__auto__";

/**
 * Attribution d'une offre à un client d'une organisation (retour de la direction, 12/11/2026).
 * Organisation → client → offre ; la souscription de l'organisation est réutilisée ou créée.
 */
export function AssignOfferDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Client présélectionné (depuis sa fiche ou l'éditeur de permissions). */
  preset?: { userId: string; organizationId: string } | null;
}) {
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [userId, setUserId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState(AUTO);
  const assign = useAssignClientOffer();

  const users = useUsers({ organizationId, perPage: 100 }, { enabled: open && Boolean(organizationId) });
  const clients = (users.data?.data ?? []).filter((u) => u.role?.code !== "super_admin");
  const current = useClientOffer(open && userId ? userId : undefined);
  const offers = useOffers({ status: "active", perPage: 100 });
  const features = useOfferFeatures();
  const subscriptions = useSubscriptions(
    { organizationId, offerId, status: "active", perPage: 100 },
    { enabled: open && Boolean(organizationId && offerId) },
  );
  const offer = (offers.data?.data ?? []).find((o) => o.id === offerId);
  const existingSubs = subscriptions.data?.data ?? [];

  const included = useMemo(() => {
    if (!offer) return [];
    const byModule = new Map<string, string[]>();
    for (const f of features.data ?? []) {
      if (!offer.featureKeys.includes(f.key)) continue;
      byModule.set(f.module, [...(byModule.get(f.module) ?? []), f.label]);
    }
    return [...byModule.entries()];
  }, [offer, features.data]);

  const presetUserId = preset?.userId;
  const presetOrganizationId = preset?.organizationId;
  useEffect(() => {
    if (!open) return;
    setOrganizationId(presetOrganizationId);
    setUserId(presetUserId ?? "");
    setOfferId("");
    setSubscriptionId(AUTO);
  }, [open, presetUserId, presetOrganizationId]);

  // Par défaut : la souscription existante de l'organisation sur cette offre.
  const firstSubId = subscriptions.data?.data[0]?.id;
  useEffect(() => {
    setSubscriptionId(firstSubId ?? AUTO);
  }, [firstSubId]);

  function submit() {
    assign.mutate(
      { userId, offerId, subscriptionId: subscriptionId === AUTO ? undefined : subscriptionId },
      {
        onSuccess: (a) => {
          toast.success("Offre attribuée", {
            description: `${a.userName} · ${a.offer.name} (${a.subscriptionReference})`,
          });
          onOpenChange(false);
        },
        onError: (error) => toast.error("Attribution impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !assign.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Attribuer une offre à un client</DialogTitle>
          <DialogDescription>
            L'offre détermine les fonctionnalités que l'on pourra ensuite accorder au client dans ses permissions.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="assign-organization">Organisation</FieldLabel>
              <OrganizationSelect
                id="assign-organization"
                className="w-full"
                value={organizationId}
                disabled={Boolean(preset)}
                onChange={(id) => {
                  setOrganizationId(id);
                  setUserId("");
                }}
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="assign-user">Client</FieldLabel>
              <Select
                value={userId}
                onValueChange={setUserId}
                disabled={Boolean(preset) || !organizationId || users.isPending}
              >
                <SelectTrigger id="assign-user" className="w-full">
                  <SelectValue placeholder={organizationId ? "Choisir un client" : "Choisir d'abord l'organisation"} />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectGroup>
                    {clients.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName} — {u.role?.name ?? "sans rôle"}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {organizationId && !users.isPending && clients.length === 0 ? (
                <FieldDescription>Aucun client dans cette organisation.</FieldDescription>
              ) : null}
              {current.data ? (
                <FieldDescription>
                  Offre actuelle : {current.data.offer.name}. La nouvelle offre la remplacera.
                </FieldDescription>
              ) : null}
            </Field>
          </div>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="assign-offer">Offre</FieldLabel>
            <Select value={offerId} onValueChange={setOfferId} disabled={offers.isPending}>
              <SelectTrigger id="assign-offer" className="w-full">
                <SelectValue placeholder="Choisir une offre commercialisée" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {(offers.data?.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} — {formatMoney(o.referencePrice, o.currency)} / {offerPeriodicityShort[o.periodicity]} ·{" "}
                      {o.featureKeys.length} fonctionnalités
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {offer ? (
            <>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="assign-subscription">Souscription de l'organisation</FieldLabel>
                <Select value={subscriptionId} onValueChange={setSubscriptionId} disabled={subscriptions.isPending}>
                  <SelectTrigger id="assign-subscription" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {existingSubs.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.reference} — active depuis le {s.startDate}
                        </SelectItem>
                      ))}
                      <SelectItem value={AUTO}>Créer une nouvelle souscription {offer.name}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {subscriptionId === AUTO
                    ? "Une souscription active est créée aujourd'hui, au tarif de référence ; ajoutez-y les véhicules depuis Souscriptions."
                    : "Le client rejoint la souscription existante (facturation et véhicules inchangés)."}
                </FieldDescription>
              </Field>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 font-medium text-sm">Fonctionnalités incluses dans {offer.name}</p>
                <ul className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                  {included.map(([module, labels]) => (
                    <li key={module} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        <span className="font-medium">{module}</span>
                        {labels.length > 1 ? (
                          <span className="text-muted-foreground"> : {labels.join(", ")}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" disabled={assign.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={assign.isPending || !userId || !offerId} onClick={submit}>
            {assign.isPending ? <Spinner data-icon="inline-start" /> : null}
            Attribuer l'offre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
