"use client";

import { useState } from "react";

import Link from "next/link";

import { ArrowLeftRight, FileSignature, Link2, MoreVertical, Pencil, Unlink } from "lucide-react";
import { toast } from "sonner";

import { TransferVehicleDialog } from "@/app/(main)/dashboard/_components/subscriptions/transfer-vehicle-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  useRemoveSubscriptionVehicle,
  useSubscription,
  useVehicleSubscriptionHistory,
} from "@/hooks/api/use-subscriptions";
import { useVehicleOperator } from "@/hooks/api/use-vehicle-operator";
import { getErrorMessage } from "@/lib/axios";
import { formatDate } from "@/lib/format";
import type { VehicleDetail } from "@/types/vehicle";

import { AttachSubscriptionDialog, OperatorDialog } from "./vehicle-subscription-dialogs";

/**
 * Volet commercial du véhicule (§III.5) : clients propriétaire / exploitant,
 * offre et souscription actuelles, actions d'affectation et historique.
 * Souscriptions et exploitant sont simulés tant que l'API ne les expose pas.
 */
export function VehicleSubscriptionCard({ vehicle }: { vehicle: VehicleDetail }) {
  const history = useVehicleSubscriptionHistory(vehicle.id);
  const operator = useVehicleOperator(vehicle.id);
  const current = history.data?.find((e) => e.status === "active");
  const closed = (history.data ?? []).filter((e) => e.status === "closed");
  const currentSubscription = useSubscription(current?.subscription.id);

  const [dialog, setDialog] = useState<"attach" | "operator" | "transfer" | "remove" | null>(null);
  const [reason, setReason] = useState("");
  const remove = useRemoveSubscriptionVehicle();
  const close = (open: boolean) => !open && setDialog(null);

  function confirmRemove() {
    if (!current) return;
    if (reason.trim().length < 5) {
      toast.error("Motif obligatoire", { description: "5 caractères minimum." });
      return;
    }
    remove.mutate(
      { id: current.subscription.id, vehicleId: vehicle.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("Véhicule retiré de la souscription", { description: current.subscription.reference });
          setDialog(null);
        },
        onError: (error) => toast.error("Retrait impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Offre & souscription</CardTitle>
        <CardDescription>Données de démonstration.</CardDescription>
        <CardAction>
          {current ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Actions de souscription">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem disabled={!currentSubscription.data} onClick={() => setDialog("transfer")}>
                  <ArrowLeftRight />
                  Changer d'offre
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setReason("");
                    setDialog("remove");
                  }}
                >
                  <Unlink />
                  Retirer de la souscription
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" disabled={history.isPending} onClick={() => setDialog("attach")}>
              <Link2 data-icon="inline-start" />
              Affecter
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Client propriétaire</dt>
            <dd className="truncate">
              <Link
                href={`/dashboard/entreprises/${vehicle.organizationId}`}
                prefetch={false}
                className="hover:underline"
              >
                {vehicle.organization?.name ?? "—"}
              </Link>
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-muted-foreground text-xs">
              Client exploitant
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5"
                aria-label="Modifier le client exploitant"
                onClick={() => setDialog("operator")}
              >
                <Pencil className="size-3" />
              </Button>
            </dt>
            <dd className="truncate">
              {operator.data?.organizationName ?? <span className="text-muted-foreground">Le propriétaire</span>}
            </dd>
          </div>
        </dl>

        <Separator />

        {history.isPending ? (
          <LoadingRows rows={2} />
        ) : current ? (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Offre actuelle</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-lg">{current.subscription.offerName}</span>
              <StatusBadge tone="success">Affecté</StatusBadge>
            </div>
            <span className="text-muted-foreground text-sm">
              <Link
                href={`/dashboard/subscriptions/${current.subscription.id}`}
                prefetch={false}
                className="font-mono text-xs hover:underline"
              >
                {current.subscription.reference}
              </Link>{" "}
              · depuis le {formatDate(current.startDate)}
            </span>
          </div>
        ) : (
          <EmptyState
            icon={<FileSignature />}
            title="Aucune souscription"
            description="Sans affectation, le véhicule ne bénéficie d'aucune fonctionnalité d'offre."
          />
        )}

        {closed.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">Historique des affectations</span>
            <ol className="flex flex-col gap-2">
              {closed.map((e) => (
                <li key={e.id} className="flex flex-col rounded-md border px-3 py-2 text-sm">
                  <span>
                    {e.subscription.offerName}{" "}
                    <span className="font-mono text-muted-foreground text-xs">{e.subscription.reference}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(e.startDate)} → {formatDate(e.endDate)} · {e.closeReason ?? "Clôturée"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </CardContent>

      <AttachSubscriptionDialog
        vehicleId={vehicle.id}
        registration={vehicle.registration}
        organizationId={vehicle.organizationId}
        open={dialog === "attach"}
        onOpenChange={close}
      />
      <OperatorDialog
        vehicleId={vehicle.id}
        registration={vehicle.registration}
        ownerId={vehicle.organizationId}
        currentOperatorId={operator.data?.organizationId ?? null}
        open={dialog === "operator"}
        onOpenChange={close}
      />
      {currentSubscription.data && current ? (
        <TransferVehicleDialog
          subscription={currentSubscription.data}
          assignment={dialog === "transfer" ? current : null}
          onOpenChange={close}
        />
      ) : null}
      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={close}
        title={`Retirer ${vehicle.registration} de ${current?.subscription.reference ?? ""} ?`}
        description="L'affectation est clôturée aujourd'hui ; le véhicule perd les droits de l'offre. L'historique est conservé."
        confirmLabel="Retirer"
        destructive
        loading={remove.isPending}
        onConfirm={confirmRemove}
      >
        <Field className="gap-1.5">
          <FieldLabel htmlFor="vehicle-remove-reason">Motif</FieldLabel>
          <Textarea
            id="vehicle-remove-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : véhicule vendu, fin de contrat…"
          />
        </Field>
      </ConfirmDialog>
    </Card>
  );
}
