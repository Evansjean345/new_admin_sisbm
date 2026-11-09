import { SubscriptionDetail } from "./_components/subscription-detail";

/** Page serveur : lit les paramètres, puis délègue à la fiche (composant client). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubscriptionDetail id={id} />;
}
