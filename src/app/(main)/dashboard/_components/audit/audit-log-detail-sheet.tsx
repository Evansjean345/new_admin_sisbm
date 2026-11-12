"use client";

import type { ReactNode } from "react";

import { ArrowRight, Building2, CalendarClock, ChevronDown, Globe, Info, PencilLine, UserRound } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useOrganizationLabel } from "@/hooks/api/use-organizations";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { AuditLogEntry } from "@/types/audit";

import { auditActionTone, auditResourceLabel } from "./audit-labels";
import {
  actorDisplay,
  actorTypeLabel,
  auditChanges,
  auditContext,
  auditEventTitle,
  auditSentence,
  auditSubjectName,
} from "./audit-readable";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Facts({ items }: { items: Array<{ label: string; value: ReactNode; hidden?: boolean }> }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 rounded-lg border p-3 text-sm">
      {items
        .filter((i) => !i.hidden)
        .map((i, index) => (
          <div key={`${i.label}-${index}`} className="contents">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd className="min-w-0 break-words">{i.value}</dd>
          </div>
        ))}
    </dl>
  );
}

function TechnicalJson({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{title}</span>
      <pre className="max-h-60 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Détail d'un événement d'audit, lisible par tous (retour du 12/11/2026) :
 * une phrase de résumé, puis Qui / Quoi / Ce qui a changé, en français et sans code.
 * Les données brutes restent consultables dans « Détails techniques » (support, SOC).
 */
export function AuditLogDetailSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const organization = useOrganizationLabel(entry?.organizationId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        {entry ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={auditActionTone(entry.action)}>{auditEventTitle(entry)}</StatusBadge>
              </SheetTitle>
              <SheetDescription>
                Le {formatDateTime(entry.occurredAt)} ({formatRelative(entry.occurredAt)})
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-5 px-4 pb-6">
                <p className="rounded-lg border-primary border-l-4 bg-muted/40 p-3 text-sm leading-relaxed">
                  {auditSentence(entry)}
                </p>

                <Section icon={<UserRound className="size-3.5" />} title="Qui ?">
                  <Facts
                    items={[
                      { label: "Auteur", value: actorDisplay(entry) },
                      { label: "E-mail", value: entry.actorEmail, hidden: !entry.actorEmail },
                      { label: "Type", value: actorTypeLabel(entry.actorType) },
                      {
                        label: "Connecté depuis",
                        value: (
                          <span className="flex items-center gap-1.5">
                            <Globe className="size-3.5 text-muted-foreground" />
                            Adresse IP {entry.actorIp}
                          </span>
                        ),
                        hidden: !entry.actorIp,
                      },
                    ]}
                  />
                </Section>

                <Section icon={<Info className="size-3.5" />} title="Sur quoi ?">
                  <Facts
                    items={[
                      { label: "Type d'élément", value: capitalize(auditResourceLabel(entry.resourceType)) },
                      { label: "Élément", value: auditSubjectName(entry) ?? "—" },
                      {
                        label: "Organisation",
                        value: (
                          <span className="flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-muted-foreground" />
                            {organization?.name ?? "Organisation non renseignée"}
                          </span>
                        ),
                        hidden: !entry.organizationId,
                      },
                      {
                        label: "Date et heure",
                        value: (
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="size-3.5 text-muted-foreground" />
                            {formatDateTime(entry.occurredAt)}
                          </span>
                        ),
                      },
                    ]}
                  />
                </Section>

                <ChangesSection entry={entry} />
                <ContextSection entry={entry} />

                <Collapsible className="rounded-lg border">
                  <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-muted-foreground text-sm hover:text-foreground">
                    Détails techniques (support, SOC)
                    <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-3 border-t p-3">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11px]">
                      <dt className="text-muted-foreground">N° d'événement</dt>
                      <dd className="break-all">{entry.id}</dd>
                      <dt className="text-muted-foreground">Code d'action</dt>
                      <dd className="break-all">{entry.action}</dd>
                      <dt className="text-muted-foreground">Ressource</dt>
                      <dd className="break-all">
                        {entry.resourceType} {entry.resourceId ?? ""}
                      </dd>
                      <dt className="text-muted-foreground">Organisation</dt>
                      <dd className="break-all">{entry.organizationId ?? "—"}</dd>
                      <dt className="text-muted-foreground">Auteur</dt>
                      <dd className="break-all">{entry.actorId ?? "—"}</dd>
                      <dt className="text-muted-foreground">Horodatage</dt>
                      <dd className="break-all">{entry.occurredAt}</dd>
                    </dl>
                    <TechnicalJson title="Avant (brut)" value={entry.before} />
                    <TechnicalJson title="Après (brut)" value={entry.after} />
                    <TechnicalJson title="Métadonnées (brut)" value={entry.metadata} />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const kindMeta = {
  added: { label: "Ajouté", tone: "success" },
  removed: { label: "Retiré", tone: "danger" },
  changed: { label: "Modifié", tone: "info" },
  unchanged: { label: "Inchangé", tone: "neutral" },
} as const;

function ChangesSection({ entry }: { entry: AuditLogEntry }) {
  const { changes, unchanged } = auditChanges(entry);
  const creation = entry.before === null && entry.after !== null;
  const deletion = entry.after === null && entry.before !== null;
  let title = "Ce qui a changé";
  if (creation) title = "Informations enregistrées";
  if (deletion) title = "Informations supprimées";

  return (
    <Section icon={<PencilLine className="size-3.5" />} title={title}>
      {changes.length === 0 ? (
        <p className="rounded-lg border p-3 text-muted-foreground text-sm">
          {entry.before === null && entry.after === null
            ? "Cette action ne modifie aucune donnée (consultation, connexion, commande…)."
            : "Aucun changement visible sur les informations de l'élément."}
        </p>
      ) : creation || deletion ? (
        <Facts
          items={changes.map((c) => ({
            label: c.label,
            value: (deletion ? c.before : c.after) ?? "—",
          }))}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Information</th>
                <th className="px-3 py-2 text-left font-medium">Avant</th>
                <th className="w-4" aria-hidden />
                <th className="px-3 py-2 text-left font-medium">Après</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {changes.map((c) => (
                <tr key={c.key} className="align-top">
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-medium">{c.label}</span>
                      {c.kind !== "changed" ? (
                        <StatusBadge tone={kindMeta[c.kind].tone}>{kindMeta[c.kind].label}</StatusBadge>
                      ) : null}
                    </div>
                  </td>
                  <td className="break-words px-3 py-2 text-muted-foreground line-through decoration-muted-foreground/40">
                    {c.before ?? "—"}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    <ArrowRight className="size-3.5" />
                  </td>
                  <td className="break-words px-3 py-2 font-medium">{c.after ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {unchanged > 0 && !creation && !deletion ? (
        <p className="text-muted-foreground text-xs">
          {unchanged} autre{unchanged > 1 ? "s" : ""} information{unchanged > 1 ? "s" : ""} inchangée
          {unchanged > 1 ? "s" : ""}.
        </p>
      ) : null}
    </Section>
  );
}

function ContextSection({ entry }: { entry: AuditLogEntry }) {
  const context = auditContext(entry);
  if (context.length === 0) return null;
  return (
    <Section icon={<Info className="size-3.5" />} title="Informations complémentaires">
      <Facts items={context.map((c) => ({ label: c.label, value: c.value }))} />
    </Section>
  );
}
