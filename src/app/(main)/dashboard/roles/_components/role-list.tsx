"use client";

import { Copy, KeyRound, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSION_MODULES, type RoleDefinition, roleScopeLabels } from "@/types/permission";

import { grantSummary } from "./permission-editor";

export type RoleAction = "permissions" | "edit" | "duplicate" | "delete";

/** Liste des rôles (§VI.2, écran 3) : système d'abord, puis personnalisés. */
export function RoleList({
  roles,
  usersByRole,
  onAction,
}: {
  roles: RoleDefinition[];
  /** null = comptage indisponible (accès refusé à la liste des utilisateurs). */
  usersByRole: Map<string, number> | null;
  onAction: (action: RoleAction, role: RoleDefinition) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
        <TableHeader>
          <TableRow>
            <TableHead>Rôle</TableHead>
            <TableHead className="hidden sm:table-cell">Portée</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden md:table-cell">Modules accessibles</TableHead>
            <TableHead className="hidden lg:table-cell">Utilisateurs</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => {
            const summary = grantSummary(role.grants);
            return (
              <TableRow key={role.id}>
                <TableCell>
                  <button
                    type="button"
                    className="flex flex-col text-left hover:underline"
                    onClick={() => onAction("permissions", role)}
                  >
                    <span className="font-medium">{role.name}</span>
                    <span className="font-mono text-muted-foreground text-xs">{role.code}</span>
                  </button>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {roleScopeLabels[role.scope]}
                </TableCell>
                <TableCell>
                  {role.isSystem ? (
                    <StatusBadge tone="info">Système</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Personnalisé</StatusBadge>
                  )}
                </TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">
                  {summary.modules} / {PERMISSION_MODULES.length}
                  <span className="text-muted-foreground text-xs"> · {summary.actions} autorisations</span>
                </TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">
                  {role.isSystem ? (usersByRole ? (usersByRole.get(role.id) ?? 0) : "—") : 0}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${role.name}`}>
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => onAction("permissions", role)}>
                            <KeyRound />
                            {role.isSystem ? "Voir les permissions" : "Modifier les permissions"}
                          </DropdownMenuItem>
                          {role.isSystem ? null : (
                            <DropdownMenuItem onClick={() => onAction("edit", role)}>
                              <Pencil />
                              Renommer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onAction("duplicate", role)}>
                            <Copy />
                            Dupliquer
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        {role.isSystem ? null : (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => onAction("delete", role)}>
                              <Trash2 />
                              Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
