"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Paperclip, Save, Search, X } from "lucide-react";
import { toast } from "sonner";

import { PersonSelect } from "@/app/(main)/dashboard/_components/alerting/person-select";
import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import {
  eventTypeLabels,
  incidentCategoryLabels,
  incidentEventLabels,
  incidentSourceLabels,
  incidentTypeLabels,
  severityMeta,
} from "@/components/alerting-labels";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAlert, useAlerts } from "@/hooks/api/use-alerting";
import { useDrivers } from "@/hooks/api/use-drivers";
import { useCreateIncident } from "@/hooks/api/use-incidents";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime } from "@/lib/format";
import { type GeoLocation, type PersonRef, SEVERITIES, type Severity } from "@/types/alerting";
import type { Attachment } from "@/types/billing";
import type { PlaceSearchResult } from "@/types/geocoding";
import {
  INCIDENT_EVENT_CATEGORIES,
  INCIDENT_EVENTS_BY_CATEGORY,
  INCIDENT_SOURCES,
  INCIDENT_TYPES,
  INCIDENT_CLASSIFICATION_BY_ALERT_EVENT,
  type IncidentEvent,
  type IncidentEventCategory,
  type IncidentSource,
  type IncidentType,
} from "@/types/incident";

const NONE = "__none__";

function localNow(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function isPlaceSearchResult(value: unknown): value is PlaceSearchResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string" &&
    "lat" in value &&
    typeof value.lat === "number" &&
    Number.isFinite(value.lat) &&
    "lng" in value &&
    typeof value.lng === "number" &&
    Number.isFinite(value.lng)
  );
}

function getPlaceSearchError(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return "La recherche n’a pas pu aboutir. Réessayez.";
}

