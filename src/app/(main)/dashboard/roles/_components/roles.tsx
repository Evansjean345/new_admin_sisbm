"use client";

import { useMemo, useState } from "react";

import { FlaskConical, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeleteRoleDefinition, useRoleDefinitions } from "@/hooks/api/use-role-definitions";
import { useUsers } from "@/hooks/api/use-users";
import { getErrorMessage } from "@/lib/axios";
import type { RoleDefinition } from "@/types/permission";

import { RoleFormDialog } from "./role-form-dialog";
import { type RoleAction, RoleList } from "./role-list";
import { RolePermissionsPanel } from "./role-permissions-panel";

const ROLE_ORDER = ["super_admin", "admin", "operator"];

type Dialog = { kind: "create" } | { kind: "edit" | "duplicate" | "delete"; role: RoleDefinition } | null;

/** Rôles (§VI.2 écran 3) et permissions (écran 4). */
export function Roles() {
  const roles = useRoleDefinitions();
  // Comptage par rôle : 100 utilisateurs max par appel côté API ; facultatif si l'accès est refusé.
  const users = useUsers({ page: 1, perPage: 100 });
  const remove = useDeleteRoleDefinition();
  const [tab, setTab] = useState("roles");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [dialog, setDialog] = useState<Dialog>(null);

  const rows = useMemo(
    () =>
      [...(roles.data ?? [])].sort((a, b) => {
        const rank = (r: RoleDefinition) => (r.isSystem ? ROLE_ORDER.indexOf(r.code) : 100);
        return Number(a.isSystem === false) - Number(b.isSystem === false) || rank(a) - rank(b);
      }),
    [roles.data],
  );

  const usersByRole = useMemo(() => {
    if (!users.data) return null;
    const counts = new Map<string, number>();
    for (const u of users.data.data) counts.set(u.roleId, (counts.get(u.roleId) ?? 0) + 1);
    return counts;
  }, [users.data]);

  function onAction(action: RoleAction, role: RoleDefinition) {
    if (action === "permissions") {
      setSelectedId(role.id);
      setTab("permissions");
    } else {
      setDialog({ kind: action, role });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Rôles et permissions"
        description="Rôles des collaborateurs SISBM et des utilisateurs clients, et ce que chacun peut faire par module."
        actions={
          <>
            <Button variant="outline" onClick={() => roles.refetch()} disabled={roles.isFetching}>
              <RefreshCw data-icon="inline-start" className={roles.isFetching ? "animate-spin" : undefined} />
              Actualiser
            </Button>
            <Button onClick={() => setDialog({ kind: "create" })}>
              <Plus data-icon="inline-start" />
              Nouveau rôle
            </Button>
          </>
        }
      />

      <Alert>
        <FlaskConical />
        <AlertTitle>Rôles personnalisés en démonstration</AlertTitle>
        <AlertDescription>
          Les rôles système viennent de l'API. Les rôles personnalisés et leurs permissions sont simulés et perdus au
          rechargement, en attendant les routes d'écriture.
        </AlertDescription>
      </Alert>

      {roles.isPending ? (
        <LoadingRows rows={6} />
      ) : roles.isError ? (
        <ErrorState error={roles.error} onRetry={() => roles.refetch()} title="Rôles indisponibles" />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="roles">Rôles ({rows.length})</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>
          <TabsContent value="roles" className="pt-4">
            <Card>
              <CardContent className="px-0">
                <RoleList roles={rows} usersByRole={usersByRole} onAction={onAction} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="permissions" className="pt-4">
            <RolePermissionsPanel
              roles={rows}
              roleId={selectedId}
              onRoleChange={setSelectedId}
              onDuplicate={(role) => setDialog({ kind: "duplicate", role })}
            />
          </TabsContent>
        </Tabs>
      )}

      <RoleFormDialog
        open={dialog?.kind === "create" || dialog?.kind === "edit" || dialog?.kind === "duplicate"}
        onOpenChange={(o) => !o && setDialog(null)}
        role={dialog?.kind === "edit" ? dialog.role : undefined}
        source={dialog?.kind === "duplicate" ? dialog.role : undefined}
        onSaved={(saved) => {
          setSelectedId(saved.id);
          setTab("permissions");
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Supprimer le rôle ${dialog?.kind === "delete" ? dialog.role.name : ""} ?`}
        description="Les utilisateurs qui portent ce rôle devront en recevoir un autre."
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          const { role } = dialog;
          remove.mutate(role.id, {
            onSuccess: () => {
              toast.success("Rôle supprimé", { description: role.name });
              if (selectedId === role.id) setSelectedId(undefined);
              setDialog(null);
            },
            onError: (error) => toast.error("Suppression impossible", { description: getErrorMessage(error) }),
          });
        }}
      />
    </div>
  );
}
