"use client";

import { useState } from "react";

import { Archive, MoreVertical, Pencil, Rocket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteOffer, useUpdateOffer } from "@/hooks/api/use-offers";
import { getErrorMessage } from "@/lib/axios";
import type { Offer, OfferStatus } from "@/types/offer";

import { OfferFormDialog } from "./offer-form-dialog";

export function OfferRowActions({ offer }: { offer: Offer }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const update = useUpdateOffer();
  const remove = useDeleteOffer();

  function setStatus(status: OfferStatus, message: string) {
    update.mutate(
      { id: offer.id, payload: { status } },
      {
        onSuccess: () => toast.success(message, { description: offer.name }),
        onError: (error) => toast.error("Changement impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions pour l'offre ${offer.name}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setDialog("edit")}>
              <Pencil />
              Modifier
            </DropdownMenuItem>
            {offer.status === "active" ? (
              <DropdownMenuItem onClick={() => setStatus("retired", "Offre retirée du catalogue")}>
                <Archive />
                Retirer du catalogue
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setStatus("active", "Offre commercialisée")}>
                <Rocket />
                Commercialiser
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            <Trash2 />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <OfferFormDialog offer={offer} open={dialog === "edit"} onOpenChange={(o) => !o && setDialog(null)} />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Supprimer l'offre ${offer.name} ?`}
        description="Impossible si des souscriptions l'utilisent : dans ce cas, retirez-la du catalogue pour conserver l'historique."
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(offer.id, {
            onSuccess: () => {
              toast.success("Offre supprimée", { description: offer.name });
              setDialog(null);
            },
            onError: (error) => {
              toast.error("Suppression impossible", { description: getErrorMessage(error) });
              setDialog(null);
            },
          })
        }
      />
    </>
  );
}
