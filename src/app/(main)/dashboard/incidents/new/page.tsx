import { IncidentForm } from "../_components/incident-form";

/** Écran 3 — `?alertId=` préremplit depuis une alerte. */
export default async function Page({ searchParams }: { searchParams: Promise<{ alertId?: string | string[] }> }) {
  const { alertId } = await searchParams;
  return <IncidentForm alertId={typeof alertId === "string" ? alertId : undefined} />;
}
