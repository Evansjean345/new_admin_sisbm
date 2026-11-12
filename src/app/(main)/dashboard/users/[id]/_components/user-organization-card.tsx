"use client";

import { useState } from "react";

import Link from "next/link";

import { ArrowRight, Building2, Package, PackagePlus } from "lucide-react";

import { AssignOfferDialog } from "@/app/(main)/dashboard/_components/client-offers/assign-offer-dialog";
import { DetailList } from "@/components/detail-list";
import { LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientOffer } from "@/hooks/api/use-client-offers";
import { useOrganization } from "@/hooks/api/use-organizations";
import { formatDateTime } from "@/lib/format";
import type { UserDetail } from "@/types/user";

/** Organisation à laquelle le client est rattaché (retour de la direction, 12/11/2026). */
export function UserOrganizationCard({ user }: { user: UserDetail }) {
  const organization = useOrganization(user.organizationId);
  const org = organization.data;
  const summary = user.organization;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          Organisation
        </CardTitle>
        <CardDescription>Organisation à laquelle ce client est associé.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/entreprises/${user.organizationId}`} prefetch={false}>
              Voir la fiche
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {organization.isPending && !summary ? (
          <LoadingRows rows={2} className="flex flex-col gap-2" />
        ) : (
          <DetailList
            className="sm:grid-cols-2 xl:grid-cols-2"
            items={[
              {
                label: "Nom",
                value: (
                  <Link
                    className="font-medium hover:underline"
                    href={`/dashboard/entreprises/${user.organizationId}`}
                    prefetch={false}
                  >
                    {org?.name ?? summary?.name ?? user.organizationId}
                  </Link>
                ),
              },
              { label: "Code", value: org?.code ?? summary?.code ?? "—", mono: true },
              {
                label: "Statut",
                value:
                  (org?.isActive ?? summary?.isActive) === false ? (
                    <StatusBadge tone="orange">Bloquée</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Active</StatusBadge>
                  ),
              },
              { label: "E-mail de contact", value: org?.contactEmail ?? "—" },
              { label: "Téléphone", value: org?.contactPhone ?? "—" },
              { label: "Utilisateurs / véhicules", value: org ? `${org.stats.users} / ${org.stats.vehicles}` : "—" },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Offre du client : condition préalable à l'attribution de permissions. */
export function UserOfferCard({ user }: { user: UserDetail }) {
  const platform = user.role?.code === "super_admin";
  const offer = useClientOffer(platform ? undefined : user.id);
  const [assignOpen, setAssignOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" />
          Offre
        </CardTitle>
        <CardDescription>Les permissions du client sont limitées aux fonctionnalités de son offre.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {platform ? (
          <p className="text-muted-foreground text-sm">Collaborateur SISBM : pas d'offre, accès plateforme.</p>
        ) : offer.isPending ? (
          <LoadingRows rows={2} className="flex flex-col gap-2" />
        ) : offer.data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{offer.data.offer.name}</Badge>
              <span className="text-muted-foreground text-xs">{offer.data.featureKeys.length} fonctionnalités</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Souscription{" "}
              <Link
                href={`/dashboard/subscriptions/${offer.data.subscriptionId}`}
                prefetch={false}
                className="font-mono hover:underline"
              >
                {offer.data.subscriptionReference}
              </Link>{" "}
              · attribuée le {formatDateTime(offer.data.assignedAt)}
            </p>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setAssignOpen(true)}>
              <PackagePlus data-icon="inline-start" />
              Changer d'offre
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">Aucune offre souscrite : aucune permission ne peut encore lui être attribuée.</p>
            <Button size="sm" className="w-fit" onClick={() => setAssignOpen(true)}>
              <PackagePlus data-icon="inline-start" />
              Attribuer une offre
            </Button>
          </>
        )}
      </CardContent>
      {platform ? null : (
        <AssignOfferDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          preset={{ userId: user.id, organizationId: user.organizationId }}
        />
      )}
    </Card>
  );
}
