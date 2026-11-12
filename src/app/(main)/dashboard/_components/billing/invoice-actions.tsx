"use client";

import { useState } from "react";

import Link from "next/link";

import { Ban, Banknote, Download, Eye, FileMinus, Mail, MoreVertical, Pencil, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Invoice } from "@/types/billing";

import { CancelInvoiceDialog, CreditNoteDialog, EmailInvoiceDialog, IssueInvoiceDialog } from "./invoice-dialogs";
import { usePrintInvoice } from "./invoice-print";
import { RecordPaymentDialog } from "./record-payment-dialog";

type Action = "issue" | "cancel" | "credit" | "email" | "pay";

/** Ce qu'autorise le statut de la facture (§II.3 et règle 6). */
export function invoiceCapabilities(invoice: Invoice) {
  const draft = invoice.status === "draft";
  const issued = !draft && invoice.status !== "cancelled";
  return {
    edit: draft,
    issue: draft,
    pay: issued && invoice.balance > 0,
    credit: issued && invoice.balance > 0,
    email: issued,
    cancel: invoice.status !== "cancelled" && invoice.status !== "paid",
  };
}

/**
 * Actions d'une facture et leurs dialogues. `variant="menu"` = menu ⋮ d'une ligne de tableau ;
 * `variant="toolbar"` = boutons de la fiche facture.
 */
export function InvoiceActions({ invoice, variant = "menu" }: { invoice: Invoice; variant?: "menu" | "toolbar" }) {
  const [action, setAction] = useState<Action | null>(null);
  const { print, portal } = usePrintInvoice();
  const can = invoiceCapabilities(invoice);
  const close = (open: boolean) => !open && setAction(null);
  const target = (a: Action) => (action === a ? invoice : null);

  const dialogs = (
    <>
      <IssueInvoiceDialog invoice={target("issue")} onOpenChange={close} />
      <CancelInvoiceDialog invoice={target("cancel")} onOpenChange={close} />
      <CreditNoteDialog invoice={target("credit")} onOpenChange={close} />
      <EmailInvoiceDialog invoice={target("email")} onOpenChange={close} />
      <RecordPaymentDialog open={action === "pay"} onOpenChange={close} invoice={action === "pay" ? invoice : null} />
      {portal}
    </>
  );

  if (variant === "toolbar") {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          {can.edit ? (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/invoice/${invoice.id}/edit`} prefetch={false}>
                <Pencil data-icon="inline-start" />
                Modifier
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => print(invoice)}>
            <Download data-icon="inline-start" />
            PDF
          </Button>
          {can.email ? (
            <Button variant="outline" onClick={() => setAction("email")}>
              <Mail data-icon="inline-start" />
              Envoyer
            </Button>
          ) : null}
          {can.credit ? (
            <Button variant="outline" onClick={() => setAction("credit")}>
              <FileMinus data-icon="inline-start" />
              Avoir
            </Button>
          ) : null}
          {can.cancel ? (
            <Button variant="outline" onClick={() => setAction("cancel")}>
              <Ban data-icon="inline-start" />
              {can.issue ? "Abandonner" : "Annuler"}
            </Button>
          ) : null}
          {can.issue ? (
            <Button onClick={() => setAction("issue")}>
              <Send data-icon="inline-start" />
              Émettre
            </Button>
          ) : null}
          {can.pay ? (
            <Button onClick={() => setAction("pay")}>
              <Banknote data-icon="inline-start" />
              Enregistrer un paiement
            </Button>
          ) : null}
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${invoice.number ?? "le brouillon"}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/invoice/${invoice.id}`} prefetch={false}>
                <Eye />
                Voir la facture
              </Link>
            </DropdownMenuItem>
            {can.edit ? (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/invoice/${invoice.id}/edit`} prefetch={false}>
                  <Pencil />
                  Modifier le brouillon
                </Link>
              </DropdownMenuItem>
            ) : null}
            {can.issue ? (
              <DropdownMenuItem onClick={() => setAction("issue")}>
                <Send />
                Émettre
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => print(invoice)}>
              <Download />
              Télécharger le PDF
            </DropdownMenuItem>
            {can.email ? (
              <DropdownMenuItem onClick={() => setAction("email")}>
                <Mail />
                Envoyer par e-mail
              </DropdownMenuItem>
            ) : null}
            {can.pay ? (
              <DropdownMenuItem onClick={() => setAction("pay")}>
                <Banknote />
                Enregistrer un paiement
              </DropdownMenuItem>
            ) : null}
            {can.credit ? (
              <DropdownMenuItem onClick={() => setAction("credit")}>
                <FileMinus />
                Émettre un avoir
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          {can.cancel ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setAction("cancel")}>
                <Ban />
                {can.issue ? "Abandonner le brouillon" : "Annuler la facture"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}
