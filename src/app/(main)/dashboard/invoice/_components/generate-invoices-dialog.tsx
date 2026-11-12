"use client";

import { useEffect, useState } from "react";

import { CircleCheck, CircleMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useGenerateInvoices } from "@/hooks/api/use-billing";
import { getErrorMessage } from "@/lib/axios";
import type { GenerateInvoicesResult } from "@/types/billing";

/**
 * Génération automatique (§II.3) : une facture par souscription active dont un cycle commence
 * dans le mois choisi. Les périodes déjà facturées sont ignorées (règle 9).
 */
export function GenerateInvoicesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [month, setMonth] = useState("");
  const [issue, setIssue] = useState(false);
  const [result, setResult] = useState<GenerateInvoicesResult | null>(null);
  const generate = useGenerateInvoices();

  useEffect(() => {
    if (open) {
      setMonth(new Date().toISOString().slice(0, 7));
      setIssue(false);
      setResult(null);
    }
  }, [open]);

  function submit() {
    generate.mutate(
      { month: `${month}-01`, issue },
      {
        onSuccess: (res) => {
          setResult(res);
          if (res.created.length > 0) {
            toast.success(
              `${res.created.length} facture${res.created.length > 1 ? "s" : ""} générée${res.created.length > 1 ? "s" : ""}`,
            );
          }
        },
        onError: (error) => toast.error("Génération impossible", { description: getErrorMessage(error) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !generate.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Générer les factures du mois</DialogTitle>
          <DialogDescription>
            Une facture par souscription active dont la période commence ce mois-ci, au tarif de la souscription et au
            prorata des affectations de véhicules.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-medium">
              {result.created.length} créée{result.created.length > 1 ? "s" : ""}, {result.skipped.length} ignorée
              {result.skipped.length > 1 ? "s" : ""}.
            </p>
            <ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-lg border">
              {result.created.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">{c.label}</span>
                </li>
              ))}
              {result.skipped.map((s) => (
                <li key={s.subscriptionReference} className="flex items-start gap-2 px-3 py-2">
                  <CircleMinus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="font-mono text-xs">{s.subscriptionReference}</span>
                    <span className="text-muted-foreground"> — {s.reason}</span>
                  </span>
                </li>
              ))}
              {result.created.length + result.skipped.length === 0 ? (
                <li className="px-3 py-2 text-muted-foreground">
                  Aucune souscription n'a de période qui commence ce mois.
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <FieldGroup className="gap-4">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="generate-month">Mois à facturer</FieldLabel>
              <Input id="generate-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="generate-issue" checked={issue} onCheckedChange={(v) => setIssue(v === true)} />
              <FieldLabel htmlFor="generate-issue" className="font-normal">
                Émettre directement (sinon brouillons à vérifier)
              </FieldLabel>
            </Field>
            <FieldDescription>
              Recommandé : générer des brouillons, les vérifier, puis les émettre. Une facture émise ne se modifie plus.
            </FieldDescription>
          </FieldGroup>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          ) : (
            <>
              <Button variant="outline" disabled={generate.isPending} onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button disabled={generate.isPending || !month} onClick={submit}>
                {generate.isPending ? <Spinner data-icon="inline-start" /> : null}
                Générer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
