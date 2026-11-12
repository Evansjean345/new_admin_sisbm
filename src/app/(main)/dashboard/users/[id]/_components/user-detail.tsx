"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { ArrowLeft, Building2, Pencil } from "lucide-react";

import { DetailList } from "@/components/detail-list";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { permissionLabel, userStatusMeta } from "@/components/status-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/api/use-users";
import { formatDateTime, formatRelative } from "@/lib/format";

import { AuditLogPanel } from "../../../_components/audit/audit-log-panel";
import { UserEditDialog } from "../../_components/user-edit-dialog";
import { UserRowActions } from "../../_components/user-row-actions";
import { UserAvatar, userIdentifier } from "../../_components/users-columns";
import { UserAccessCards } from "./user-access-card";
import { UserOfferCard, UserOrganizationCard } from "./user-organization-card";

export function UserDetailView({ id }: { id: string }) {
  const router = useRouter();
  const user = useUser(id);
  const [editOpen, setEditOpen] = useState(false);
  // `?tab=audit` : ouverture directe depuis « Consulter le journal ».
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(() => {
    const t = searchParams.get("tab");
    return t === "audit" || t === "access" ? t : "info";
  });

  if (user.isPending) return <LoadingRows rows={6} />;
  if (user.isError) return <ErrorState error={user.error} onRetry={() => user.refetch()} />;

  const u = user.data;
  const meta = userStatusMeta[u.status];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/users" prefetch={false}>
            <ArrowLeft data-icon="inline-start" />
            Utilisateurs
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar user={u} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="truncate font-medium text-2xl leading-none tracking-tight sm:text-3xl">{u.fullName}</h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              <span>{u.email}</span>
              <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
              {u.role ? (
                <Badge variant="outline" className="rounded-sm">
                  {u.role.name}
                </Badge>
              ) : null}
              {u.organization ? (
                <Link
                  href={`/dashboard/entreprises/${u.organizationId}`}
                  prefetch={false}
                  className="flex items-center gap-1 hover:underline"
                >
                  <Building2 className="size-3.5" />
                  {u.organization.name}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil data-icon="inline-start" />
            Modifier
          </Button>
          <UserRowActions user={u} onDeleted={() => router.replace("/dashboard/users")} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="access">Accès & sécurité</TabsTrigger>
          <TabsTrigger value="audit">Journal</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="flex flex-col gap-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <UserOrganizationCard user={u} />
            <UserOfferCard user={u} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Informations</CardTitle>
                <CardDescription>Coordonnées et préférences du compte.</CardDescription>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    { label: "Nom complet", value: u.fullName },
                    { label: "E-mail", value: u.email },
                    { label: "Téléphone", value: u.phone ?? "—" },
                    { label: "Langue", value: u.locale === "en" ? "English" : "Français" },
                    { label: "Fuseau horaire", value: u.timezone },
                    { label: "Créé le", value: formatDateTime(u.createdAt) },
                    { label: "Dernière connexion", value: `${formatDateTime(u.lastLoginAt, "Jamais")}` },
                    { label: "IP de connexion", value: u.lastLoginIp ?? "—" },
                    { label: "Tentatives échouées", value: String(u.failedAttempts) },
                    { label: "Verrouillé jusqu'au", value: formatDateTime(u.lockedUntil) },
                    { label: "Mot de passe modifié", value: formatDateTime(u.passwordChangedAt, "Jamais") },
                    { label: "Mis à jour", value: formatRelative(u.updatedAt) },
                    { label: "Identifiant", value: userIdentifier(u), mono: true },
                    { label: "ID technique", value: u.id, mono: true },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="access">
          <UserAccessCards user={u} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogPanel
            source={{ scope: "actor", actorId: u.id }}
            showOrganization
            title={`Actions de ${u.fullName}`}
            description="Tout ce que ce compte a fait sur la plateforme, avec l'ancienne et la nouvelle valeur."
          />
        </TabsContent>
      </Tabs>

      <UserEditDialog user={u} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
