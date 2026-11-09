"use client";

import { useEffect, useState } from "react";

import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useSubscriptions, useTransferSubscriptionVehicle } from "@/hooks/api/use-subscriptions";
import { getErrorMessage } from "@/lib/axios";
import type { Subscription, VehicleAssignment } from "@/types/subscription";

/**
 * Changement d'offre d'un véhicule (§VI.3) : clôture de l'affectation actuelle,
 * ouverture d'une nouvelle sur une autre souscription ACTIVE du même client.
 */
export function TransferVehicleDialog({
  subscription,
  assignment,
  onOpenChange,
}: {
  subscription: Subscription;
  /** null = fermé. */
  assignment: VehicleAssignment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const transfer = useTransferSubscriptionVehicle();
  const candidates = useSubscriptions(
    { organizationId: subscription.organizationId, status: "active", perPage: 100 },
    { enabled: Boolean(assignment) },
  );

  useEffect(() => {
    if (assignment) {
      setTargetId("");
      setEffectiveDate(new Date().toISOString().slice(0, 10));
    }
  }, [assignment]);

  const targets = (candidates.data?.data ?? []).filter((s) => s.id !== subscription.id);
  const target = targets.find((s) => s.id === targetId);

  function submit() {
    if (!assignment) return;
    transfer.mutate(
      { id: subscription.id, vehicleId: assignment.vehicleId, targetId, effectiveDate },
      {
        onSuccess: () => {
          toast.success("Offre changée", {
            description: `${assignment.registration} : ${subscription.offer.name} → ${target?.offer.name ?? ""}`,
          });
          onOpenChange(false);
        },
        onError: (error) => toast.error("Changement impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={Boolean(assignment)} onOpenChange={(next) => !transfer.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Changer l'offre de {assignment?.registration}</DialogTitle>
          <DialogDescription>
            L'affectation actuelle est clôturée à la date d'effet et une nouvelle est créée sur la souscription choisie.
            L'historique est conservé.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="transfer-target">Nouvelle souscription</FieldLabel>
            <Select value={targetId} onValueChange={setTargetId} disabled={candidates.isPending}>
              <SelectTrigger id="transfer-target" className="w-full">
                <SelectValue placeholder={candidates.isPending ? "Chargement…" : "Choisir une souscription"} />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {targets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.reference} — {s.offer.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {!candidates.isPending && targets.length === 0 ? (
              <FieldDescription>
                Aucune autre souscription active pour ce client : créez d'abord la souscription de la nouvelle offre.
              </FieldDescription>
            ) : null}
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="transfer-date">Date d'effet</FieldLabel>
            <Input
              id="transfer-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
            <FieldDescription>
              Application immédiate ou à la prochaine échéance : décision SISBM en attente (§15).
            </FieldDescription>
          </Field>
          {target ? (
            <div className="flex items-center justify-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
              <span>{subscription.offer.name}</span>
              <ArrowRight className="size-4 text-muted-foreground" />
              <span className="font-medium">{target.offer.name}</span>
            </div>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" disabled={transfer.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={transfer.isPending || !targetId || !effectiveDate} onClick={submit}>
            {transfer.isPending ? <Spinner data-icon="inline-start" /> : null}
            Changer l'offre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
