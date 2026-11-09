"use client";

import { useState } from "react";

import { Search } from "lucide-react";

import { ErrorState } from "@/components/query-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useVehicleAvailability } from "@/hooks/api/use-subscriptions";
import { useVehicles } from "@/hooks/api/use-vehicles";

/**
 * Liste à cocher des véhicules d'un client.
 * Un véhicule déjà affecté à une souscription est grisé (une seule affectation active).
 */
export function VehiclePicker({
  organizationId,
  value,
  onChange,
}: {
  organizationId: string | undefined;
  value: string[];
  onChange: (vehicleIds: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  // 100 = plafond de pagination de l'API réelle (au-delà, la requête est refusée).
  const vehicles = useVehicles({ organizationId, perPage: 100 }, { enabled: Boolean(organizationId) });
  const availability = useVehicleAvailability(Boolean(organizationId));

  if (!organizationId) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">Choisissez d'abord le client.</p>
    );
  }
  if (vehicles.isPending || availability.isPending) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  if (vehicles.isError) {
    return (
      <div className="rounded-lg border p-3">
        <ErrorState error={vehicles.error} onRetry={() => vehicles.refetch()} title="Véhicules indisponibles" />
      </div>
    );
  }

  const taken = availability.data ?? {};
  const term = search.trim().toLowerCase();
  const rows = (vehicles.data?.data ?? []).filter(
    (v) => !term || v.registration.toLowerCase().includes(term) || (v.label ?? "").toLowerCase().includes(term),
  );
  const selected = new Set(value);
  const freeCount = (vehicles.data?.data ?? []).filter((v) => !taken[v.id]).length;

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange([...next]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InputGroup className="sm:max-w-xs">
          <InputGroupInput
            placeholder="Filtrer par immatriculation…"
            aria-label="Filtrer les véhicules"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <span className="text-muted-foreground text-xs">
          {selected.size} sélectionné(s) · {freeCount} disponible(s)
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-muted-foreground text-sm">Aucun véhicule pour ce client.</p>
      ) : (
        <ScrollArea className="max-h-56">
          <div className="flex flex-col gap-1 pr-3">
            {rows.map((v) => {
              const busy = taken[v.id];
              return (
                <Field key={v.id} orientation="horizontal" className="items-center gap-2 rounded-md px-1 py-1">
                  <Checkbox
                    id={`pick-${v.id}`}
                    checked={selected.has(v.id)}
                    disabled={Boolean(busy)}
                    onCheckedChange={(c) => toggle(v.id, c === true)}
                  />
                  <FieldLabel
                    htmlFor={`pick-${v.id}`}
                    className="flex flex-1 flex-wrap items-baseline gap-x-2 font-normal"
                  >
                    <span className="font-medium">{v.registration}</span>
                    {v.label ? <span className="text-muted-foreground text-xs">{v.label}</span> : null}
                    {busy ? (
                      <span className="ml-auto text-muted-foreground text-xs">
                        Déjà sur {busy.reference} ({busy.offerName})
                      </span>
                    ) : null}
                  </FieldLabel>
                </Field>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
