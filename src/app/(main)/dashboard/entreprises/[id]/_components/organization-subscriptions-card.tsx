"use client";

import { useState } from "react";

import Link from "next/link";

import { FileSignature, Plus } from "lucide-react";

import { SubscriptionFormDialog } from "@/app/(main)/dashboard/_components/subscriptions/subscription-form-dialog";
import { SubscriptionRowActions } from "@/app/(main)/dashboard/_components/subscriptions/subscription-row-actions";
import {
  activeVehicleCount,
  formatUnitPrice,
} from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { subscriptionStatusMeta } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubscriptions } from "@/hooks/api/use-subscriptions";
import { formatDate } from "@/lib/format";

/** Souscriptions du client : un client peut en avoir plusieurs actives, une par offre (§III.6). */
export function OrganizationSubscriptionsCard({ organizationId }: { organizationId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const subscriptions = useSubscriptions({ organizationId, perPage: 100 });
  const rows = subscriptions.data?.data ?? [];

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Souscriptions ({rows.length})</CardTitle>
        <CardDescription>Offres souscrites par ce client et véhicules affectés à chacune.</CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            Nouvelle souscription
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {subscriptions.isPending ? (
          <LoadingRows rows={4} />
        ) : subscriptions.isError ? (
          <div className="px-4">
            <ErrorState error={subscriptions.error} onRetry={() => subscriptions.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4">
            <EmptyState
              icon={<FileSignature />}
              title="Aucune souscription"
              description="Ce client n'a encore souscrit à aucune offre."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Offre</TableHead>
                  <TableHead className="hidden md:table-cell">Période</TableHead>
                  <TableHead className="hidden sm:table-cell">Véhicules</TableHead>
                  <TableHead className="hidden lg:table-cell">Tarif appliqué</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const meta = subscriptionStatusMeta[s.status];
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/subscriptions/${s.id}`}
                          prefetch={false}
                          className="font-medium font-mono text-xs hover:underline"
                        >
                          {s.reference}
                        </Link>
                      </TableCell>
                      <TableCell>{s.offer.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatDate(s.startDate)} → {s.endDate ? formatDate(s.endDate) : "sans échéance"}
                      </TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">{activeVehicleCount(s)}</TableCell>
                      <TableCell className="hidden tabular-nums lg:table-cell">{formatUnitPrice(s)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <SubscriptionRowActions subscription={s} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <SubscriptionFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultOrganizationId={organizationId} />
    </Card>
  );
}
