"use client";

import { useState } from "react";

import { ClipboardList, Pencil } from "lucide-react";

import { DetailList } from "@/components/detail-list";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { clientStatusMeta, clientTypeLabels } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientProfile } from "@/hooks/api/use-client-profiles";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Organization } from "@/types/organization";

import { ClientProfileDialog } from "../../_components/client-profile-dialog";

/** Fiche commerciale (§III.3), à côté de l'identité technique de l'organisation. */
export function ClientProfileCard({ organization }: { organization: Organization }) {
  const profile = useClientProfile(organization.id);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Fiche commerciale</CardTitle>
        <CardDescription>
          {profile.data?.updatedAt
            ? `Mise à jour le ${formatDateTime(profile.data.updatedAt)} · données de démonstration`
            : "Raison sociale, contact responsable et suivi commercial · données de démonstration"}
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" disabled={profile.isPending} onClick={() => setEditOpen(true)}>
            <Pencil data-icon="inline-start" />
            {profile.data?.completed ? "Modifier" : "Compléter"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {profile.isPending ? (
          <LoadingRows rows={4} />
        ) : profile.isError ? (
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        ) : !profile.data.completed ? (
          <EmptyState
            icon={<ClipboardList />}
            title="Fiche à compléter"
            description="RCCM, type de client, responsable et commercial ne sont pas encore renseignés."
            action={
              <Button size="sm" onClick={() => setEditOpen(true)}>
                Compléter la fiche
              </Button>
            }
          />
        ) : (
          <ProfileDetails profile={profile.data} />
        )}
      </CardContent>

      <ClientProfileDialog
        organization={organization}
        profile={profile.data}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Card>
  );
}

function ProfileDetails({ profile }: { profile: NonNullable<ReturnType<typeof useClientProfile>["data"]> }) {
  const status = clientStatusMeta[profile.status];
  const location = [profile.address, profile.city, profile.country].filter(Boolean).join(", ");
  const manager = [profile.manager.name, profile.manager.position].filter(Boolean).join(" — ");
  return (
    <div className="flex flex-col gap-6">
      <DetailList
        items={[
          { label: "Statut commercial", value: <StatusBadge tone={status.tone}>{status.label}</StatusBadge> },
          { label: "Type de client", value: clientTypeLabels[profile.clientType] },
          { label: "Raison sociale", value: profile.legalName ?? "—" },
          { label: "Nom commercial", value: profile.tradeName ?? "—" },
          { label: "N° RCCM", value: profile.registrationNumber ?? "—", mono: true },
          { label: "Adresse", value: location || "—" },
          { label: "Responsable", value: manager || "—" },
          { label: "Téléphone du responsable", value: profile.manager.phone ?? "—" },
          { label: "E-mail du responsable", value: profile.manager.email ?? "—" },
          { label: "Entrée en relation", value: formatDate(profile.relationStartDate) },
          { label: "Commercial responsable", value: profile.salesRep ?? "—" },
        ]}
      />
      {profile.specialConditions || profile.notes ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {profile.specialConditions ? (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Conditions particulières</span>
              <p className="whitespace-pre-line text-sm">{profile.specialConditions}</p>
            </div>
          ) : null}
          {profile.notes ? (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Observations</span>
              <p className="whitespace-pre-line text-sm">{profile.notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
