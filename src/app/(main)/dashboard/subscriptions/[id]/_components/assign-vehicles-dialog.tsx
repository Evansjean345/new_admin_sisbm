"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { VehiclePicker } from "@/app/(main)/dashboard/_components/subscriptions/vehicle-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAssignSubscriptionVehicles } from "@/hooks/api/use-subscriptions";
import { getErrorMessage } from "@/lib/axios";
import type { Subscription } from "@/types/subscription";

export function AssignVehiclesDialog({
  subscription,
  open,
  onOpenChange,
}: {
  subscription: Subscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);
  const assign = useAssignSubscriptionVehicles();

  useEffect(() => {
    if (open) setVehicleIds([]);
  }, [open]);

  function submit() {
    assign.mutate(
      { id: subscription.id, vehicleIds },
      {
        onSuccess: () => {
          toast.success(`${vehicleIds.length} véhicule(s) affecté(s)`, { description: subscription.reference });
          onOpenChange(false);
        },
        onError: (error) => toast.error("Affectation impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !assign.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Affecter des véhicules</DialogTitle>
          <DialogDescription>
            Véhicules de {subscription.organization.name}. L'affectation démarre aujourd'hui ; un véhicule déjà affecté
            ailleurs doit d'abord en être retiré ou transféré.
          </DialogDescription>
        </DialogHeader>
        <VehiclePicker organizationId={subscription.organizationId} value={vehicleIds} onChange={setVehicleIds} />
        <DialogFooter>
          <Button variant="outline" disabled={assign.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={assign.isPending || vehicleIds.length === 0} onClick={submit}>
            {assign.isPending ? <Spinner data-icon="inline-start" /> : null}
            Affecter {vehicleIds.length > 0 ? `(${vehicleIds.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
