import { InvoiceForm } from "../../_components/invoice-form";

/** Modification d'un brouillon (une facture émise ne se modifie pas). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceForm invoiceId={id} />;
}
