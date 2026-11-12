import { InvoiceDetail } from "./_components/invoice-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}
