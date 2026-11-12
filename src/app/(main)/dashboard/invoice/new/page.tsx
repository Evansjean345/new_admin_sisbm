import { InvoiceForm } from "../_components/invoice-form";

/** Écran 3 — création. `?subscriptionId=` préremplit depuis la souscription. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ subscriptionId?: string | string[] }>;
}) {
  const { subscriptionId } = await searchParams;
  return <InvoiceForm subscriptionId={typeof subscriptionId === "string" ? subscriptionId : undefined} />;
}
