import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { Subscription } from "@/types/subscription";

/** Journal de la souscription, du plus récent au plus ancien. Jamais modifié. */
export function HistoryTab({ subscription }: { subscription: Subscription }) {
  const events = [...subscription.history].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique</CardTitle>
        <CardDescription>Création, modifications, changements de statut et mouvements de véhicules.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative flex flex-col gap-5 border-l pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative flex flex-col gap-0.5">
              <span aria-hidden="true" className="-left-[25px] absolute top-1.5 size-2 rounded-full bg-primary" />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-sm">{e.action}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDateTime(e.at)} · {e.actor}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">{e.description}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