/** Écran 3 — création d'un incident (§V.2), prérempli depuis une alerte (`?alertId=`). */
export function IncidentForm({ alertId }: { alertId?: string }) {
  const router = useRouter();
  const source = useAlert(alertId);
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [vehicleId, setVehicleId] = useState(NONE);
  const [driverId, setDriverId] = useState(NONE);
  const [eventCategory, setEventCategory] = useState<IncidentEventCategory | "">("");
  const [event, setEvent] = useState<IncidentEvent | "">("");
  const [incidentType, setIncidentType] = useState<IncidentType | "">("");
  const [priority, setPriority] = useState<Severity>("medium");
  const [occurredAt, setOccurredAt] = useState(localNow());
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState<IncidentSource>("manual");
  const [alertIds, setAlertIds] = useState<string[]>([]);
  const [address, setAddress] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);
  const [placeSearchPending, setPlaceSearchPending] = useState(false);
  const [placeSearchResults, setPlaceSearchResults] = useState<PlaceSearchResult[]>([]);
  const placeSearchRequest = useRef(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [owner, setOwner] = useState<{ assignee: PersonRef | null; queue: string | null }>({
    assignee: null,
    queue: "Support niveau 1",
  });
  const create = useCreateIncident();

  const vehicles = useVehicles({ organizationId, perPage: 100 }, { enabled: Boolean(organizationId) });
  const drivers = useDrivers({ perPage: 100 }, { enabled: Boolean(organizationId) });
  const orgDrivers = (drivers.data?.data ?? []).filter((d) => d.organizationId === organizationId);
  const openAlerts = useAlerts({ organizationId, perPage: 50 }, { enabled: Boolean(organizationId) });
  const availableEvents = eventCategory ? INCIDENT_EVENTS_BY_CATEGORY[eventCategory] : [];

  // Préremplissage depuis l'alerte d'origine.
  useEffect(() => {
    const a = source.data;
    if (!a) return;
    setOrganizationId(a.organizationId);
    setVehicleId(a.vehicleId ?? NONE);
    setPriority(a.severity);
    setOrigin(a.source === "rule_engine" ? "rule_engine" : "gps_alert");
    setOccurredAt(
      new Date(new Date(a.occurredAt).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
    );
    setAlertIds([a.id]);
    setAddress(a.location?.address ?? "");
    setSelectedLocation(a.location ?? null);
    const classification = INCIDENT_CLASSIFICATION_BY_ALERT_EVENT[a.eventType];
    setEventCategory(classification.eventCategory);
    setEvent(classification.event);
    setIncidentType(classification.incidentType);
    setDescription(
      `${eventTypeLabels[a.eventType]} sur ${a.vehicle?.registration ?? "le véhicule"} (alerte ${a.reference}).`,
    );
  }, [source.data]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = [...files].map((f) => ({ name: f.name, sizeKb: Math.ceil(f.size / 1024), type: f.type || "fichier" }));
    setAttachments((a) => [...a, ...next]);
  }

  async function searchLocation() {
    const query = address.trim();
    if (query.length < 2 || placeSearchPending) return;

    const requestId = ++placeSearchRequest.current;
    setPlaceSearchPending(true);
    setPlaceSearchResults([]);

    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getPlaceSearchError(payload));
      if (!Array.isArray(payload)) throw new Error("La réponse du service de recherche est invalide.");
      if (requestId !== placeSearchRequest.current) return;

      const results = payload.filter(isPlaceSearchResult);
      if (results.length !== payload.length) throw new Error("La réponse du service de recherche est invalide.");
      if (results.length === 0) {
        toast.error("Aucun lieu trouvé", { description: "Essayez une recherche plus précise." });
        return;
      }

      setPlaceSearchResults(results);
    } catch (error) {
      if (requestId !== placeSearchRequest.current) return;
      toast.error("Recherche de lieu impossible", {
        description: error instanceof Error ? error.message : "Vérifiez votre connexion puis réessayez.",
      });
    } finally {
      if (requestId === placeSearchRequest.current) setPlaceSearchPending(false);
    }
  }

  function selectLocation(result: PlaceSearchResult) {
    placeSearchRequest.current += 1;
    setAddress(result.displayName);
    setSelectedLocation({ lat: result.lat, lng: result.lng, address: result.displayName });
    setPlaceSearchResults([]);
  }

  function submit() {
    if (!organizationId) {
      toast.error("Choisissez le client");
      return;
    }
    if (!eventCategory) {
      toast.error("Choisissez la catégorie d'événement");
      return;
    }
    if (!event) {
      toast.error("Choisissez l'événement");
      return;
    }
    if (!incidentType) {
      toast.error("Choisissez le type d'incident");
      return;
    }
    const occurredDate = new Date(occurredAt);
    if (!occurredAt || !Number.isFinite(occurredDate.getTime())) {
      toast.error("Date invalide", { description: "Renseignez une date et une heure valides." });
      return;
    }
    if (address.trim() && !selectedLocation) {
      toast.error("Localisation non validée", {
        description: "Recherchez l’adresse puis sélectionnez un résultat pour enregistrer ses coordonnées.",
      });
      return;
    }
    const driver = orgDrivers.find((d) => d.id === driverId);
    create.mutate(
      {
        organizationId,
        vehicleId: vehicleId === NONE ? null : vehicleId,
        driver: driver ? { id: driver.id, name: driver.fullName } : null,
        eventCategory,
        event,
        incidentType,
        priority,
        occurredAt: occurredDate.toISOString(),
        description,
        source: origin,
        alertIds,
        location: selectedLocation
          ? { ...selectedLocation, address: address.trim() || selectedLocation.address }
          : null,
        attachments,
        assignee: owner.assignee,
        queue: owner.queue,
      },
      {
        onSuccess: (inc) => {
          toast.success("Incident créé", { description: inc.reference });
          router.push(`/dashboard/incidents/${inc.id}`);
        },
        onError: (e) => toast.error("Création impossible", { description: getErrorMessage(e) }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Nouvel incident"
        description={
          source.data
            ? `Prérempli depuis l'alerte ${source.data.reference}.`
            : "Choisissez une catégorie, un événement et un type d'incident."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/incidents" prefetch={false}>
                <ArrowLeft data-icon="inline-start" />
                Retour
              </Link>
            </Button>
            <Button disabled={create.isPending} onClick={submit}>
              {create.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              Créer l'incident
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-event-category">Catégorie d'événement</FieldLabel>
                <Select
                  value={eventCategory || NONE}
                  onValueChange={(v) => {
                    setEventCategory(v === NONE ? "" : (v as IncidentEventCategory));
                    setEvent("");
                    setIncidentType("");
                  }}
                >
                  <SelectTrigger id="inc-event-category" className="w-full">
                    <SelectValue placeholder="Choisir une catégorie" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value={NONE}>Choisir une catégorie</SelectItem>
                      {INCIDENT_EVENT_CATEGORIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {incidentCategoryLabels[item]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-event">Événement</FieldLabel>
                <Select
                  value={event || NONE}
                  onValueChange={(v) => {
                    setEvent(v === NONE ? "" : (v as IncidentEvent));
                    setIncidentType("");
                  }}
                  disabled={!eventCategory}
                >
                  <SelectTrigger id="inc-event" className="w-full">
                    <SelectValue placeholder="Choisir un événement" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    <SelectGroup>
                      <SelectItem value={NONE}>Choisir un événement</SelectItem>
                      {availableEvents.map((item) => (
                        <SelectItem key={item} value={item}>
                          {incidentEventLabels[item]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>Les événements proposés dépendent de la catégorie choisie.</FieldDescription>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-type">Type d'incident</FieldLabel>
                <Select
                  value={incidentType || NONE}
                  onValueChange={(v) => setIncidentType(v === NONE ? "" : (v as IncidentType))}
                  disabled={!event}
                >
                  <SelectTrigger id="inc-type" className="w-full">
                    <SelectValue placeholder="Choisir un type d'incident" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value={NONE}>Choisir un type d'incident</SelectItem>
                      {INCIDENT_TYPES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {incidentTypeLabels[item]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-client">Client</FieldLabel>
                <OrganizationSelect
                  id="inc-client"
                  className="w-full"
                  value={organizationId}
                  onChange={(id) => {
                    placeSearchRequest.current += 1;
                    setPlaceSearchPending(false);
                    setOrganizationId(id);
                    setVehicleId(NONE);
                    setDriverId(NONE);
                    setAlertIds([]);
                    setAddress("");
                    setSelectedLocation(null);
                    setPlaceSearchResults([]);
                    if (source.data && id !== source.data.organizationId) {
                      setEventCategory("");
                      setEvent("");
                      setIncidentType("");
                      setOrigin("manual");
                      setDescription("");
                    }
                  }}
                />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-vehicle">Véhicule</FieldLabel>
                <Select value={vehicleId} onValueChange={setVehicleId} disabled={!organizationId}>
                  <SelectTrigger id="inc-vehicle" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    <SelectGroup>
                      <SelectItem value={NONE}>Aucun véhicule</SelectItem>
                      {(vehicles.data?.data ?? []).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registration}
                          {v.label ? ` — ${v.label}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-driver">Conducteur éventuel</FieldLabel>
                <Select value={driverId} onValueChange={setDriverId} disabled={!organizationId}>
                  <SelectTrigger id="inc-driver" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    <SelectGroup>
                      <SelectItem value={NONE}>Non renseigné</SelectItem>
                      {orgDrivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.fullName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-date">Date de l'incident</FieldLabel>
                <Input
                  id="inc-date"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-priority">Priorité</FieldLabel>
                <Select value={priority} onValueChange={(v) => setPriority(v as Severity)}>
                  <SelectTrigger id="inc-priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {severityMeta[s].label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-source">Source de l'incident</FieldLabel>
                <Select value={origin} onValueChange={(v) => setOrigin(v as IncidentSource)}>
                  <SelectTrigger id="inc-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {INCIDENT_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {incidentSourceLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-location">Localisation</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="inc-location"
                    value={address}
                    onChange={(e) => {
                      placeSearchRequest.current += 1;
                      setPlaceSearchPending(false);
                      setAddress(e.target.value);
                      setSelectedLocation(null);
                      setPlaceSearchResults([]);
                    }}
                    placeholder="Adresse ou lieu"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={placeSearchPending || address.trim().length < 2}
                    onClick={() => void searchLocation()}
                  >
                    {placeSearchPending ? <Spinner data-icon="inline-start" /> : <Search data-icon="inline-start" />}
                    {placeSearchPending ? "Recherche…" : "Rechercher"}
                  </Button>
                </div>
                {placeSearchResults.length > 0 ? (
                  <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {placeSearchResults.map((result) => (
                      <li key={result.id}>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto w-full flex-col items-start gap-1 whitespace-normal px-2 py-2 text-left"
                          onClick={() => selectLocation(result)}
                        >
                          <span className="w-full truncate font-medium">{result.name}</span>
                          <span className="w-full truncate text-muted-foreground text-xs">{result.displayName}</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <FieldDescription>
                  {selectedLocation ? (
                    `Position sélectionnée : ${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}.`
                  ) : address.trim() ? (
                    "Sélectionnez un résultat de recherche pour enregistrer une position précise."
                  ) : (
                    "Saisissez une adresse puis recherchez un lieu."
                  )}
                  {" "}Résultats fournis par{" "}
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                    OpenStreetMap
                  </a>
                  .
                </FieldDescription>
              </Field>
              <Field className="gap-1.5 sm:col-span-2">
                <FieldLabel htmlFor="inc-description">Description</FieldLabel>
                <Textarea
                  id="inc-description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Affectation</CardTitle>
            </CardHeader>
            <CardContent>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="inc-owner">Responsable ou file</FieldLabel>
                <PersonSelect id="inc-owner" allowQueues value={owner} onChange={setOwner} />
                <FieldDescription>Obligatoire : un responsable nominatif ou une file d'affectation.</FieldDescription>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertes associées ({alertIds.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {!organizationId ? (
                <p className="text-muted-foreground text-sm">Choisissez d'abord le client.</p>
              ) : (openAlerts.data?.data ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucune alerte pour ce client.</p>
              ) : (
                (openAlerts.data?.data ?? []).map((a) => (
                  <Field key={a.id} orientation="horizontal" className="items-start">
                    <Checkbox
                      id={`inc-alert-${a.id}`}
                      checked={alertIds.includes(a.id)}
                      onCheckedChange={(v) =>
                        setAlertIds((ids) => (v === true ? [...ids, a.id] : ids.filter((x) => x !== a.id)))
                      }
                    />
                    <FieldLabel htmlFor={`inc-alert-${a.id}`} className="flex flex-col items-start gap-0 font-normal">
                      <span>
                        {eventTypeLabels[a.eventType]} ·{" "}
                        <span className="font-mono text-xs">{a.vehicle?.registration}</span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {a.reference} · {formatDateTime(a.occurredAt)}
                      </span>
                    </FieldLabel>
                  </Field>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pièces jointes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Input type="file" multiple accept="image/*,.pdf" onChange={(e) => addFiles(e.target.files)} />
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((f, i) => (
                  <Badge key={`${f.name}-${i}`} variant="secondary" className="gap-1">
                    <Paperclip className="size-3" />
                    {f.name}
                    <button
                      type="button"
                      aria-label={`Retirer ${f.name}`}
                      onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <FieldDescription>Photos, constat, rapport… (fichiers non envoyés en démonstration).</FieldDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
