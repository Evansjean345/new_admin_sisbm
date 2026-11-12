"use client";

import { useMemo, useState } from "react";

import { ListChecks, ScrollText, Send, ShieldAlert } from "lucide-react";

import { MetricCard, metricGridClass } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuditActions, useAuditLogs } from "@/hooks/api/use-audit-logs";
import { AUDIT_DEFAULT_WINDOW_DAYS } from "@/types/audit";

import { AuditLogPanel } from "../../_components/audit/audit-log-panel";
import { SocTransferDialog } from "./soc-transfer-dialog";
import { SocTransfersCard } from "./soc-transfers-card";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Zone d'audit — journal global.
 *
 * Le périmètre visible est décidé par l'API : un administrateur client voit
 * SON organisation, l'exploitant plateforme voit toutes les organisations.
 * L'écran n'a donc rien à cloisonner, seulement à afficher ce qu'il reçoit.
 */
export function AuditScreen() {
  const from = useMemo(() => new Date(Date.now() - AUDIT_DEFAULT_WINDOW_DAYS * DAY_MS).toISOString(), []);

  // Compteurs d'en-tête : une seule ligne demandée, seul `meta.total` compte.
  const total = useAuditLogs({ from, page: 1, perPage: 1 });
  const commands = useAuditLogs({ from, page: 1, perPage: 1, resourceType: "device_command" });
  const actions = useAuditActions({ from });
  const [socOpen, setSocOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Zone d'audit"
        description="Journal append-only des actes réalisés sur la plateforme. Lecture seule, fenêtre glissante de 30 jours par défaut."
        actions={
          <Button onClick={() => setSocOpen(true)}>
            <Send data-icon="inline-start" />
            Transférer au SOC
          </Button>
        }
      />

      <div className={metricGridClass}>
        <MetricCard
          icon={ScrollText}
          label="Événements"
          value={total.data?.meta.total ?? "—"}
          hint={`Sur les ${AUDIT_DEFAULT_WINDOW_DAYS} derniers jours.`}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Actes de commande"
          value={commands.data?.meta.total ?? "—"}
          hint="Immobilisations et commandes boîtier tracées."
        />
        <MetricCard
          icon={ListChecks}
          label="Types d'actions"
          value={actions.data?.data.length ?? "—"}
          hint="Nomenclature observée sur la période."
        />
      </div>

      <AuditLogPanel source={{ scope: "global" }} showOrganization />

      <SocTransfersCard />
      <SocTransferDialog open={socOpen} onOpenChange={setSocOpen} />
    </div>
  );
}
