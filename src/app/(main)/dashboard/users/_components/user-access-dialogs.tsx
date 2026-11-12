"use client";

import { useEffect, useState } from "react";

import { X } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResetMfa, useSetUserScope, useUserScope } from "@/hooks/api/use-access";
import { useCurrentUser } from "@/hooks/api/use-auth";
import { useGroups } from "@/hooks/api/use-groups";
import { useOrganizationRoles } from "@/hooks/api/use-organizations";
import { useUpdateUser } from "@/hooks/api/use-users";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { getErrorMessage } from "@/lib/axios";
import type { ScopeMode } from "@/types/access";
import type { User } from "@/types/user";

type Props = { user: User | null; onOpenChange: (open: boolean) => void };

/**
 * Attribution d'un rôle (§VI.3). Seuls les rôles « attribuables » renvoyés par l'API sont proposés,
 * et l'on ne peut pas modifier son propre rôle (pas d'auto-attribution de privilèges, §VI.4).
 */
export function AssignRoleDialog({ user, onOpenChange }: Props) {
  const roles = useOrganizationRoles(user?.organizationId);
  const update = useUpdateUser();
  const { data: me } = useCurrentUser();
  const [roleId, setRoleId] = useState("");
  useEffect(() => {
    if (user) setRoleId(user.roleId);
  }, [user]);
  if (!user) return null;
  const isSelf = me?.id === user.id;
  const options = (roles.data ?? []).filter((r) => r.assignable || r.id === user.roleId);

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Attribuer un rôle à ${user.fullName}`}
      description="Le nouveau rôle s'applique à la prochaine requête de l'utilisateur. Le changement est journalisé."
      confirmLabel="Attribuer"
      loading={update.isPending}
      onConfirm={() => {
        if (isSelf) {
          toast.error("Action interdite", { description: "Vous ne pouvez pas modifier votre propre rôle." });
          return;
        }
        if (roleId === user.roleId) {
          onOpenChange(false);
          return;
        }
        update.mutate(
          { id: user.id, payload: { roleId } },
          {
            onSuccess: () => {
              toast.success("Rôle attribué", { description: options.find((r) => r.id === roleId)?.name });
              onOpenChange(false);
            },
            onError: (e) => toast.error("Attribution impossible", { description: getErrorMessage(e) }),
          },
        );
      }}
    >
      <Field className="gap-1.5">
        <FieldLabel htmlFor="assign-role">Rôle</FieldLabel>
        <Select value={roleId} onValueChange={setRoleId} disabled={isSelf || roles.isPending}>
          <SelectTrigger id="assign-role" className="w-full">
            <SelectValue placeholder={roles.isPending ? "Chargement…" : "Choisir un rôle"} />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {options.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>
          {isSelf
            ? "Vous ne pouvez pas modifier votre propre rôle."
            : "Seuls les rôles que vous êtes autorisé à attribuer sont proposés."}
        </FieldDescription>
      </Field>
    </ConfirmDialog>
  );
}

const MODE_LABELS: Record<ScopeMode, { label: string; hint: string }> = {
  organization: { label: "Toute l'organisation", hint: "Tous les véhicules, conducteurs et données du client." },
  vehicle_groups: { label: "Groupes de véhicules", hint: "Uniquement les véhicules des groupes choisis." },
  vehicles: { label: "Véhicules précis", hint: "Uniquement les véhicules choisis un par un." },
};

/** Groupe ou périmètre autorisé d'un utilisateur client (§VI.2, écran 2). */
export function ScopeDialog({ user, onOpenChange }: Props) {
  const scope = useUserScope(user?.id);
  const save = useSetUserScope();
  const groups = useGroups(
    "vehicle_group",
    { organizationId: user?.organizationId, perPage: 100 },
    { enabled: Boolean(user) },
  );
  const vehicles = useVehicles({ organizationId: user?.organizationId, perPage: 100 }, { enabled: Boolean(user) });
  const [mode, setMode] = useState<ScopeMode>("organization");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);

  useEffect(() => {
    if (!scope.data) return;
    setMode(scope.data.mode);
    setGroupIds(scope.data.groupIds);
    setVehicleIds(scope.data.vehicleIds);
  }, [scope.data]);

  if (!user) return null;
  const groupRows = groups.data?.data ?? [];
  const vehicleRows = vehicles.data?.data ?? [];

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Périmètre de ${user.fullName}`}
      description={`Données de ${user.organization?.name ?? "son organisation"} auxquelles ce compte a accès. Il ne voit jamais celles d'un autre client.`}
      confirmLabel="Enregistrer"
      loading={save.isPending}
      onConfirm={() =>
        save.mutate(
          {
            userId: user.id,
            payload: {
              mode,
              groupIds,
              groupNames: groupIds.map((id) => groupRows.find((g) => g.id === id)?.name ?? "Groupe"),
              vehicleIds,
              vehicleLabels: vehicleIds.map((id) => vehicleRows.find((v) => v.id === id)?.registration ?? "Véhicule"),
            },
          },
          {
            onSuccess: () => {
              toast.success("Périmètre enregistré", { description: MODE_LABELS[mode].label });
              onOpenChange(false);
            },
            onError: (e) => toast.error("Enregistrement impossible", { description: getErrorMessage(e) }),
          },
        )
      }
    >
      <FieldGroup className="gap-4">
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ScopeMode)} className="gap-2">
          {(Object.keys(MODE_LABELS) as ScopeMode[]).map((m) => (
            <Field key={m} orientation="horizontal" className="items-start rounded-md border p-2.5">
              <RadioGroupItem value={m} id={`scope-${m}`} />
              <FieldLabel htmlFor={`scope-${m}`} className="flex flex-col items-start gap-0.5 font-normal">
                <span className="font-medium">{MODE_LABELS[m].label}</span>
                <span className="text-muted-foreground text-xs">{MODE_LABELS[m].hint}</span>
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>

        {mode === "vehicle_groups" ? (
          <Picker
            label="Groupes de véhicules"
            empty="Ce client n'a aucun groupe de véhicules."
            options={groupRows.map((g) => ({ id: g.id, label: `${g.name} (${g.membersCount})` }))}
            value={groupIds}
            onChange={setGroupIds}
          />
        ) : null}
        {mode === "vehicles" ? (
          <Picker
            label="Véhicules"
            empty="Ce client n'a aucun véhicule."
            options={vehicleRows.map((v) => ({ id: v.id, label: v.registration }))}
            value={vehicleIds}
            onChange={setVehicleIds}
          />
        ) : null}
      </FieldGroup>
    </ConfirmDialog>
  );
}

function Picker({
  label,
  empty,
  options,
  value,
  onChange,
}: {
  label: string;
  empty: string;
  options: Array<{ id: string; label: string }>;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {options.length === 0 ? (
        <FieldDescription>{empty}</FieldDescription>
      ) : (
        <Select value="" onValueChange={(id) => !value.includes(id) && onChange([...value, id])}>
          <SelectTrigger className="w-full" aria-label={`Ajouter : ${label}`}>
            <SelectValue placeholder="Ajouter…" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-64">
            <SelectGroup>
              {options
                .filter((o) => !value.includes(o.id))
                .map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
      <div className="flex flex-wrap gap-1.5">
        {value.map((id) => (
          <Badge key={id} variant="secondary" className="gap-1">
            {options.find((o) => o.id === id)?.label ?? "…"}
            <button type="button" aria-label="Retirer" onClick={() => onChange(value.filter((x) => x !== id))}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    </Field>
  );
}

/** Réinitialisation de la MFA d'un autre compte (appareil perdu). */
export function ResetMfaDialog({ user, onOpenChange }: Props) {
  const reset = useResetMfa();
  if (!user) return null;
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Réinitialiser la MFA de ${user.fullName} ?`}
      description="L'application d'authentification enregistrée est oubliée. À sa prochaine connexion, l'utilisateur devra en configurer une nouvelle. L'opération est journalisée."
      confirmLabel="Réinitialiser"
      destructive
      loading={reset.isPending}
      onConfirm={() =>
        reset.mutate(user.id, {
          onSuccess: () => {
            toast.success("MFA réinitialisée", { description: user.email });
            onOpenChange(false);
          },
          onError: (e) => toast.error("Réinitialisation impossible", { description: getErrorMessage(e) }),
        })
      }
    />
  );
}
