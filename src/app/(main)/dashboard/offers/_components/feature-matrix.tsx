"use client";

import { Fragment } from "react";

import { Cpu } from "lucide-react";
import { toast } from "sonner";

import { groupFeaturesByModule } from "@/app/(main)/dashboard/_components/offers/offer-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpdateOffer } from "@/hooks/api/use-offers";
import { getErrorMessage } from "@/lib/axios";
import type { Offer, OfferFeature } from "@/types/offer";

/**
 * Matrice modules × offres (§III.2) : chaque case active ou retire une
 * fonctionnalité d'une offre, sans modification du code source.
 */
export function FeatureMatrix({ offers, features }: { offers: Offer[]; features: OfferFeature[] }) {
  const update = useUpdateOffer();
  const modules = groupFeaturesByModule(features);

  function toggle(offer: Offer, feature: OfferFeature, checked: boolean) {
    const keys = new Set(offer.featureKeys);
    if (checked) keys.add(feature.key);
    else keys.delete(feature.key);
    update.mutate(
      { id: offer.id, payload: { featureKeys: [...keys] } },
      {
        onSuccess: () =>
          toast.success(checked ? "Fonctionnalité ajoutée" : "Fonctionnalité retirée", {
            description: `${feature.label} — ${offer.name}`,
          }),
        onError: (error) => toast.error("Modification impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matrice des fonctionnalités</CardTitle>
        <CardDescription>
          Droits commerciaux par offre. Les fonctionnalités marquées d'une puce exigent aussi un équipement compatible.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Fonctionnalité</TableHead>
                {offers.map((offer) => (
                  <TableHead key={offer.id} className="text-center">
                    {offer.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map(({ module, items }) => (
                <Fragment key={module}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={offers.length + 1}
                      className="py-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                    >
                      {module}
                    </TableCell>
                  </TableRow>
                  {items.map((feature) => (
                    <TableRow key={feature.key}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          {feature.label}
                          {feature.requiresHardware ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Cpu className="size-3.5 text-muted-foreground" aria-label="Matériel requis" />
                              </TooltipTrigger>
                              <TooltipContent>{feature.description ?? "Matériel compatible requis."}</TooltipContent>
                            </Tooltip>
                          ) : null}
                        </span>
                      </TableCell>
                      {offers.map((offer) => (
                        <TableCell key={offer.id} className="text-center">
                          <Checkbox
                            className="align-middle"
                            checked={offer.featureKeys.includes(feature.key)}
                            disabled={update.isPending}
                            onCheckedChange={(c) => toggle(offer, feature, c === true)}
                            aria-label={`${feature.label} dans l'offre ${offer.name}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
