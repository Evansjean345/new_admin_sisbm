"use client";

import { useEffect, useState } from "react";

import { Download, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { OrganizationSelect } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditActions } from "@/hooks/api/use-audit-logs";
import { useInvalidateSocHistory, usePushToSoc, useSaveSocDestination, useSocDestination } from "@/hooks/api/use-soc";
import { getErrorMessage } from "@/lib/axios";
import { formatAuditForSoc, SOC_FORMATS, type SocFormat, socFormatMeta } from "@/lib/soc-formats";
import { SOC_MAX_EVENTS, SOC_TRANSPORTS, type SocTransport, socService } from "@/services/soc.service";
import { AUDIT_MAX_WINDOW_DAYS } from "@/types/audit";

import { auditEventTitle } from "../../_components/audit/audit-readable";

const ALL = "__all__";
const DAY = 86_400_000;

const transportLabels: Record<SocTransport, string> = {
  https: "HTTPS (collecteur / webhook)",
  syslog_tls: "Syslog sur TLS",
};

/** `datetime-local` attend l'heure locale sans fuseau. */
function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function download(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Transfert des journaux vers le SOC (retour de la direction, 12/11/2026) : téléchargement au
 * format SIEM, ou envoi à la destination SOC configurée.
 */
export function SocTransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState("transfer");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [action, setAction] = useState(ALL);
  const [format, setFormat] = useState<SocFormat>("jsonl");
  const [downloading, setDownloading] = useState(false);

  const destination = useSocDestination();
  const save = useSaveSocDestination();
  const push = usePushToSoc();
  const invalidateHistory = useInvalidateSocHistory();
  const [dest, setDest] = useState({
    name: "",
    transport: "https" as SocTransport,
    endpoint: "",
    format: "jsonl" as SocFormat,
    autoForward: false,
  });

  const fromIso = from ? new Date(from).toISOString() : "";
  const toIso = to ? new Date(to).toISOString() : "";
  const actions = useAuditActions({ from: fromIso || undefined, to: toIso || undefined });

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setFrom(toLocalInput(new Date(now.getTime() - DAY)));
    setTo(toLocalInput(now));
    setOrganizationId(undefined);
    setAction(ALL);
    setTab("transfer");
  }, [open]);

  useEffect(() => {
    if (destination.data) {
      const { updatedAt: _ignored, ...rest } = destination.data;
      setDest(rest);
      setFormat(rest.format);
    }
  }, [destination.data]);

  let windowError: string | null = null;
  if (!fromIso || !toIso) windowError = "Période obligatoire.";
  else if (fromIso >= toIso) windowError = "Le début doit précéder la fin.";
  else if (Date.parse(toIso) - Date.parse(fromIso) > AUDIT_MAX_WINDOW_DAYS * DAY) {
    windowError = `${AUDIT_MAX_WINDOW_DAYS} jours maximum.`;
  }
  const params = {
    from: fromIso,
    to: toIso,
    organizationId,
    action: action === ALL ? undefined : action,
  };
  const busy = downloading || push.isPending || save.isPending;

  async function onDownload() {
    setDownloading(true);
    try {
      const { entries, total, truncated } = await socService.collect(params);
      if (entries.length === 0) {
        toast.info("Aucun événement sur cette période");
        return;
      }
      const content = formatAuditForSoc(entries, format);
      const meta = socFormatMeta[format];
      download(content, `sisbm-audit-${fromIso.slice(0, 10)}_${toIso.slice(0, 10)}.${meta.extension}`, meta.mime);
      await socService.recordDownload({
        format,
        from: fromIso,
        to: toIso,
        count: entries.length,
        sizeKb: Math.ceil(new Blob([content]).size / 1024),
        status: truncated ? "truncated" : "success",
      });
      await invalidateHistory();
      toast.success(`${entries.length} événement(s) exporté(s)`, {
        description: truncated ? `Sur ${total} : limite de ${SOC_MAX_EVENTS} atteinte.` : meta.label,
      });
    } catch (error) {
      toast.error("Export impossible", { description: getErrorMessage(error) });
    } finally {
      setDownloading(false);
    }
  }

  function onPush() {
    push.mutate(params, {
      onSuccess: (t) =>
        toast.success(`${t.count} événement(s) transmis au SOC`, {
          description: t.detail ?? t.destination ?? undefined,
        }),
      onError: (error) => toast.error("Transfert impossible", { description: getErrorMessage(error) }),
    });
  }

  function onSaveDestination() {
    save.mutate(dest, {
      onSuccess: () => {
        toast.success("Destination SOC enregistrée");
        setTab("transfer");
      },
      onError: (error) => toast.error("Enregistrement impossible", { description: getErrorMessage(error) }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Transférer les journaux au SOC</DialogTitle>
          <DialogDescription>
            Événements du journal d'audit au format SIEM, pour la supervision de sécurité.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList>
            <TabsTrigger value="transfer">Transfert</TabsTrigger>
            <TabsTrigger value="destination">
              <Settings2 />
              Destination SOC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transfer">
            <FieldGroup className="gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5" data-invalid={Boolean(windowError)}>
                  <FieldLabel htmlFor="soc-from">Du</FieldLabel>
                  <Input id="soc-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field className="gap-1.5" data-invalid={Boolean(windowError)}>
                  <FieldLabel htmlFor="soc-to">Au</FieldLabel>
                  <Input id="soc-to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </div>
              {windowError ? <p className="text-destructive text-xs">{windowError}</p> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="soc-org">Organisation</FieldLabel>
                  <OrganizationSelect
                    id="soc-org"
                    className="w-full"
                    allowAll
                    value={organizationId}
                    onChange={setOrganizationId}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="soc-action">Action</FieldLabel>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger id="soc-action" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-72">
                      <SelectGroup>
                        <SelectItem value={ALL}>Toutes les actions</SelectItem>
                        {(actions.data?.data ?? []).map((a) => (
                          <SelectItem key={a} value={a}>
                            {auditEventTitle({ action: a, resourceType: "" })}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="soc-format">Format du fichier</FieldLabel>
                <Select value={format} onValueChange={(v) => setFormat(v as SocFormat)}>
                  <SelectTrigger id="soc-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {SOC_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {socFormatMeta[f].label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{socFormatMeta[format].hint}</FieldDescription>
              </Field>

              {destination.data ? (
                <Alert>
                  <Send />
                  <AlertTitle>Destination : {destination.data.name}</AlertTitle>
                  <AlertDescription>
                    {transportLabels[destination.data.transport]} · {destination.data.endpoint} ·{" "}
                    {socFormatMeta[destination.data.format].label}
                    {destination.data.autoForward ? " · envoi automatique activé" : ""}
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Aucune destination SOC : configurez-la dans l'onglet « Destination SOC » pour l'envoi direct.
                </p>
              )}
            </FieldGroup>
          </TabsContent>

          <TabsContent value="destination">
            <FieldGroup className="gap-4">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="soc-dest-name">Nom</FieldLabel>
                <Input
                  id="soc-dest-name"
                  value={dest.name}
                  placeholder="SOC SISBM"
                  onChange={(e) => setDest((d) => ({ ...d, name: e.target.value }))}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="soc-dest-transport">Transport</FieldLabel>
                  <Select
                    value={dest.transport}
                    onValueChange={(v) => setDest((d) => ({ ...d, transport: v as SocTransport }))}
                  >
                    <SelectTrigger id="soc-dest-transport" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {SOC_TRANSPORTS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {transportLabels[t]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="soc-dest-format">Format</FieldLabel>
                  <Select value={dest.format} onValueChange={(v) => setDest((d) => ({ ...d, format: v as SocFormat }))}>
                    <SelectTrigger id="soc-dest-format" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {SOC_FORMATS.filter((f) => f !== "csv").map((f) => (
                          <SelectItem key={f} value={f}>
                            {socFormatMeta[f].label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="soc-dest-endpoint">
                  {dest.transport === "https" ? "URL du collecteur" : "Hôte:port syslog"}
                </FieldLabel>
                <Input
                  id="soc-dest-endpoint"
                  value={dest.endpoint}
                  placeholder={
                    dest.transport === "https" ? "https://siem.exemple.ci/api/ingest" : "siem.exemple.ci:6514"
                  }
                  onChange={(e) => setDest((d) => ({ ...d, endpoint: e.target.value }))}
                />
                <FieldDescription>
                  Le jeton d'authentification du SIEM sera saisi côté serveur : il ne transite jamais par le navigateur.
                </FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="soc-dest-auto"
                  checked={dest.autoForward}
                  onCheckedChange={(v) => setDest((d) => ({ ...d, autoForward: v === true }))}
                />
                <FieldLabel htmlFor="soc-dest-auto" className="font-normal">
                  Envoi automatique continu de chaque nouvel événement (côté serveur)
                </FieldLabel>
              </Field>
            </FieldGroup>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {tab === "destination" ? (
            <Button disabled={busy} onClick={onSaveDestination}>
              {save.isPending ? <Spinner data-icon="inline-start" /> : null}
              Enregistrer la destination
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={busy || Boolean(windowError)} onClick={onDownload}>
                {downloading ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                Télécharger
              </Button>
              <Button disabled={busy || Boolean(windowError) || !destination.data} onClick={onPush}>
                {push.isPending ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                Envoyer au SOC
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
