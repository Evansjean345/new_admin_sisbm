"use client";

import Link from "next/link";

import { CarFront, Plus } from "lucide-react";

import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { vehicleStatusMeta, vehicleTypeLabels } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVehicleAvailability } from "@/hooks/api/use-subscriptions";
import { useVehicles } from "@/hooks/api/use-vehicles";

/**
 * Véhicules du client avec leur offre et leur souscription actuelles (§III.5).
 * Un véhicule sans affectation active n'a aucun droit commercial.
 */
export function OrganizationVehiclesCard({ organizationId }: { organizationId: string }) {
  const vehicles = useVehicles({ organizationId, perPage: 100 });
  const availability = useVehicleAvailability();
  const rows = vehicles.data?.data ?? [];
  const unassigned = rows.filter((v) => !availability.data?.[v.id]).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Véhicules ({vehicles.data?.meta.total ?? "…"})</CardTitle>
        <CardDescription>
          {availability.data && rows.length > 0
            ? unassigned > 0
              ? `${unassigned} véhicule(s) sans souscription active : aucune fonctionnalité commerciale.`
              : "Tous les véhicules ont une souscription active."
            : "Offre et souscription actuelles de chaque véhicule."}
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/vehicles" prefetch={false}>
              <Plus data-icon="inline-start" />
              Ajouter un véhicule
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {vehicles.isPending ? (
          <LoadingRows rows={4} />
        ) : vehicles.isError ? (
          <div className="px-4">
            <ErrorState error={vehicles.error} onRetry={() => vehicles.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4">
            <EmptyState
              icon={<CarFront />}
              title="Aucun véhicule"
              description="Ce client n'a pas encore de véhicule."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Immatriculation</TableHead>
                  <TableHead className="hidden md:table-cell">Marque / modèle</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Offre actuelle</TableHead>
                  <TableHead className="hidden lg:table-cell">Souscription actuelle</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((v) => {
                  const current = availability.data?.[v.id];
                  const status = vehicleStatusMeta[v.status];
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/vehicles/${v.id}`}
                          prefetch={false}
                          className="font-mono text-xs hover:underline"
                        >
                          {v.registration}
                        </Link>
                        {v.label ? <span className="block text-muted-foreground text-xs">{v.label}</span> : null}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{vehicleTypeLabels[v.vehicleType]}</TableCell>
                      <TableCell>
                        {availability.isPending ? (
                          "…"
                        ) : current ? (
                          current.offerName
                        ) : (
                          <StatusBadge tone="warning">Sans offre</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {current ? (
                          <Link
                            href={`/dashboard/subscriptions/${current.subscriptionId}`}
                            prefetch={false}
                            className="font-mono text-xs hover:underline"
                          >
                            {current.reference}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
