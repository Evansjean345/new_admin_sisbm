"use client";

import { useEffect, useState } from "react";

import { Copy, Lock, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateRoleDefinition } from "@/hooks/api/use-role-definitions";
import { getErrorMessage } from "@/lib/axios";
import type { PermissionGrants, RoleDefinition } from "@/types/permission";

import { grantSummary, PermissionEditor } from "./permission-editor";

const same = (a: PermissionGrants, b: PermissionGrants) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** Écran 4 du §VI.2 : la matrice d'un rôle, modifiable pour un rôle personnalisé. */
export function RolePermissionsPanel({
  roles,
  roleId,
  onRoleChange,
  onDuplicate,
}: {
  roles: RoleDefinition[];
  roleId: string | undefined;
  onRoleChange: (id: string) => void;
  onDuplicate: (role: RoleDefinition) => void;
}) {
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  const [draft, setDraft] = useState<PermissionGrants>(role?.grants ?? {});
  const update = useUpdateRoleDefinition();

  useEffect(() => {
    setDraft(role?.grants ?? {});
  }, [role]);

  if (!role) return null;
  const dirty = !role.isSystem && !same(draft, role.grants);
  const summary = grantSummary(draft);

  function save() {
    update.mutate(
      { id: role.id, payload: { grants: draft } },
      {
        onSuccess: () => toast.success("Permissions enregistrées", { description: role.name }),
        onError: (error) => toast.error("Enregistrement impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={role.id}
            onValueChange={(id) => {
              if (dirty && !window.confirm("Abandonner les modifications non enregistrées ?")) return;
              onRoleChange(id);
            }}
          >
            <SelectTrigger className="min-w-64">
              <span className="text-muted-foreground">Rôle :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                    {r.isSystem ? " · système" : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm tabular-nums">
            {summary.modules} module(s) · {summary.actions} autorisation(s)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role.isSystem ? (
            <Button variant="outline" size="sm" onClick={() => onDuplicate(role)}>
              <Copy data-icon="inline-start" />
              Dupliquer pour personnaliser
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!dirty || update.isPending}
                onClick={() => setDraft(role.grants)}
              >
                <RotateCcw data-icon="inline-start" />
                Annuler
              </Button>
              <Button size="sm" disabled={!dirty || update.isPending} onClick={save}>
                {update.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                Enregistrer
              </Button>
            </>
          )}
        </div>
      </div>

      {role.isSystem ? (
        <Alert>
          <Lock />
          <AlertTitle>Rôle système en lecture seule</AlertTitle>
          <AlertDescription>
            <p>
              Défini par la plateforme et traduit depuis ses permissions API :{" "}
              <code className="text-xs">{role.apiPermissions.join(", ") || "aucune"}</code>. Dupliquez-le pour créer une
              variante personnalisable.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <PermissionEditor grants={draft} onChange={role.isSystem ? undefined : setDraft} />
      <p className="text-muted-foreground text-xs">
        Cocher une action coche aussi « Consultation » ; décocher « Consultation » retire tout le module. Les
        permissions seront vérifiées côté serveur, pas seulement dans l'interface (§VI.4).
      </p>
    </div>
  );
}
