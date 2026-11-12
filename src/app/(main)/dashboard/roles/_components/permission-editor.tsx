"use client";

import { Fragment } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionGrants,
  permissionActionLabels,
} from "@/types/permission";

/** Modules regroupés comme le menu principal, dans l'ordre du catalogue. */
const GROUPS = PERMISSION_MODULES.reduce<Array<{ group: string; modules: typeof PERMISSION_MODULES }>>((acc, m) => {
  const last = acc.at(-1);
  if (last?.group === m.group) last.modules.push(m);
  else acc.push({ group: m.group, modules: [m] });
  return acc;
}, []);

/**
 * Matrice module × 7 actions (§VI.2, écran 4).
 * `onChange` absent = lecture seule (rôles système).
 */
export function PermissionEditor({
  grants,
  onChange,
}: {
  grants: PermissionGrants;
  onChange?: (grants: PermissionGrants) => void;
}) {
  const readOnly = !onChange;

  function set(moduleKey: string, actions: PermissionAction[]) {
    if (!onChange) return;
    const next = { ...grants };
    if (actions.length === 0) delete next[moduleKey];
    else next[moduleKey] = PERMISSION_ACTIONS.filter((a) => actions.includes(a));
    onChange(next);
  }

  function toggle(moduleKey: string, action: PermissionAction, checked: boolean) {
    const next = new Set(grants[moduleKey] ?? []);
    if (checked) next.add(action);
    else next.delete(action);
    set(
      moduleKey,
      PERMISSION_ACTIONS.filter((permissionAction) => next.has(permissionAction)),
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table className="min-w-[1116px] table-fixed **:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
        <colgroup>
          <col className="w-[220px]" />
          <col span={PERMISSION_ACTIONS.length + 1} className="w-[112px]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-52">Module</TableHead>
            {PERMISSION_ACTIONS.map((a) => (
              <TableHead key={a} className="whitespace-normal text-center text-xs leading-tight">
                {permissionActionLabels[a]}
              </TableHead>
            ))}
            <TableHead className="text-center text-xs">Tout</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {GROUPS.map(({ group, modules }) => (
            <Fragment key={group}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell
                  colSpan={PERMISSION_ACTIONS.length + 2}
                  className="py-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  {group}
                </TableCell>
              </TableRow>
              {modules.map((m) => {
                const granted = grants[m.key] ?? [];
                const full = granted.length === PERMISSION_ACTIONS.length;
                const allActionsState = full || (granted.length > 0 && "indeterminate");
                return (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    {PERMISSION_ACTIONS.map((a) => (
                      <TableCell key={a} className="text-center">
                        <Checkbox
                          className="align-middle"
                          checked={granted.includes(a)}
                          disabled={readOnly}
                          onCheckedChange={(c) => toggle(m.key, a, c === true)}
                          aria-label={`${m.label} : ${permissionActionLabels[a]}`}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Checkbox
                        className="align-middle"
                        checked={allActionsState}
                        disabled={readOnly}
                        onCheckedChange={(c) => set(m.key, c === true ? [...PERMISSION_ACTIONS] : [])}
                        aria-label={`${m.label} : toutes les actions`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Nombre de modules accessibles et d'autorisations accordées, pour les résumés. */
export function grantSummary(grants: PermissionGrants): { modules: number; actions: number } {
  const values = Object.values(grants);
  return { modules: values.filter((v) => v.length > 0).length, actions: values.reduce((n, v) => n + v.length, 0) };
}
