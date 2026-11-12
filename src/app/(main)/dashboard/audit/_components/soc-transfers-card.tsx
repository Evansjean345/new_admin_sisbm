"use client";

import { Download, Send, ShieldCheck } from "lucide-react";

import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSocHistory } from "@/hooks/api/use-soc";
import { formatDateTime } from "@/lib/format";
import { socFormatMeta } from "@/lib/soc-formats";

const statusMeta = {
  success: { label: "Transmis", tone: "success" },
  truncated: { label: "Tronqué", tone: "warning" },
  failed: { label: "Échec", tone: "danger" },
} as const;

/** Traçabilité des sorties du journal vers le SOC (qui, quand, quelle période, combien). */
export function SocTransfersCard() {
  const history = useSocHistory();
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Transferts vers le SOC
        </CardTitle>
        <CardDescription>Chaque export ou envoi du journal est tracé.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {history.isPending ? (
          <LoadingRows rows={3} />
        ) : history.isError ? (
          <div className="px-4">
            <ErrorState error={history.error} onRetry={() => history.refetch()} />
          </div>
        ) : history.data.length === 0 ? (
          <div className="px-4">
            <EmptyState icon={<ShieldCheck />} title="Aucun transfert" description="Utilisez « Transférer au SOC »." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="hidden md:table-cell">Période</TableHead>
                  <TableHead className="hidden sm:table-cell">Format</TableHead>
                  <TableHead className="text-right">Événements</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{formatDateTime(t.at)}</span>
                        <span className="text-muted-foreground text-xs">{t.actor}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {t.mode === "push" ? <Send className="size-3.5" /> : <Download className="size-3.5" />}
                        {t.mode === "push" ? "Envoi" : "Téléchargement"}
                      </span>
                      {t.destination ? (
                        <span className="block max-w-56 truncate text-muted-foreground text-xs" title={t.destination}>
                          {t.destination}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground text-xs md:table-cell">
                      {formatDateTime(t.from)} → {formatDateTime(t.to)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{socFormatMeta[t.format].label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.count}
                      <span className="block text-muted-foreground text-xs">{t.sizeKb} Ko</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={statusMeta[t.status].tone}>{statusMeta[t.status].label}</StatusBadge>
                      {t.detail ? (
                        <span className="block max-w-56 truncate text-muted-foreground text-xs" title={t.detail}>
                          {t.detail}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
