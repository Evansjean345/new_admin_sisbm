"use client";

import { useMemo } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganizationsStats } from "@/hooks/api/use-admin";
import { formatDateTime } from "@/lib/format";
import type { AuditLogEntry } from "@/types/audit";

import { auditActionTone, auditResourceLabel } from "./audit-labels";
import {
  actorDisplay,
  actorTypeLabel,
  auditChangeSummary,
  auditEventTitle,
  auditModule,
  auditResult,
  auditSubjectName,
} from "./audit-readable";

/** Table du journal — purement présentationnelle : le panneau tient l'état. */
export function AuditLogTable({
  entries,
  onSelect,
  showOrganization = false,
}: {
  entries: AuditLogEntry[];
  onSelect: (entry: AuditLogEntry) => void;
  /** Vue inter-organisations (exploitant plateforme) : la colonne devient utile. */
  showOrganization?: boolean;
}) {
  // Noms d'organisation déjà en cache (sélecteurs) : jamais d'UUID à l'écran.
  const organizations = useOrganizationsStats();
  const orgNames = useMemo(() => new Map((organizations.data ?? []).map((o) => [o.id, o.name])), [organizations.data]);

  return (
    <div className="overflow-x-auto">
      <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Date</TableHead>
            <TableHead>Action</TableHead>
            <TableHead className="hidden 2xl:table-cell">Module</TableHead>
            <TableHead className="hidden lg:table-cell">Élément concerné</TableHead>
            <TableHead className="hidden md:table-cell">Auteur</TableHead>
            {showOrganization ? <TableHead className="hidden xl:table-cell">Organisation</TableHead> : null}
            <TableHead className="hidden xl:table-cell">Adresse IP</TableHead>
            <TableHead className="hidden lg:table-cell">Ancienne → nouvelle valeur</TableHead>
            <TableHead>Résultat</TableHead>
            <TableHead className="w-24 text-right">
              <span className="sr-only">Détail</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="cursor-pointer" onClick={() => onSelect(entry)}>
              <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                {formatDateTime(entry.occurredAt)}
              </TableCell>
              <TableCell>
                <StatusBadge tone={auditActionTone(entry.action)}>{auditEventTitle(entry)}</StatusBadge>
              </TableCell>
              <TableCell className="hidden max-w-44 text-muted-foreground text-xs 2xl:table-cell">
                {auditModule(entry.action)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex flex-col">
                  <span className="truncate">{auditSubjectName(entry) ?? "—"}</span>
                  <span className="text-muted-foreground text-xs first-letter:uppercase">
                    {auditResourceLabel(entry.resourceType)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-col">
                  <span>{actorDisplay(entry)}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {entry.actorEmail ?? actorTypeLabel(entry.actorType)}
                  </span>
                </div>
              </TableCell>
              {showOrganization ? (
                <TableCell className="hidden max-w-48 truncate text-muted-foreground xl:table-cell">
                  {entry.organizationId ? (orgNames.get(entry.organizationId) ?? "Organisation inconnue") : "—"}
                </TableCell>
              ) : null}
              <TableCell className="hidden font-mono text-muted-foreground text-xs xl:table-cell">
                {entry.actorIp ?? "—"}
              </TableCell>
              <TableCell className="hidden max-w-60 lg:table-cell">
                <span
                  className="line-clamp-2 text-muted-foreground text-xs"
                  title={auditChangeSummary(entry) ?? undefined}
                >
                  {auditChangeSummary(entry) ?? "—"}
                </span>
              </TableCell>
              <TableCell>
                {auditResult(entry) === "success" ? (
                  <StatusBadge tone="success">Réussi</StatusBadge>
                ) : (
                  <StatusBadge tone="danger">Échec</StatusBadge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(entry);
                  }}
                >
                  Détail
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
