"use client";

import { useState } from "react";

import Link from "next/link";

import { ListChecks, ShieldCheck, ShieldOff, UserCog, Waypoints } from "lucide-react";

import { LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { permissionLabel } from "@/components/status-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMfaStatus, useUserScope } from "@/hooks/api/use-access";
import { useCurrentUser } from "@/hooks/api/use-auth";
import { formatDateTime } from "@/lib/format";
import type { UserDetail } from "@/types/user";

import { AssignRoleDialog, ResetMfaDialog, ScopeDialog } from "../../_components/user-access-dialogs";

const SCOPE_LABELS = {
  organization: "Toute l'organisation",
  vehicle_groups: "Groupes de véhicules",
  vehicles: "Véhicules précis",
} as const;

/** Accès & sécurité d'un compte : rôle, permissions, périmètre et MFA (§VI.2 à §VI.4). */
export function UserAccessCards({ user }: { user: UserDetail }) {
  const [dialog, setDialog] = useState<"role" | "scope" | "mfa" | null>(null);
  const { data: me } = useCurrentUser();
  const isSelf = me?.id === user.id;
  const platform = user.role?.code === "super_admin";
  const scope = useUserScope(platform ? undefined : user.id);
  const mfa = useMfaStatus(user.id, user.role?.code);
  // Les dialogues attendent la forme « liste » d'un utilisateur ; le détail en est un sur-ensemble.
  const asUser = { ...user, role: user.role ? { id: user.role.id, code: user.role.code, name: user.role.name } : null };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-muted-foreground" />
            Rôle et permissions
          </CardTitle>
          <CardDescription>
            {user.role ? `${user.role.name} (${user.role.code})` : "Rôle non renvoyé par l'API."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(user.role?.permissions ?? []).map((permission) => (
              <Badge key={permission} variant="outline" className="rounded-sm" title={permission}>
                {permissionLabel(permission)}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={isSelf} onClick={() => setDialog("role")}>
              <UserCog data-icon="inline-start" />
              Attribuer un rôle
            </Button>
            <Button size="sm" variant="outline" asChild disabled={isSelf}>
              <Link href={`/dashboard/roles?tab=permissions&user=${user.id}`} prefetch={false}>
                <ListChecks data-icon="inline-start" />
                Modifier les permissions
              </Link>
            </Button>
          </div>
          {isSelf ? (
            <p className="text-muted-foreground text-xs">Vous ne pouvez pas modifier vos propres habilitations.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Waypoints className="size-4 text-muted-foreground" />
            Périmètre autorisé
          </CardTitle>
          <CardDescription>Données auxquelles ce compte a accès.</CardDescription>
          {platform ? null : (
            <CardAction>
              <Button size="sm" variant="outline" onClick={() => setDialog("scope")}>
                Modifier
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {platform ? (
            <p>Collaborateur SISBM : accès à tous les clients, selon ses habilitations.</p>
          ) : scope.isPending ? (
            <LoadingRows rows={2} className="flex flex-col gap-2" />
          ) : scope.data ? (
            <>
              <p className="font-medium">
                {SCOPE_LABELS[scope.data.mode]} — {user.organization?.name ?? "son organisation"}
              </p>
              {scope.data.mode !== "organization" ? (
                <div className="flex flex-wrap gap-1.5">
                  {(scope.data.mode === "vehicle_groups" ? scope.data.groupNames : scope.data.vehicleLabels).map(
                    (l) => (
                      <Badge key={l} variant="secondary">
                        {l}
                      </Badge>
                    ),
                  )}
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {scope.data.updatedAt
                  ? `Modifié le ${formatDateTime(scope.data.updatedAt)} par ${scope.data.updatedBy}`
                  : "Périmètre par défaut."}{" "}
                Jamais les données d'un autre client.
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Authentification multifacteur
          </CardTitle>
          <CardDescription>Obligatoire pour les accès privilégiés (§VI.4).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {mfa.isPending ? (
            <LoadingRows rows={2} className="flex flex-col gap-2" />
          ) : mfa.data?.enabled ? (
            <>
              <StatusBadge tone="success">Activée ({mfa.data.method === "sms" ? "SMS" : "application"})</StatusBadge>
              <p className="text-muted-foreground text-xs">
                Depuis le {formatDateTime(mfa.data.enrolledAt)} · {mfa.data.recoveryCodesLeft} code(s) de secours
              </p>
            </>
          ) : mfa.data?.required ? (
            <>
              <StatusBadge tone="danger">Exigée, non configurée</StatusBadge>
              <p className="text-muted-foreground text-xs">
                Rôle privilégié : la configuration sera imposée à la prochaine connexion.
              </p>
            </>
          ) : (
            <StatusBadge tone="neutral">Non activée</StatusBadge>
          )}
          {mfa.data?.enabled ? (
            <Button size="sm" variant="outline" className="w-fit" disabled={isSelf} onClick={() => setDialog("mfa")}>
              <ShieldOff data-icon="inline-start" />
              Réinitialiser la MFA
            </Button>
          ) : null}
          {isSelf ? (
            <Button size="sm" variant="link" className="h-auto w-fit p-0" asChild>
              <Link href="/dashboard/profile" prefetch={false}>
                Gérer ma MFA dans « Mon profil »
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <AssignRoleDialog user={dialog === "role" ? asUser : null} onOpenChange={(o) => !o && setDialog(null)} />
      <ScopeDialog user={dialog === "scope" ? asUser : null} onOpenChange={(o) => !o && setDialog(null)} />
      <ResetMfaDialog user={dialog === "mfa" ? asUser : null} onOpenChange={(o) => !o && setDialog(null)} />
    </div>
  );
}
