"use client";

import { useState } from "react";

import Link from "next/link";

import { Download, History, Mail, MessageSquare, RefreshCw, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import {
  OrganizationCell,
  OrganizationFilter,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { reminderChannelLabels, reminderLevelMeta, reminderSendStatusMeta } from "@/components/status-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReminders, useRetryReminder } from "@/hooks/api/use-billing";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getErrorMessage } from "@/lib/axios";
import { downloadCsv, formatDateTime } from "@/lib/format";
import { REMINDER_CHANNELS, type ReminderChannel, type ReminderSendStatus } from "@/types/billing";

const ALL = "all";

/** Écran 5 — historique des relances (client, facture, montant dû, retard, canal, date, statut d'envoi). */
export function ReminderHistory() {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ReminderChannel | typeof ALL>(ALL);
  const [sendStatus, setSendStatus] = useState<ReminderSendStatus | typeof ALL>(ALL);
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const debouncedSearch = useDebouncedValue(search.trim());
  const retry = useRetryReminder();

  const reminders = useReminders({
    page,
    perPage,
    search: debouncedSearch || undefined,
    channel: channel === ALL ? undefined : channel,
    sendStatus: sendStatus === ALL ? undefined : sendStatus,
    organizationId,
  });
  const rows = reminders.data?.data ?? [];
  const hasFilters = Boolean(debouncedSearch) || Boolean(organizationId) || channel !== ALL || sendStatus !== ALL;

  function exportCsv() {
    downloadCsv(
      `relances-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r) => ({
        date: r.sentAt,
        client: r.organization.name,
        facture: r.invoiceNumber,
        montant_du: r.amountDue,
        devise: r.currency,
        jours_de_retard: r.daysOverdue,
        niveau: reminderLevelMeta(r.level).label,
        canal: reminderChannelLabels[r.channel],
        destinataire: r.recipient,
        statut_envoi: reminderSendStatusMeta[r.sendStatus].label,
        erreur: r.error ?? "",
        envoye_par: r.sentBy,
        message: r.message,
      })),
    );
  }

  function onRetry(id: string) {
    retry.mutate(id, {
      onSuccess: (r) =>
        r.sendStatus === "sent"
          ? toast.success("Relance renvoyée", { description: r.recipient })
          : toast.error("Nouvel échec", { description: r.error ?? undefined }),
      onError: (error) => toast.error("Renvoi impossible", { description: getErrorMessage(error) }),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <InputGroup className="md:max-w-md">
          <InputGroupInput
            placeholder="Rechercher par facture ou client…"
            aria-label="Rechercher une relance"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          <OrganizationFilter
            value={organizationId}
            onChange={(id) => {
              setOrganizationId(id);
              setPage(1);
            }}
          />
          <Select
            value={channel}
            onValueChange={(v) => {
              setChannel(v as ReminderChannel | typeof ALL);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Canal :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Tous</SelectItem>
                {REMINDER_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {reminderChannelLabels[c]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={sendStatus}
            onValueChange={(v) => {
              setSendStatus(v as ReminderSendStatus | typeof ALL);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Envoi :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Tous</SelectItem>
                <SelectItem value="sent">{reminderSendStatusMeta.sent.label}</SelectItem>
                <SelectItem value="failed">{reminderSendStatusMeta.failed.label}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => reminders.refetch()} disabled={reminders.isFetching}>
            <RefreshCw data-icon="inline-start" className={reminders.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download data-icon="inline-start" />
            Exporter
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          <HistoryBody
            query={reminders}
            hasFilters={hasFilters}
            retryingId={retry.isPending ? retry.variables : undefined}
            onRetry={onRetry}
          />
          {rows.length > 0 ? (
            <PaginationBar
              meta={reminders.data?.meta}
              perPage={perPage}
              label="relances"
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryBody({
  query,
  hasFilters,
  retryingId,
  onRetry,
}: {
  query: ReturnType<typeof useReminders>;
  hasFilters: boolean;
  retryingId: string | undefined;
  onRetry: (id: string) => void;
}) {
  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) {
    return (
      <div className="px-4">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }
  const rows = query.data.data;
  if (rows.length === 0) {
    return (
      <div className="px-4">
        <EmptyState
          icon={<History />}
          title="Aucune relance"
          description={hasFilters ? "Aucun résultat pour ces filtres." : "Les relances envoyées apparaîtront ici."}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="**:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
        <TableHeader>
          <TableRow>
            <TableHead className="hidden md:table-cell">Client</TableHead>
            <TableHead>Facture</TableHead>
            <TableHead className="text-right">Montant dû</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Retard</TableHead>
            <TableHead className="hidden lg:table-cell">Canal</TableHead>
            <TableHead className="hidden lg:table-cell">Date de relance</TableHead>
            <TableHead>Statut d'envoi</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const level = reminderLevelMeta(r.level);
            const send = reminderSendStatusMeta[r.sendStatus];
            const ChannelIcon = r.channel === "sms" ? MessageSquare : Mail;
            return (
              <TableRow key={r.id}>
                <TableCell className="hidden max-w-44 md:table-cell">
                  <OrganizationCell organization={r.organization} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-0.5">
                    <Link
                      href={`/dashboard/invoice/${r.invoiceId}`}
                      prefetch={false}
                      className="font-mono text-xs hover:underline"
                    >
                      {r.invoiceNumber}
                    </Link>
                    <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(r.amountDue, r.currency)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.daysOverdue} j</TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5">
                      <ChannelIcon className="size-4 text-muted-foreground" />
                      {reminderChannelLabels[r.channel]}
                    </span>
                    <span className="max-w-40 truncate text-muted-foreground text-xs" title={r.recipient}>
                      {r.recipient}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-col">
                    <span className="whitespace-nowrap">{formatDateTime(r.sentAt)}</span>
                    <span className="text-muted-foreground text-xs">{r.sentBy}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-0.5">
                    <StatusBadge tone={send.tone}>{send.label}</StatusBadge>
                    {r.error ? (
                      <span className="max-w-52 truncate text-destructive text-xs" title={r.error}>
                        {r.error}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {r.sendStatus === "failed" ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Renvoyer la relance ${r.invoiceNumber}`}
                      title="Renvoyer"
                      disabled={retryingId === r.id}
                      onClick={() => onRetry(r.id)}
                    >
                      {retryingId === r.id ? <Spinner /> : <RotateCcw />}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
