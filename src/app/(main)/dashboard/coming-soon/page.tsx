import Link from "next/link";

import { Construction } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Page d'attente des écrans prévus par les spécifications mais pas encore développés. */
export default async function Page({ searchParams }: { searchParams: Promise<{ module?: string | string[] }> }) {
  const { module } = await searchParams;
  const name = typeof module === "string" && module.trim() ? module.trim() : null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
        <Construction className="size-6" />
      </div>
      <h1 className="font-semibold text-2xl">{name ?? "Écran en préparation"}</h1>
      <p className="max-w-md text-muted-foreground text-sm">
        {name ? "Cet écran est prévu par les spécifications SuperAdmin" : "Cet écran"} et sera disponible dans une
        prochaine version.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/default" prefetch={false}>
          Retour au tableau de bord
        </Link>
      </Button>
    </div>
  );
}
