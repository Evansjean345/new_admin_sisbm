"use client";

import { useState } from "react";

import Link from "next/link";

import {
  CalendarClock,
  Gauge,
  LayoutDashboard,
  MapPinned,
  PackagePlus,
  Plus,
  UsersRound,
  Workflow,
} from "lucide-react";

import { InvoicesTable } from "@/app/(main)/dashboard/_components/billing/invoices-table";
import { AssignOfferDialog } from "@/app/(main)/dashboard/_components/client-offers/assign-offer-dialog";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { EmptyState, LoadingRows } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBillingStats, useInvoices } from "@/hooks/api/use-billing";
import { useClientOffers } from "@/hooks/api/use-client-offers";
import { formatDateTime } from "@/lib/format";

/**
 * Rubriques de la plateforme Client accessibles depuis la fiche (§III.1) : mêmes écrans, filtrés
 * sur ce client, ouverts dans son espace contextualisé.
 */
const RUBRICS = [
  { tab: "overview", label: "Tableau de bord client", icon: LayoutDashboard },
  { tab: "schedules", label: "Horaires", icon: CalendarClock },
  { tab: "zones", label: "Zones géographiques", icon: MapPinned },
  { tab: "speed", label: "Contrôle de vitesse", icon: Gauge },
  { tab: "rules", label: "Moteur de règles", icon: Workflow },
  { tab: "drivers", label: "Conducteurs", icon: UsersRound },
] as const;

export function ClientRubricsCard({ organizationId }: { organizationId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rubriques client</CardTitle>
        <CardDescription>
          Ouvrez l'environnement du client. Toute action y est enregistrée avec votre identité et le client concerné.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Button variant="outline" className="h-auto flex-col gap-1.5 py-3" asChild>
          <Link href={`/dashboard/fleet?organizationId=${organizationId}`} prefetch={false}>
            <MapPinned />
            <span className="text-xs">Supervision</span>
          </Link>
        </Button>
        {RUBRICS.map((r) => (
          <Button key={r.tab} variant="outline" className="h-auto flex-col gap-1.5 py-3" asChild>
            <Link href={`/dashboard/entreprises/${organizationId}/espace-client?tab=${r.tab}`} prefetch={false}>
              <r.icon />
              <span className="text-center text-xs">{r.label}</span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

/** Factures du client et solde (onglet Facturation). */
export function OrganizationBillingCard({ organizationId }: { organizationId: string }) {
  const invoices = useInvoices({ organizationId, perPage: 100 });
  const rows = invoices.data?.data ?? [];
  const due = rows.reduce((sum, i) => sum + i.balance, 0);
  const overdue = rows.filter((i) => i.status === "overdue").length;
  const stats = useBillingStats({});
  const currency = stats.data?.currency ?? "XOF";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Factures</CardTitle>
        <CardDescription>
          {invoices.isPending
            ? "Chargement…"
            : `Reste à payer : ${formatMoney(due, currency)}${overdue ? ` · ${overdue} facture(s) en retard` : ""}`}
        </CardDescription>
        <CardAction>
          <Button size="sm" asChild>
            <Link href="/dashboard/invoice/new" prefetch={false}>
              <Plus data-icon="inline-start" />
              Nouvelle facture
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <InvoicesTable query={invoices} hideClient emptyDescription="Aucune facture pour ce client." />
      </CardContent>
    </Card>
  );
}

/** Clients finaux / distributeurs de l'organisation et l'offre attribuée à chacun. */
export function OrganizationClientOffersCard({ organizationId }: { organizationId: string }) {
  const offers = useClientOffers({ organizationId });
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Offres attribuées aux utilisateurs</CardTitle>
        <CardDescription>Sans offre, un utilisateur ne peut pas recevoir de permissions.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <PackagePlus data-icon="inline-start" />
            Attribuer une offre
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {offers.isPending ? (
          <LoadingRows rows={3} className="flex flex-col gap-2" />
        ) : (offers.data ?? []).length === 0 ? (
          <EmptyState icon={<PackagePlus />} title="Aucune offre attribuée" />
        ) : (
          <ul className="flex flex-col divide-y">
            {(offers.data ?? []).map((a) => (
              <li key={a.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link href={`/dashboard/users/${a.userId}`} prefetch={false} className="flex flex-col hover:underline">
                  <span className="font-medium text-sm">{a.userName}</span>
                  <span className="text-muted-foreground text-xs">
                    {a.userEmail}
                    {a.roleName ? ` · ${a.roleName}` : ""}
                  </span>
                </Link>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">{a.offer.name}</Badge>
                  <span className="text-muted-foreground">{formatDateTime(a.assignedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <AssignOfferDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}
