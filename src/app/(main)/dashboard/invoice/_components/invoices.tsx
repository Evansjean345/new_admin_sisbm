"use client";

import { useState } from "react";

import Link from "next/link";

import { Download, FlaskConical, Plus, RefreshCw, Search, Sparkles } from "lucide-react";

import { InvoicesTable } from "@/app/(main)/dashboard/_components/billing/invoices-table";
import { OrganizationFilter } from "@/app/(main)/dashboard/_components/organization/organization-select";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { invoiceKindLabels, invoiceStatusMeta } from "@/components/status-labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInvoices } from "@/hooks/api/use-billing";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { downloadCsv } from "@/lib/format";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/types/billing";

import { GenerateInvoicesDialog } from "./generate-invoices-dialog";

const ALL = "all";

/** Dernier jour du mois AAAA-MM. */
function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function Invoices() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | typeof ALL>(ALL);
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [generateOpen, setGenerateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const invoices = useInvoices({
    page,
    perPage,
    search: debouncedSearch || undefined,
    status: status === ALL ? undefined : status,
    organizationId,
    from: month ? `${month}-01` : undefined,
    to: month ? monthEnd(month) : undefined,
  });
  const rows = invoices.data?.data ?? [];
  const resetPage = () => setPage(1);
  const hasFilters = Boolean(debouncedSearch) || status !== ALL || Boolean(organizationId) || Boolean(month);

  function exportCsv() {
    downloadCsv(
      `factures-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((i) => ({
        numero: i.number ?? "BROUILLON",
        type: invoiceKindLabels[i.kind],
        client: i.organization.name,
        souscription: i.subscriptionReference,
        emission: i.issueDate,
        periode: i.periodLabel,
        vehicules: i.vehicleCount,
        montant_ht: i.amountHT,
        taxes: i.taxAmount,
        montant_ttc: i.amountTTC,
        paye: i.paidAmount,
        avoirs: i.creditedAmount,
        reste_a_payer: i.balance,
        echeance: i.dueDate,
        statut: invoiceStatusMeta[i.status].label,
        devise: i.currency,
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Factures"
        description="Factures d'abonnement établies à partir des souscriptions et des véhicules affectés."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download data-icon="inline-start" />
              Exporter
            </Button>
            <Button variant="outline" onClick={() => setGenerateOpen(true)}>
              <Sparkles data-icon="inline-start" />
              Générer
            </Button>
            <Button asChild>
              <Link href="/dashboard/invoice/new" prefetch={false}>
                <Plus data-icon="inline-start" />
                Nouvelle facture
              </Link>
            </Button>
          </>
        }
      />

      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          Les factures sont calculées à partir des souscriptions simulées, en attendant l'API de facturation. Elles sont
          perdues au rechargement.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <InputGroup className="md:max-w-md">
          <InputGroupInput
            placeholder="N° de facture, client, souscription, période…"
            aria-label="Rechercher une facture"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
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
              resetPage();
            }}
          />
          <Input
            type="month"
            aria-label="Mois d'émission"
            className="h-8 w-40"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              resetPage();
            }}
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as InvoiceStatus | typeof ALL);
              resetPage();
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Statut :</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectItem value={ALL}>Tous</SelectItem>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {invoiceStatusMeta[s].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => invoices.refetch()} disabled={invoices.isFetching}>
            <RefreshCw data-icon="inline-start" className={invoices.isFetching ? "animate-spin" : undefined} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          <InvoicesTable
            query={invoices}
            emptyDescription={
              hasFilters ? "Aucun résultat pour ces filtres." : "Créez une facture ou générez celles du mois."
            }
            emptyAction={
              hasFilters ? undefined : (
                <Button size="sm" onClick={() => setGenerateOpen(true)}>
                  <Sparkles data-icon="inline-start" />
                  Générer les factures du mois
                </Button>
              )
            }
          />
          {rows.length > 0 ? (
            <PaginationBar
              meta={invoices.data?.meta}
              perPage={perPage}
              label="factures"
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                resetPage();
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <GenerateInvoicesDialog open={generateOpen} onOpenChange={setGenerateOpen} />
    </div>
  );
}
