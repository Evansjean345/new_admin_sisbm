"use client";

import { useState } from "react";

import Link from "next/link";

import { ArrowLeftRight, MoreVertical, Plus, Truck, Unlink } from "lucide-react";
import { toast } from "sonner";

import { TransferVehicleDialog } from "@/app/(main)/dashboard/_components/subscriptions/transfer-vehicle-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/query-state";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useRemoveSubscriptionVehicle } from "@/hooks/api/use-subscriptions";
import { getErrorMessage } from "@/lib/axios";
import { formatDate } from "@/lib/format";
import type { Subscription, VehicleAssignment } from "@/types/subscription";

import { AssignVehiclesDialog } from "./assign-vehicles-dialog";

export function VehiclesTab({ subscription }: { subscription: Subscription }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferring, setTransferring] = useState<VehicleAssignment | null>(null);
  const [removing, setRemoving] = useState<VehicleAssignment | null>(null);
  const [reason, setReason] = useState("");
  const remove = useRemoveSubscriptionVehicle();

  const active = subscription.assignments.filter((a) => a.status === "active");
  const closed = subscription.assignments
    .filter((a) => a.status === "closed")
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));
  const writable = subscription.status !== "terminated";

  function confirmRemove() {
    if (!removing) return;
    if (reason.trim().length < 5) {
      toast.error("Motif obligatoire", { description: "5 caractères minimum." });
      return;
    }
    remove.mutate(
      { id: subscription.id, vehicleId: removing.vehicleId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("Véhicule retiré", { description: removing.registration });
          setRemoving(null);
        },
        onError: (error) => toast.error("Retrait impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Véhicules affectés ({active.length})</CardTitle>
          <CardDescription>Affectations en cours. Un retrait clôture l'affectation sans la supprimer.</CardDescription>
          <CardAction>
            <Button size="sm" disabled={!writable} onClick={() => setAssignOpen(true)}>
              <Plus data-icon="inline-start" />
              Affecter
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {active.length === 0 ? (
            <div className="px-4">
              <EmptyState
                icon={<Truck />}
                title="Aucun véhicule affecté"
                description="Affectez les véhicules du client."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Depuis le</TableHead>
                    <TableHead className="hidden md:table-cell">Origine</TableHead>
                    <TableHead className="hidden lg:table-cell">Par</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/vehicles/${a.vehicleId}`}
                          prefetch={false}
                          className="flex flex-col hover:underline"
                        >
                          <span className="font-medium">{a.registration}</span>
                          {a.label ? <span className="text-muted-foreground text-xs">{a.label}</span> : null}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDate(a.startDate)}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {a.transferredTo ? `Transfert depuis ${a.transferredTo.reference}` : "Affectation directe"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{a.createdBy}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={!writable}
                                aria-label={`Actions pour ${a.registration}`}
                              >
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => setTransferring(a)}>
                                <ArrowLeftRight />
                                Changer d'offre
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setReason("");
                                  setRemoving(a);
                                }}
                              >
                                <Unlink />
                                Retirer de la souscription
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Affectations clôturées ({closed.length})</CardTitle>
          <CardDescription>Historique conservé : retraits, changements d'offre et résiliation.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {closed.length === 0 ? (
            <p className="px-4 text-muted-foreground text-sm">Aucune affectation clôturée.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead className="hidden md:table-cell">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closed.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.registration}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatDate(a.startDate)} → {formatDate(a.endDate)}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                        {a.closeReason ?? "—"}
                        {a.transferredTo ? ` (${a.transferredTo.reference})` : ""}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StatusBadge tone="neutral">Clôturée</StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AssignVehiclesDialog subscription={subscription} open={assignOpen} onOpenChange={setAssignOpen} />
      <TransferVehicleDialog
        subscription={subscription}
        assignment={transferring}
        onOpenChange={(o) => !o && setTransferring(null)}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Retirer ${removing?.registration ?? ""} ?`}
        description="L'affectation est clôturée à la date du jour ; le véhicule perd les droits de cette offre."
        confirmLabel="Retirer"
        destructive
        loading={remove.isPending}
        onConfirm={confirmRemove}
      >
        <Field className="gap-1.5">
          <FieldLabel htmlFor="remove-reason">Motif</FieldLabel>
          <Textarea
            id="remove-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : véhicule vendu, sortie de flotte…"
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
