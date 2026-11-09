"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useOrganizations } from "@/hooks/api/use-organizations";
import { useAssignSubscriptionVehicles, useSubscriptions } from "@/hooks/api/use-subscriptions";
import { useSetVehicleOperator } from "@/hooks/api/use-vehicle-operator";
import { getErrorMessage } from "@/lib/axios";

/** Affecte le véhicule à une souscription ACTIVE de son client propriétaire. */
export function AttachSubscriptionDialog({
  vehicleId,
  registration,
  organizationId,
  open,
  onOpenChange,
}: {
  vehicleId: string;
  registration: string;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [subscriptionId, setSubscriptionId] = useState("");
  const assign = useAssignSubscriptionVehicles();
  const candidates = useSubscriptions({ organizationId, status: "active", perPage: 100 }, { enabled: open });
  const rows = candidates.data?.data ?? [];

  useEffect(() => {
    if (open) setSubscriptionId("");
  }, [open]);

  function submit() {
    assign.mutate(
      { id: subscriptionId, vehicleIds: [vehicleId] },
      {
        onSuccess: (sub) => {
          toast.success("Véhicule affecté", { description: `${registration} → ${sub.reference} (${sub.offer.name})` });
          onOpenChange(false);
        },
        onError: (error) => toast.error("Affectation impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !assign.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Affecter {registration} à une souscription</DialogTitle>
          <DialogDescription>Le véhicule bénéficiera des droits de l'offre à partir d'aujourd'hui.</DialogDescription>
        </DialogHeader>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="attach-subscription">Souscription</FieldLabel>
          <Select value={subscriptionId} onValueChange={setSubscriptionId} disabled={candidates.isPending}>
            <SelectTrigger id="attach-subscription" className="w-full">
              <SelectValue placeholder={candidates.isPending ? "Chargement…" : "Choisir une souscription"} />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {rows.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.reference} — {s.offer.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {!candidates.isPending && rows.length === 0 ? (
            <FieldDescription>
              Ce client n'a aucune souscription active. Créez-en une depuis sa fiche ou l'écran Souscriptions.
            </FieldDescription>
          ) : null}
        </Field>
        <DialogFooter>
          <Button variant="outline" disabled={assign.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={assign.isPending || !subscriptionId} onClick={submit}>
            {assign.isPending ? <Spinner data-icon="inline-start" /> : null}
            Affecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Désigne le client exploitant, quand il diffère du propriétaire (location, sous-traitance). */
export function OperatorDialog({
  vehicleId,
  registration,
  ownerId,
  currentOperatorId,
  open,
  onOpenChange,
}: {
  vehicleId: string;
  registration: string;
  ownerId: string;
  currentOperatorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [operatorId, setOperatorId] = useState<string | undefined>();
  const setOperator = useSetVehicleOperator();
  const organizations = useOrganizations({ perPage: 100 });

  useEffect(() => {
    if (open) setOperatorId(currentOperatorId ?? undefined);
  }, [open, currentOperatorId]);

  function save(clear: boolean) {
    const org = (organizations.data?.data ?? []).find((o) => o.id === operatorId);
    const operator =
      clear || !org || org.id === ownerId ? null : { organizationId: org.id, organizationName: org.name };
    setOperator.mutate(
      { vehicleId, operator },
      {
        onSuccess: () => {
          toast.success("Client exploitant mis à jour", {
            description: operator
              ? `${registration} → ${operator.organizationName}`
              : `${registration} : exploité par son propriétaire`,
          });
          onOpenChange(false);
        },
        onError: (error) => toast.error("Modification impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !setOperator.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Client exploitant de {registration}</DialogTitle>
          <DialogDescription>
            À renseigner quand le véhicule est utilisé par un autre client que son propriétaire.
          </DialogDescription>
        </DialogHeader>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="operator-organization">Client exploitant</FieldLabel>
          <OrganizationSelect id="operator-organization" value={operatorId} onChange={setOperatorId} />
        </Field>
        <DialogFooter>
          <Button variant="outline" disabled={setOperator.isPending || !currentOperatorId} onClick={() => save(true)}>
            Exploité par le propriétaire
          </Button>
          <Button disabled={setOperator.isPending || !operatorId} onClick={() => save(false)}>
            {setOperator.isPending ? <Spinner data-icon="inline-start" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
