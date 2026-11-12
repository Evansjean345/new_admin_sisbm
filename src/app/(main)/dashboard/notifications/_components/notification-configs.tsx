"use client";

import { useState } from "react";

import { BellPlus, FlaskConical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { channelLabels, eventTypeLabels, severityMeta, weekDayLabels } from "@/components/alerting-labels";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNotificationConfigs, useToggleNotificationConfig } from "@/hooks/api/use-alerting";
import { getErrorMessage } from "@/lib/axios";
import type { NotificationConfig, SendingWindow } from "@/types/alerting";

import { NotificationConfigDialog } from "./notification-config-dialog";

function windowLabel(w: SendingWindow): string {
  if (w.always) return "24 h/24, 7 j/7";
  const days = w.days.length === 7 ? "Tous les jours" : w.days.map((d) => weekDayLabels[d - 1]).join(", ");
  return `${days}, ${w.from}–${w.to}`;
}

/** Écran 2 — Configuration des notifications (§IV.2). */
export function NotificationConfigs() {
  const configs = useNotificationConfigs();
  const toggle = useToggleNotificationConfig();
  const [editing, setEditing] = useState<{ open: boolean; config: NotificationConfig | null }>({
    open: false,
    config: null,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Configuration des notifications"
        description="Qui prévenir, par quel canal et quand, pour chaque type d'événement."
        actions={
          <Button onClick={() => setEditing({ open: true, config: null })}>
            <Plus data-icon="inline-start" />
            Nouvelle configuration
          </Button>
        }
      />
      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>Configurations simulées : aucune notification réelle n'est déclenchée.</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="px-0">
          {configs.isPending ? (
            <LoadingRows rows={4} />
          ) : configs.isError ? (
            <div className="px-4">
              <ErrorState error={configs.error} onRetry={() => configs.refetch()} />
            </div>
          ) : configs.data.length === 0 ? (
            <div className="px-4">
              <EmptyState
                icon={<BellPlus />}
                title="Aucune configuration"
                description="Créez la première règle de diffusion."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Événement</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead className="hidden lg:table-cell">Destinataires</TableHead>
                    <TableHead className="hidden sm:table-cell">Canaux</TableHead>
                    <TableHead className="hidden xl:table-cell">Horaires</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Modifier</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{eventTypeLabels[c.trigger]}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.organization?.name ?? "Tous les clients"}
                        <span className="block text-muted-foreground text-xs">
                          {c.vehicleIds.length ? `${c.vehicleIds.length} véhicule(s)` : "Tous les véhicules"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden max-w-52 truncate lg:table-cell">
                        {c.recipients.map((r) => r.label).join(", ")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {c.channels.map((ch) => channelLabels[ch]).join(" + ")}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground text-xs xl:table-cell">
                        {windowLabel(c.window)}
                        <span className="block">Anti-répétition : {c.cooldownMinutes} min</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={severityMeta[c.priority].tone}>{severityMeta[c.priority].label}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.active}
                          aria-label={c.active ? "Désactiver" : "Activer"}
                          onCheckedChange={(active) =>
                            toggle.mutate(
                              { id: c.id, active },
                              {
                                onSuccess: () =>
                                  toast.success(active ? "Configuration activée" : "Configuration désactivée"),
                                onError: (e) => toast.error("Action impossible", { description: getErrorMessage(e) }),
                              },
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Modifier ${c.name}`}
                          onClick={() => setEditing({ open: true, config: c })}
                        >
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <NotificationConfigDialog
        open={editing.open}
        config={editing.config}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
      />
    </div>
  );
}
