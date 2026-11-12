"use client";

import { Fragment } from "react";

import { CornerDownRight, Cpu } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PermissionGroupNode, PermissionModuleNode } from "@/lib/permissions";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionGrants,
  permissionActionCodes,
  permissionActionHints,
  permissionActionLabels,
} from "@/types/permission";

export { grantSummary } from "@/lib/permissions";

type CheckState = boolean | "indeterminate";

/**
 * Matrice fonctionnalité × 7 actions (§VI.2, écran 4).
 *
 * Une fonctionnalité qui a des sous-fonctionnalités (ex. Supervision → temps réel, historique,
 * rejeu) affiche une ligne par sous-fonctionnalité ; sa propre ligne coche ou décoche
 * l'action sur toutes ses sous-fonctionnalités d'un coup.
 * `onChange` absent = lecture seule.
 */
export function PermissionEditor({
  tree,
  grants,
  onChange,
}: {
  tree: PermissionGroupNode[];
  grants: PermissionGrants;
  onChange?: (grants: PermissionGrants) => void;
}) {
  const readOnly = !onChange;

  /** Applique `actions(key)` à chaque clé de `keys`. */
  function apply(keys: string[], update: (current: PermissionAction[]) => PermissionAction[]) {
    if (!onChange) return;
    const next = { ...grants };
    for (const key of keys) {
      const actions = update(next[key] ?? []);
      if (actions.length === 0) delete next[key];
      else next[key] = PERMISSION_ACTIONS.filter((a) => actions.includes(a));
    }
    onChange(next);
  }

  const toggleAction = (keys: string[], action: PermissionAction, checked: boolean) =>
    apply(keys, (current) => (checked ? [...current, action] : current.filter((a) => a !== action)));
  const toggleAll = (keys: string[], checked: boolean) => apply(keys, () => (checked ? [...PERMISSION_ACTIONS] : []));

  /** État agrégé d'une case sur plusieurs clés. */
  function stateOf(keys: string[], action?: PermissionAction): CheckState {
    const hits = keys.filter((k) => {
      const granted = grants[k] ?? [];
      return action ? granted.includes(action) : granted.length === PERMISSION_ACTIONS.length;
    }).length;
    const any = keys.some((k) => (action ? (grants[k] ?? []).includes(action) : (grants[k] ?? []).length > 0));
    if (hits === keys.length && keys.length > 0) return true;
    return any ? "indeterminate" : false;
  }

  function renderRow(
    label: string,
    keys: string[],
    opts: { child?: boolean; node?: PermissionModuleNode; hardware?: boolean },
  ) {
    return (
      <TableRow key={keys.join("|") + label} className={opts.child ? "bg-muted/15" : undefined}>
        <TableCell className={opts.child ? "pl-8" : "font-medium"}>
          <span className="flex items-center gap-1.5">
            {opts.child ? <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" /> : null}
            <span className="truncate" title={label}>
              {label}
            </span>
            {opts.hardware ? (
              <Cpu className="size-3.5 shrink-0 text-muted-foreground" aria-label="Dépend du matériel installé" />
            ) : null}
          </span>
          {opts.node && opts.node.children.length > 0 ? (
            <span className="block text-muted-foreground text-xs">
              {opts.node.children.length} sous-fonctionnalités
            </span>
          ) : null}
        </TableCell>
        {PERMISSION_ACTIONS.map((a) => (
          <TableCell key={a} className="text-center">
            <Checkbox
              className="align-middle"
              checked={stateOf(keys, a)}
              disabled={readOnly}
              onCheckedChange={(c) => toggleAction(keys, a, c === true)}
              aria-label={`${label} : ${permissionActionLabels[a]}`}
            />
          </TableCell>
        ))}
        <TableCell className="text-center">
          <Checkbox
            className="align-middle"
            checked={stateOf(keys)}
            disabled={readOnly}
            onCheckedChange={(c) => toggleAll(keys, c === true)}
            aria-label={`${label} : toutes les actions`}
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table className="min-w-[1360px] table-fixed **:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
        <colgroup>
          <col className="w-[240px]" />
          <col span={PERMISSION_ACTIONS.length + 1} className="w-[100px]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Fonctionnalité</TableHead>
            {PERMISSION_ACTIONS.map((a) => (
              <TableHead
                key={a}
                className="whitespace-normal text-center text-xs leading-tight"
                title={`${permissionActionLabels[a]} — ${permissionActionHints[a]}`}
              >
                <span className="block font-mono font-semibold">{permissionActionCodes[a]}</span>
                <span className="block font-normal text-muted-foreground">{permissionActionLabels[a]}</span>
              </TableHead>
            ))}
            <TableHead className="text-center text-xs">Tout</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tree.map(({ group, modules }) => (
            <Fragment key={group}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell
                  colSpan={PERMISSION_ACTIONS.length + 2}
                  className="py-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  {group}
                </TableCell>
              </TableRow>
              {modules.map((m) =>
                m.children.length === 0 ? (
                  renderRow(m.label, [m.key], { hardware: m.requiresHardware })
                ) : (
                  <Fragment key={m.key}>
                    {renderRow(
                      m.label,
                      m.children.map((c) => c.key),
                      { node: m },
                    )}
                    {m.children.map((c) => renderRow(c.label, [c.key], { child: true, hardware: c.requiresHardware }))}
                  </Fragment>
                ),
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
