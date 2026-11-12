"use client";

import { useEffect, useState } from "react";

import { createPortal } from "react-dom";

import { formatMoney } from "@/app/(main)/dashboard/_components/subscriptions/subscription-utils";
import { invoiceKindLabels } from "@/components/status-labels";
import { formatDate } from "@/lib/format";
import type { Invoice } from "@/types/billing";

/**
 * Impression / PDF d'une facture.
 *
 * En attendant le module de génération PDF côté serveur, on imprime une page A4 dédiée
 * (styles `[data-print-root]` de globals.css) : « Enregistrer au format PDF » dans la boîte
 * d'impression du navigateur produit le fichier.
 */
export function usePrintInvoice() {
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!invoice) return;
    const previousTitle = document.title;
    document.title = invoice.number ?? "facture-brouillon";
    // Laisse React monter le portail avant d'ouvrir la boîte d'impression.
    const timer = window.setTimeout(() => window.print(), 50);
    const done = () => {
      document.title = previousTitle;
      setInvoice(null);
    };
    window.addEventListener("afterprint", done, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      document.title = previousTitle;
    };
  }, [invoice]);

  return {
    print: setInvoice,
    portal: invoice ? <InvoicePrintPortal invoice={invoice} /> : null,
  };
}

function InvoicePrintPortal({ invoice }: { invoice: Invoice }) {
  return createPortal(
    <div data-print-root>
      <InvoiceDocument invoice={invoice} />
    </div>,
    document.body,
  );
}

/** Mise en page papier (couleurs fixes : un document imprimé ne suit pas le thème). */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const money = (n: number) => formatMoney(n, invoice.currency);
  return (
    <article
      data-print-paper
      className="flex min-h-[11in] w-[8.5in] flex-col gap-8 bg-white px-12 py-10 text-neutral-900 text-sm"
    >
      <header className="flex items-start justify-between gap-8">
        <div>
          <p className="font-bold text-2xl tracking-tight">SISBM</p>
          <p className="text-neutral-500">SISBM CORE — Gestion de flotte et télématique</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-xl uppercase tracking-widest">
            {invoice.status === "draft" ? "Facture (brouillon)" : "Facture"}
          </p>
          <p className="font-mono">{invoice.number ?? "Non émise"}</p>
          {invoice.kind !== "standard" ? <p className="text-neutral-500">{invoiceKindLabels[invoice.kind]}</p> : null}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8">
        <div>
          <p className="mb-1 font-semibold text-neutral-500 text-xs uppercase">Facturé à</p>
          <p className="font-medium">{invoice.organization.name}</p>
          <p className="text-neutral-500">Code client : {invoice.organization.code}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-right">
          <dt className="text-neutral-500">Date d'émission</dt>
          <dd>{formatDate(invoice.issueDate)}</dd>
          <dt className="text-neutral-500">Échéance</dt>
          <dd>{formatDate(invoice.dueDate)}</dd>
          <dt className="text-neutral-500">Période facturée</dt>
          <dd>{invoice.periodLabel}</dd>
          <dt className="text-neutral-500">Souscription</dt>
          <dd className="font-mono">{invoice.subscriptionReference}</dd>
          <dt className="text-neutral-500">Offre</dt>
          <dd>{invoice.offer.name}</dd>
        </dl>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100 text-left text-xs uppercase">
            <th className="px-2 py-2">Véhicule</th>
            <th className="px-2 py-2">Période</th>
            <th className="px-2 py-2 text-right">Jours</th>
            <th className="px-2 py-2 text-right">Tarif unitaire</th>
            <th className="px-2 py-2 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id} className="border-neutral-200 border-b">
              <td className="px-2 py-1.5">
                <span className="font-mono">{l.registration}</span>
                {l.label ? <span className="text-neutral-500"> · {l.label}</span> : null}
              </td>
              <td className="px-2 py-1.5">
                {formatDate(l.startDate)} → {formatDate(l.endDate)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {l.days}/{l.periodDays}
              </td>
              <td className="px-2 py-1.5 text-right">{money(l.unitPrice)}</td>
              <td className="px-2 py-1.5 text-right">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ml-auto grid w-80 grid-cols-[1fr_auto] gap-x-6 gap-y-1">
        <span>
          Sous-total ({invoice.vehicleCount} véhicule{invoice.vehicleCount > 1 ? "s" : ""})
        </span>
        <span className="text-right">{money(invoice.subtotal)}</span>
        {invoice.discountAmount > 0 ? (
          <>
            <span>Remise {invoice.discountPercent} %</span>
            <span className="text-right">− {money(invoice.discountAmount)}</span>
          </>
        ) : null}
        <span className="font-medium">Montant HT</span>
        <span className="text-right font-medium">{money(invoice.amountHT)}</span>
        <span>TVA {invoice.taxRate} %</span>
        <span className="text-right">{money(invoice.taxAmount)}</span>
        <span className="border-neutral-900 border-t-2 pt-1 font-semibold uppercase">Total TTC</span>
        <span className="border-neutral-900 border-t-2 pt-1 text-right font-semibold">{money(invoice.amountTTC)}</span>
        {invoice.paidAmount > 0 || invoice.creditedAmount > 0 ? (
          <>
            <span className="text-neutral-500">Déjà réglé / avoirs</span>
            <span className="text-right text-neutral-500">− {money(invoice.paidAmount + invoice.creditedAmount)}</span>
            <span className="font-semibold">Reste à payer</span>
            <span className="text-right font-semibold">{money(invoice.balance)}</span>
          </>
        ) : null}
      </section>

      {invoice.observations ? (
        <section>
          <p className="mb-1 font-semibold text-neutral-500 text-xs uppercase">Observations</p>
          <p className="whitespace-pre-line">{invoice.observations}</p>
        </section>
      ) : null}

      <footer className="mt-auto border-neutral-200 border-t pt-3 text-neutral-500 text-xs">
        Paiement à réception, au plus tard le {formatDate(invoice.dueDate)}. Merci de rappeler le numéro de facture dans
        la référence de votre règlement.
      </footer>
    </article>
  );
}
