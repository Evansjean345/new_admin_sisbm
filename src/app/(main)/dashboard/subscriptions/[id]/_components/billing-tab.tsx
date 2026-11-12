"use client";

import Link from "next/link";

import { Plus } from "lucide-react";

import { InvoicesTable } from "@/app/(main)/dashboard/_components/billing/invoices-table";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInvoices } from "@/hooks/api/use-billing";
import type { Subscription } from "@/types/subscription";

/** Factures de la souscription ; la création part préremplie depuis celle-ci. */
export function BillingTab({ subscription }: { subscription: Subscription }) {
  const invoices = useInvoices({ subscriptionId: subscription.id, perPage: 100 });
  const canInvoice = subscription.status !== "draft";
  const newHref = `/dashboard/invoice/new?subscriptionId=${subscription.id}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Factures</CardTitle>
        <CardDescription>Factures établies pour cette souscription, toutes périodes confondues.</CardDescription>
        {canInvoice ? (
          <CardAction>
            <Button size="sm" asChild>
              <Link href={newHref} prefetch={false}>
                <Plus data-icon="inline-start" />
                Nouvelle facture
              </Link>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        <InvoicesTable
          query={invoices}
          hideClient
          emptyDescription={
            canInvoice ? "Aucune facture pour cette souscription." : "Une souscription brouillon ne se facture pas."
          }
        />
      </CardContent>
    </Card>
  );
}
