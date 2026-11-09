"use client";

import { useState } from "react";

import Link from "next/link";

import { Ban, Eye, MoreVertical, Pause, Pencil, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Subscription, SubscriptionStatus } from "@/types/subscription";

import { SubscriptionFormDialog } from "./subscription-form-dialog";
import { SubscriptionStatusDialog } from "./subscription-status-dialog";

export function SubscriptionRowActions({
  subscription,
  showView = true,
}: {
  subscription: Subscription;
  showView?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Exclude<SubscriptionStatus, "draft"> | null>(null);
  const terminated = subscription.status === "terminated";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${subscription.reference}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52" align="end">
          <DropdownMenuGroup>
            {showView ? (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/subscriptions/${subscription.id}`} prefetch={false}>
                  <Eye />
                  Voir le détail
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={terminated} onClick={() => setEditOpen(true)}>
              <Pencil />
              Modifier
            </DropdownMenuItem>
            {subscription.status === "active" ? (
              <DropdownMenuItem onClick={() => setStatusTarget("suspended")}>
                <Pause />
                Suspendre
              </DropdownMenuItem>
            ) : null}
            {subscription.status === "draft" || subscription.status === "suspended" ? (
              <DropdownMenuItem onClick={() => setStatusTarget("active")}>
                <Play />
                {subscription.status === "draft" ? "Activer" : "Réactiver"}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={terminated} onClick={() => setStatusTarget("terminated")}>
            <Ban />
            Résilier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SubscriptionFormDialog subscription={subscription} open={editOpen} onOpenChange={setEditOpen} />
      <SubscriptionStatusDialog
        subscription={subscription}
        target={statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
      />
    </>
  );
}
