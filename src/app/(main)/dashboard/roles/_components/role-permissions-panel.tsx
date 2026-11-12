"use client";

import { useMemo, useState } from "react";

import { Lock, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsers } from "@/hooks/api/use-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getErrorMessage } from "@/lib/axios";
import { PERMISSION_ACTIONS, PERMISSION_MODULES, type PermissionGrants, type RoleDefinition } from "@/types/permission";
import type { User } from "@/types/user";

import { grantSummary, PermissionEditor } from "./permission-editor";

const PROTECTED_SUPERADMIN_EMAIL = "superadmin@sisbm.ci";

const ALL_PERMISSIONS: PermissionGrants = Object.fromEntries(
  PERMISSION_MODULES.map((module) => [module.key, [...PERMISSION_ACTIONS]]),
);

const same = (a: PermissionGrants, b: PermissionGrants) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

function isProtectedSuperadmin(user: User) {
  return user.email.trim().toLowerCase() === PROTECTED_SUPERADMIN_EMAIL;
}

function initialGrants(user: User, roles: RoleDefinition[]): PermissionGrants {
  if (isProtectedSuperadmin(user)) return ALL_PERMISSIONS;
  return roles.find((role) => role.id === user.roleId)?.grants ?? {};
}

/** Permissions individuelles du compte sélectionné, préremplies depuis son rôle. */
export function RolePermissionsPanel({ roles }: { roles: RoleDefinition[] }) {
  const [userSearch, setUserSearch] = useState("");
  const debouncedSearch = useDebouncedValue(userSearch.trim());
  const users = useUsers({ page: 1, perPage: 100, search: debouncedSearch || undefined });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [savedByUser, setSavedByUser] = useState<Record<string, PermissionGrants>>({});
  const [draft, setDraft] = useState<PermissionGrants>({});

  const availableUsers = users.data?.data ?? [];
  const userOptions = useMemo(
    () =>
      selectedUser && !availableUsers.some((user) => user.id === selectedUser.id)
        ? [selectedUser, ...availableUsers]
        : availableUsers,
    [availableUsers, selectedUser],
  );
  const role = selectedUser ? roles.find((item) => item.id === selectedUser.roleId) : undefined;
  const protectedUser = selectedUser ? isProtectedSuperadmin(selectedUser) : false;
  const baseline = selectedUser ? (savedByUser[selectedUser.id] ?? initialGrants(selectedUser, roles)) : {};
  const dirty = Boolean(selectedUser && !protectedUser && !same(draft, baseline));
  const summary = selectedUser ? grantSummary(draft) : null;

  function selectUser(id: string) {
    const user = userOptions.find((option) => option.id === id);
    if (!user || (dirty && !window.confirm("Abandonner les modifications non enregistrées ?"))) return;
    setSelectedUser(user);
    setDraft(savedByUser[user.id] ?? initialGrants(user, roles));
  }

  function save() {
    if (!selectedUser || protectedUser) return;
    setSavedByUser((current) => ({ ...current, [selectedUser.id]: draft }));
    toast.success("Permissions enregistrées pour cette session", {
      description: `${selectedUser.fullName} — les changements ne sont pas envoyés à l’API.`,
    });
  }

  function reset() {
    if (!selectedUser) return;
    setDraft(baseline);
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Field>
          <FieldLabel htmlFor="permissions-user-search">Rechercher un utilisateur</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="permissions-user-search"
              placeholder="Nom ou adresse e-mail"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
            />
          </InputGroup>
        </Field>
        <Field data-disabled={users.isFetching || users.isError}>
          <FieldLabel htmlFor="permissions-user-select">Utilisateur</FieldLabel>
          <Select value={selectedUser?.id} onValueChange={selectUser} disabled={users.isFetching || users.isError}>
            <SelectTrigger id="permissions-user-select" className="w-full">
              <SelectValue placeholder="Sélectionner un utilisateur" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {userOptions.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName} — {user.email}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {users.isFetching ? <p className="text-muted-foreground text-xs">Recherche des utilisateurs…</p> : null}
          {users.data?.data.length === 0 ? (
            <p className="text-muted-foreground text-xs">Aucun utilisateur trouvé.</p>
          ) : null}
        </Field>
      </FieldGroup>

      {users.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Utilisateurs indisponibles</AlertTitle>
          <AlertDescription>{getErrorMessage(users.error)}</AlertDescription>
        </Alert>
      ) : null}

      {!selectedUser ? (
        <Alert>
          <Lock />
          <AlertTitle>Sélectionnez un utilisateur</AlertTitle>
          <AlertDescription>
            Les permissions du compte s’afficheront après sélection. Le compte Superadmin SISBM est protégé.
          </AlertDescription>
        </Alert>
      ) : null}

      {selectedUser && summary ? (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid gap-0.5">
                <span className="font-medium">{selectedUser.fullName}</span>
                <span className="text-muted-foreground text-xs">
                  {selectedUser.email} · {role?.name ?? selectedUser.role?.name ?? "Rôle non chargé"}
                </span>
              </div>
              <span className="text-muted-foreground text-sm tabular-nums">
                {summary.modules} module(s) · {summary.actions} autorisation(s)
              </span>
            </div>
            {protectedUser ? null : (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled={!dirty} onClick={reset}>
                  <RotateCcw data-icon="inline-start" />
                  Annuler
                </Button>
                <Button size="sm" disabled={!dirty} onClick={save}>
                  <Save data-icon="inline-start" />
                  Enregistrer
                </Button>
              </div>
            )}
          </div>

          {protectedUser ? (
            <Alert>
              <Lock />
              <AlertTitle>Superadmin SISBM — accès complet et protégé</AlertTitle>
              <AlertDescription>
                Toutes les permissions sont accordées et ne peuvent pas être modifiées depuis cette page.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>Permissions individuelles — mode démonstration</AlertTitle>
              <AlertDescription>
                Les droits de {selectedUser.fullName} sont initialisés à partir de son rôle quand il est disponible,
                puis modifiables sans changer ceux des autres utilisateurs. L’enregistrement est temporaire et n’est pas
                encore envoyé à l’API.
              </AlertDescription>
            </Alert>
          )}

          <PermissionEditor grants={draft} onChange={protectedUser ? undefined : setDraft} />
          <p className="text-muted-foreground text-xs">
            Chaque action est indépendante. « Tout » active ou retire toutes les actions de la ligne.
          </p>
        </>
      ) : null}
    </div>
  );
}
