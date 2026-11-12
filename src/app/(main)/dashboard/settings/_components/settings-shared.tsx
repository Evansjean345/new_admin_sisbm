"use client";

import { useState } from "react";

import { History, KeyRound, Lock } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSettingsHistory } from "@/hooks/api/use-settings";
import { formatDateTime } from "@/lib/format";
import type { ConnectionStatus } from "@/types/settings";

/**
 * Secret en ÉCRITURE SEULE (§VII.2) : l'écran sait seulement qu'un secret existe.
 * « Remplacer » ouvre la saisie ; laisser vide conserve le secret enregistré.
 */
export function SecretField({
  id,
  label,
  hasSecret,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hasSecret: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(!hasSecret);
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {editing ? (
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasSecret ? "Nouvelle valeur (laisser vide pour conserver)" : "Saisir la clé"}
        />
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-md border bg-muted/40 px-3 text-muted-foreground text-sm">
            <Lock className="size-3.5" />
            Enregistré et chiffré
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <KeyRound data-icon="inline-start" />
            Remplacer
          </Button>
        </div>
      )}
      <FieldDescription>Jamais affiché ni renvoyé par l'API, ni écrit dans les journaux.</FieldDescription>
    </Field>
  );
}

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") return <StatusBadge tone="success">Connectée</StatusBadge>;
  if (status === "error") return <StatusBadge tone="danger">Erreur de connexion</StatusBadge>;
  return <StatusBadge tone="neutral">Non testée</StatusBadge>;
}

/** Historique des modifications de configuration (§VII.3), filtré par section. */
export function SettingsHistoryCard({ section }: { section?: string }) {
  const history = useSettingsHistory();
  const rows = (history.data ?? []).filter((h) => !section || h.section === section).slice(0, 10);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          Modifications récentes
        </CardTitle>
        <CardDescription>Toute modification de configuration est historisée.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune modification depuis l'ouverture de la session.</p>
        ) : (
          <ol className="flex flex-col gap-3 border-l pl-4">
            {rows.map((h) => (
              <li key={h.id} className="text-sm">
                <p>{h.description}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(h.at)} · {h.actor}
                  {section ? "" : ` · ${h.section}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
