"use client";

import { useState } from "react";

import { Circle, Hexagon, MapPinned, Pencil, Plus, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import {
  OrganizationFilter,
  OrganizationSelect,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGeofences, useSaveGeofence, useToggleClientRule } from "@/hooks/api/use-client-rules";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { getErrorMessage } from "@/lib/axios";
import type { Geofence, GeofencePayload, GeofenceShape } from "@/types/client-rules";

import { ZonesMap } from "./zones-map";

const COLORS = [
  ["#2563eb", "Bleu"],
  ["#16a34a", "Vert"],
  ["#dc2626", "Rouge"],
  ["#d97706", "Orange"],
  ["#7c3aed", "Violet"],
];

const emptyDraft = (organizationId: string): GeofencePayload => ({
  organizationId,
  name: "",
  description: null,
  shape: "circle",
  center: null,
  radiusM: 300,
  points: [],
  kind: "authorized",
  alertOnEntry: false,
  alertOnExit: true,
  vehicleIds: [],
  color: "#2563eb",
  active: true,
});

/**
 * Zones géographiques (rubrique client). Même écran pour la plateforme Client et la fiche client
 * du SuperAdmin : `organizationId` fixe le client et masque le filtre.
 */
export function Zones({ organizationId: scoped }: { organizationId?: string } = {}) {
  const [filterOrg, setFilterOrg] = useState<string | undefined>();
  const organizationId = scoped ?? filterOrg;
  const zones = useGeofences(organizationId);
  const save = useSaveGeofence();
  const toggle = useToggleClientRule();
  const [draft, setDraft] = useState<{ payload: GeofencePayload; id?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const vehicles = useVehicles(
    { organizationId: draft?.payload.organizationId ? draft.payload.organizationId : undefined, perPage: 100 },
    { enabled: Boolean(draft?.payload.organizationId) },
  );

  const rows = zones.data ?? [];
  const p = draft?.payload;
  const set = <K extends keyof GeofencePayload>(k: K, v: GeofencePayload[K]) =>
    setDraft((d) => (d ? { ...d, payload: { ...d.payload, [k]: v } } : d));

  function edit(z: Geofence) {
    const { id, organization: _o, updatedAt: _u, ...payload } = z;
    setDraft({ payload, id });
    setSelectedId(id);
  }

  function submit() {
    if (!draft) return;
    save.mutate(
      { payload: draft.payload, id: draft.id },
      {
        onSuccess: (z) => {
          toast.success(draft.id ? "Zone modifiée" : "Zone créée", { description: z.name });
          setDraft(null);
          setSelectedId(z.id);
        },
        onError: (e) => toast.error("Enregistrement impossible", { description: getErrorMessage(e) }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {scoped ? null : (
        <PageHeader
          title="Zones géographiques"
          description="Zones autorisées ou interdites, en cercle ou en polygone, avec alerte à l'entrée et/ou à la sortie."
          actions={
            <>
              <OrganizationFilter value={filterOrg} onChange={setFilterOrg} />
              <Button onClick={() => setDraft({ payload: emptyDraft(organizationId ?? "") })}>
                <Plus data-icon="inline-start" />
                Nouvelle zone
              </Button>
            </>
          }
        />
      )}
      {scoped ? (
        <div className="flex justify-end">
          <Button onClick={() => setDraft({ payload: emptyDraft(scoped) })}>
            <Plus data-icon="inline-start" />
            Nouvelle zone
          </Button>
        </div>
      ) : null}
      <Alert>
        <MapPinned />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          Zones simulées ; la détection d'entrée / sortie sera faite par le moteur de règles côté serveur.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="overflow-hidden p-0">
          <div className="h-[480px] xl:h-[620px]">
            <ZonesMap
              zones={rows}
              draft={
                p
                  ? {
                      id: "draft",
                      name: p.name || "Nouvelle zone",
                      shape: p.shape,
                      center: p.center,
                      radiusM: p.radiusM,
                      points: p.points,
                      color: p.color,
                      active: true,
                    }
                  : null
              }
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              onPick={(pt) => {
                if (!draft) return;
                if (draft.payload.shape === "circle") set("center", pt);
                else set("points", [...draft.payload.points, pt]);
              }}
            />
          </div>
        </Card>

        {draft && p ? (
          <Card>
            <CardHeader>
              <CardTitle>{draft.id ? "Modifier la zone" : "Nouvelle zone"}</CardTitle>
              <CardDescription>
                {p.shape === "circle"
                  ? "Cliquez sur la carte pour placer le centre."
                  : "Cliquez les sommets du polygone sur la carte."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-4">
                {scoped ? null : (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="gf-org">Client</FieldLabel>
                    <OrganizationSelect
                      id="gf-org"
                      className="w-full"
                      value={p.organizationId || undefined}
                      onChange={(id) => set("organizationId", id ?? "")}
                    />
                  </Field>
                )}
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gf-name">Nom</FieldLabel>
                  <Input id="gf-name" value={p.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel>Forme</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={p.shape}
                    onValueChange={(v) =>
                      v &&
                      setDraft((d) =>
                        d
                          ? { ...d, payload: { ...d.payload, shape: v as GeofenceShape, center: null, points: [] } }
                          : d,
                      )
                    }
                  >
                    <ToggleGroupItem value="circle">
                      <Circle /> Cercle
                    </ToggleGroupItem>
                    <ToggleGroupItem value="polygon">
                      <Hexagon /> Polygone
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                {p.shape === "circle" ? (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="gf-radius">Rayon (mètres)</FieldLabel>
                    <Input
                      id="gf-radius"
                      type="number"
                      min={50}
                      value={p.radiusM ?? 0}
                      onChange={(e) => set("radiusM", Number(e.target.value) || 0)}
                    />
                    <FieldDescription>
                      {p.center ? `Centre : ${p.center.lat}, ${p.center.lng}` : "Centre non placé."}
                    </FieldDescription>
                  </Field>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.points.length} sommet(s)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={p.points.length === 0}
                      onClick={() => set("points", p.points.slice(0, -1))}
                    >
                      <Undo2 data-icon="inline-start" />
                      Retirer le dernier
                    </Button>
                  </div>
                )}
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gf-kind">Type de zone</FieldLabel>
                  <Select
                    value={p.kind}
                    onValueChange={(v) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              payload: {
                                ...d.payload,
                                kind: v as GeofencePayload["kind"],
                                alertOnEntry: v === "forbidden",
                                alertOnExit: v === "authorized",
                                color: v === "forbidden" ? "#dc2626" : d.payload.color,
                              },
                            }
                          : d,
                      )
                    }
                  >
                    <SelectTrigger id="gf-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="authorized">Zone autorisée</SelectItem>
                        <SelectItem value="forbidden">Zone interdite</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex flex-wrap gap-4">
                  <Field orientation="horizontal" className="w-auto">
                    <Checkbox
                      id="gf-in"
                      checked={p.alertOnEntry}
                      onCheckedChange={(v) => set("alertOnEntry", v === true)}
                    />
                    <FieldLabel htmlFor="gf-in" className="font-normal">
                      Alerte à l'entrée
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-auto">
                    <Checkbox
                      id="gf-out"
                      checked={p.alertOnExit}
                      onCheckedChange={(v) => set("alertOnExit", v === true)}
                    />
                    <FieldLabel htmlFor="gf-out" className="font-normal">
                      Alerte à la sortie
                    </FieldLabel>
                  </Field>
                </div>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="gf-vehicles">Véhicules surveillés</FieldLabel>
                  <Select
                    value=""
                    onValueChange={(v) => !p.vehicleIds.includes(v) && set("vehicleIds", [...p.vehicleIds, v])}
                    disabled={!p.organizationId}
                  >
                    <SelectTrigger id="gf-vehicles" className="w-full">
                      <SelectValue
                        placeholder={
                          p.vehicleIds.length ? `${p.vehicleIds.length} véhicule(s)` : "Tous les véhicules du client"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-64">
                      <SelectGroup>
                        {(vehicles.data?.data ?? []).map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.registration}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {p.vehicleIds.length ? (
                    <Button variant="link" size="sm" className="h-auto w-fit p-0" onClick={() => set("vehicleIds", [])}>
                      Revenir à « tous les véhicules »
                    </Button>
                  ) : null}
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel>Couleur</FieldLabel>
                  <div className="flex gap-2">
                    {COLORS.map(([c, l]) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={l}
                        aria-pressed={p.color === c}
                        onClick={() => set("color", c)}
                        className="size-7 rounded-full border-2 aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </Field>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDraft(null)}>
                    <X data-icon="inline-start" />
                    Annuler
                  </Button>
                  <Button disabled={save.isPending} onClick={submit}>
                    {save.isPending ? <Spinner data-icon="inline-start" /> : null}
                    Enregistrer
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Zones ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {zones.isPending ? (
                <LoadingRows rows={4} />
              ) : zones.isError ? (
                <div className="px-4">
                  <ErrorState error={zones.error} onRetry={() => zones.refetch()} />
                </div>
              ) : rows.length === 0 ? (
                <div className="px-4">
                  <EmptyState
                    icon={<MapPinned />}
                    title="Aucune zone"
                    description="Créez une zone puis dessinez-la sur la carte."
                  />
                </div>
              ) : (
                <ul className="flex flex-col divide-y">
                  {rows.map((z) => (
                    <li
                      key={z.id}
                      className={`flex items-center gap-3 px-4 py-2.5 ${selectedId === z.id ? "bg-muted/50" : ""}`}
                    >
                      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: z.color }} />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(z.id)}>
                        <p className="truncate font-medium text-sm">{z.name}</p>
                        <p className="truncate text-muted-foreground text-xs">
                          {z.kind === "forbidden" ? "Interdite" : "Autorisée"} ·{" "}
                          {z.shape === "circle" ? `cercle ${z.radiusM} m` : `polygone ${z.points.length} pts`}
                          {scoped ? "" : ` · ${z.organization.name}`}
                        </p>
                      </button>
                      {z.active ? null : <StatusBadge tone="neutral">Inactive</StatusBadge>}
                      <Switch
                        checked={z.active}
                        aria-label={z.active ? "Désactiver la zone" : "Activer la zone"}
                        onCheckedChange={(active) => toggle.mutate({ kind: "geofence", id: z.id, active })}
                      />
                      <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${z.name}`} onClick={() => edit(z)}>
                        <Pencil />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
