"use client";

import { useState } from "react";

import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePaymentMethods } from "@/hooks/api/use-billing";
import {
  useAddPaymentMethod,
  useAddReferentialItem,
  useReferential,
  useUpdatePaymentMethod,
  useUpdateReferentialItem,
} from "@/hooks/api/use-settings";
import { getErrorMessage } from "@/lib/axios";
import type { ReferentialItem, ReferentialKind } from "@/types/settings";

import { SettingsHistoryCard } from "../../_components/settings-shared";

const TABS: Array<{ key: ReferentialKind | "paymentMethods"; label: string; hint: string }> = [
  { key: "brands", label: "Marques et modèles", hint: "Proposés à la création d'un véhicule." },
  { key: "vehicleTypes", label: "Types de véhicules", hint: "Voiture, camion, citerne…" },
  { key: "eventCategories", label: "Catégories d'événements", hint: "Classement des événements GPS et des alertes." },
  { key: "incidentCategories", label: "Catégories d'incidents", hint: "Proposées à la création d'un incident." },
  {
    key: "paymentMethods",
    label: "Modes de paiement",
    hint: "Espèces, virement, Mobile Money, chèque et autres moyens.",
  },
];

/** Écran 5 — Référentiels (§VII.2) : listes paramétrables sans modifier le code. */
export function Referentials() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Référentiels"
        description="Listes de valeurs utilisées par les autres modules. Désactiver un élément le masque des nouvelles saisies sans toucher à l'historique."
      />
      <Alert>
        <AlertTitle>Pas de suppression</AlertTitle>
        <AlertDescription>
          Un élément déjà utilisé (véhicule, incident, paiement…) ne peut pas être supprimé : on le désactive. Son code
          reste fixe ; seul le libellé se modifie.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 xl:grid-cols-3">
        <Tabs defaultValue="brands" className="gap-4 xl:col-span-2">
          <div className="overflow-x-auto">
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <Card>
                <CardHeader>
                  <CardTitle>{t.label}</CardTitle>
                  <CardDescription>{t.hint}</CardDescription>
                </CardHeader>
                <CardContent>
                  {t.key === "paymentMethods" ? <PaymentMethods /> : <ReferentialList kind={t.key} />}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        <SettingsHistoryCard section="Référentiels" />
      </div>
    </div>
  );
}

function AddRow({
  placeholder,
  onAdd,
  pending,
}: {
  placeholder: string;
  onAdd: (label: string) => void;
  pending: boolean;
}) {
  const [label, setLabel] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onAdd(label.trim());
        setLabel("");
      }}
    >
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <Button type="submit" variant="outline" disabled={pending || !label.trim()}>
        <Plus data-icon="inline-start" />
        Ajouter
      </Button>
    </form>
  );
}

function ItemRow({
  item,
  onRename,
  onToggle,
  indent = false,
}: {
  item: { id: string; code?: string; label: string; active: boolean };
  onRename: (label: string) => void;
  onToggle: (active: boolean) => void;
  indent?: boolean;
}) {
  const [label, setLabel] = useState(item.label);
  return (
    <div className={`flex items-center gap-3 py-2 ${indent ? "pl-6" : ""}`}>
      <Input
        className="h-8 flex-1"
        value={label}
        aria-label={`Libellé de ${item.label}`}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label.trim() && label !== item.label && onRename(label.trim())}
      />
      {item.code ? (
        <span className="hidden w-32 truncate font-mono text-muted-foreground text-xs sm:block">{item.code}</span>
      ) : null}
      <Switch checked={item.active} onCheckedChange={onToggle} aria-label={item.active ? "Désactiver" : "Activer"} />
    </div>
  );
}

function ReferentialList({ kind }: { kind: ReferentialKind }) {
  const list = useReferential(kind);
  const add = useAddReferentialItem();
  const update = useUpdateReferentialItem();
  const [open, setOpen] = useState<string | null>(null);
  const handlers = (msg: string) => ({
    onSuccess: () => toast.success(msg),
    onError: (e: unknown) => toast.error("Action impossible", { description: getErrorMessage(e) }),
  });

  if (list.isPending) return <LoadingRows rows={4} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;

  const row = (item: ReferentialItem, indent = false) => (
    <ItemRow
      key={item.id}
      item={item}
      indent={indent}
      onRename={(label) => update.mutate({ kind, id: item.id, patch: { label } }, handlers("Libellé modifié"))}
      onToggle={(active) =>
        update.mutate(
          { kind, id: item.id, patch: { active } },
          handlers(active ? "Élément réactivé" : "Élément désactivé"),
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <AddRow
        placeholder={kind === "brands" ? "Nouvelle marque" : "Nouvel élément"}
        pending={add.isPending}
        onAdd={(label) => add.mutate({ kind, label }, handlers("Élément ajouté"))}
      />
      <div className="flex flex-col divide-y">
        {list.data.map((item) =>
          kind === "brands" ? (
            <div key={item.id} className="py-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-expanded={open === item.id}
                  aria-label={`Modèles de ${item.label}`}
                  onClick={() => setOpen(open === item.id ? null : item.id)}
                >
                  <ChevronRight
                    className={open === item.id ? "rotate-90 transition-transform" : "transition-transform"}
                  />
                </Button>
                <div className="flex-1">{row(item)}</div>
                <span className="w-20 text-right text-muted-foreground text-xs">
                  {item.children?.length ?? 0} modèles
                </span>
              </div>
              {open === item.id ? (
                <div className="flex flex-col gap-1 pb-2 pl-8">
                  {(item.children ?? []).map((m) => row(m, true))}
                  <div className="pl-6">
                    <AddRow
                      placeholder={`Nouveau modèle ${item.label}`}
                      pending={add.isPending}
                      onAdd={(label) => add.mutate({ kind, label, parentId: item.id }, handlers("Modèle ajouté"))}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            row(item)
          ),
        )}
      </div>
    </div>
  );
}

function PaymentMethods() {
  const methods = usePaymentMethods();
  const add = useAddPaymentMethod();
  const update = useUpdatePaymentMethod();
  const handlers = (msg: string) => ({
    onSuccess: () => toast.success(msg),
    onError: (e: unknown) => toast.error("Action impossible", { description: getErrorMessage(e) }),
  });
  if (methods.isPending) return <LoadingRows rows={4} />;
  if (methods.isError) return <ErrorState error={methods.error} onRetry={() => methods.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <AddRow
        placeholder="Nouveau mode (ex. : Wave, Orange Money…)"
        pending={add.isPending}
        onAdd={(l) => add.mutate(l, handlers("Mode ajouté"))}
      />
      <div className="flex flex-col divide-y">
        {methods.data.map((m) => (
          <ItemRow
            key={m.id}
            item={m}
            onRename={(label) => update.mutate({ id: m.id, patch: { label } }, handlers("Libellé modifié"))}
            onToggle={(active) =>
              update.mutate({ id: m.id, patch: { active } }, handlers(active ? "Mode réactivé" : "Mode désactivé"))
            }
          />
        ))}
      </div>
    </div>
  );
}
