"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Paperclip, Save, X } from "lucide-react";
import { toast } from "sonner";

import { PersonSelect } from "@/app/(main)/dashboard/_components/alerting/person-select";
import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import {
  eventTypeLabels,
  incidentCategoryLabels,
  incidentSourceLabels,
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
import { type PersonRef, SEVERITIES, type Severity } from "@/types/alerting";
import type { Attachment } from "@/types/billing";
import { INCIDENT_CATEGORIES, INCIDENT_SOURCES, type IncidentCategory, type IncidentSource } from "@/types/incident";

const NONE = "__none__";

function localNow(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Écran 3 — création d'un incident (§V.2), prérempli depuis une alerte (`?alertId=`). */
export function IncidentForm({ alertId }: { alertId?: string }) {
  const router = useRouter();
  const source = useAlert(alertId);
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [vehicleId, setVehicleId] = useState(NONE);
  const [driverId, setDriverId] = useState(NONE);
  const [category, setCategory] = useState<IncidentCategory>("other");
  const [priority, setPriority] = useState<Severity>("medium");
  const [occurredAt, setOccurredAt] = useState(localNow());
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState<IncidentSource>("manual");
  const [alertIds, setAlertIds] = useState<string[]>([]);
  const [address, setAddress] = useState("");
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
    setDescription(
      `${eventTypeLabels[a.eventType]} sur ${a.vehicle?.registration ?? "le véhicule"} (alerte ${a.reference}).`,
    );
    const map: Partial<Record<typeof a.eventType, IncidentCategory>> = {
      sos: "sos",
      towing: "theft",
      jamming: "theft",
      tamper: "tamper",
      power_cut: "tamper",
      disconnection: "connectivity",
      overspeed: "speeding",
      schedule_violation: "unauthorized_use",
    };
    setCategory(map[a.eventType] ?? "other");
  }, [source.data]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = [...files].map((f) => ({ name: f.name, sizeKb: Math.ceil(f.size / 1024), type: f.type || "fichier" }));
    setAttachments((a) => [...a, ...next]);
  }

  function submit() {
    if (!organizationId) {
      toast.error("Choisissez le client");
      return;
    }
    const driver = orgDrivers.find((d) => d.id === driverId);
    const alertLocation = source.data?.location;
    create.mutate(
      {
        organizationId,
        vehicleId: vehicleId === NONE ? null : vehicleId,
        driver: driver ? { id: driver.id, name: driver.fullName } : null,
        category,
        priority,
        occurredAt: new Date(occurredAt).toISOString(),
        description,
        source: origin,
        alertIds,
        location: address ? { lat: alertLocation?.lat ?? 0, lng: alertLocation?.lng ?? 0, address } : null,
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
          source.data ? `Prérempli depuis l'alerte ${source.data.reference}.` : "Signalement ou création manuelle."
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
                <FieldLabel htmlFor="inc-client">Client</FieldLabel>
                <OrganizationSelect
                  id="inc-client"
                  className="w-full"
                  value={organizationId}
                  onChange={(id) => {
                    setOrganizationId(id);
                    setVehicleId(NONE);
                    setDriverId(NONE);
                    setAlertIds([]);
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
                <FieldLabel htmlFor="inc-category">Catégorie</FieldLabel>
                <Select value={category} onValueChange={(v) => setCategory(v as IncidentCategory)}>
                  <SelectTrigger id="inc-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {INCIDENT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {incidentCategoryLabels[c]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
                <Input
                  id="inc-location"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Adresse ou lieu"
                />
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
