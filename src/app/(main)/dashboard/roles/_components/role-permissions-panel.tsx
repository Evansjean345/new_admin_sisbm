"use client";

import { useEffect, useMemo, useState } from "react";

import { Building2, Lock, Package, PackagePlus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { AssignOfferDialog } from "@/app/(main)/dashboard/_components/client-offers/assign-offer-dialog";
import { LoadingRows } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/api/use-auth";
import { useClientOffer } from "@/hooks/api/use-client-offers";
import { useOfferFeatures } from "@/hooks/api/use-offers";
import { useUser, useUsers } from "@/hooks/api/use-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getErrorMessage } from "@/lib/axios";
import { buildPermissionTree, fullGrants, normalizeGrants } from "@/lib/permissions";
import type { PermissionGrants, RoleDefinition } from "@/types/permission";
import type { User } from "@/types/user";

import { grantSummary, PermissionEditor } from "./permission-editor";

const PROTECTED_SUPERADMIN_EMAIL = "superadmin@sisbm.ci";

const same = (a: PermissionGrants, b: PermissionGrants) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** Collaborateur SISBM : accès plateforme, pas d'offre. */
function isPlatformUser(user: User) {
  return user.role?.code === "super_admin" || user.email.trim().toLowerCase() === PROTECTED_SUPERADMIN_EMAIL;
}

/**
 * Permissions individuelles d'un utilisateur, préremplies depuis son rôle.
 *
 * Retour de la direction (12/11/2026) : un client doit avoir une offre AVANT qu'on lui attribue
 * des permissions, et seules les fonctionnalités de cette offre sont proposées (sous-fonctionnalités
 * comprises). Les collaborateurs SISBM n'ont pas d'offre : ils voient la matrice complète.
 */
export function RolePermissionsPanel({ roles, initialUserId }: { roles: RoleDefinition[]; initialUserId?: string }) {
  const [userSearch, setUserSearch] = useState("");
  const debouncedSearch = useDebouncedValue(userSearch.trim());
  const users = useUsers({ page: 1, perPage: 100, search: debouncedSearch || undefined });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [savedByUser, setSavedByUser] = useState<Record<string, PermissionGrants>>({});
  const [draft, setDraft] = useState<PermissionGrants>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const features = useOfferFeatures();
  const { data: me } = useCurrentUser();
  // Présélection depuis la liste des utilisateurs (« Modifier les permissions »).
  const preselected = useUser(initialUserId && !selectedUser ? initialUserId : undefined);
  useEffect(() => {
    if (preselected.data && !selectedUser) setSelectedUser(preselected.data as unknown as User);
  }, [preselected.data, selectedUser]);

  const platform = selectedUser ? isPlatformUser(selectedUser) : false;
  /** On ne modifie jamais ses propres permissions (§VI.4). */
  const isSelf = Boolean(selectedUser && me?.id === selectedUser.id);
  const clientOffer = useClientOffer(selectedUser && !platform ? selectedUser.id : undefined);
  const offer = clientOffer.data ?? null;

  const tree = useMemo(() => {
    if (!features.data || !selectedUser) return null;
    if (platform) return buildPermissionTree(features.data);
    if (!offer) return null;
    return buildPermissionTree(features.data, { allowedFeatureKeys: new Set(offer.featureKeys), clientOnly: true });
  }, [features.data, selectedUser, platform, offer]);

  const availableUsers = users.data?.data ?? [];
  const userOptions = useMemo(
    () =>
      selectedUser && !availableUsers.some((user) => user.id === selectedUser.id)
        ? [selectedUser, ...availableUsers]
        : availableUsers,
    [availableUsers, selectedUser],
  );
  const role = selectedUser ? roles.find((item) => item.id === selectedUser.roleId) : undefined;

  const baseline = useMemo<PermissionGrants>(() => {
    if (!selectedUser || !tree) return {};
    if (platform) return fullGrants(tree);
    return normalizeGrants(savedByUser[selectedUser.id] ?? role?.grants ?? {}, tree);
  }, [selectedUser, tree, platform, savedByUser, role]);

  // Recalcule le brouillon quand le compte, son offre ou la matrice changent.
  useEffect(() => {
    setDraft(baseline);
  }, [baseline]);

  const dirty = Boolean(selectedUser && tree && !platform && !isSelf && !same(draft, baseline));
  const summary = grantSummary(draft);

  function selectUser(id: string) {
    const user = userOptions.find((option) => option.id === id);
    if (!user || (dirty && !window.confirm("Abandonner les modifications non enregistrées ?"))) return;
    setSelectedUser(user);
  }

  function save() {
    if (!selectedUser || platform || isSelf) return;
    setSavedByUser((current) => ({ ...current, [selectedUser.id]: draft }));
    toast.success("Permissions enregistrées pour cette session", {
      description: `${selectedUser.fullName} — les changements ne sont pas envoyés à l'API.`,
    });
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
                    {user.fullName} — {user.organization?.name ?? user.email}
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
            Un client doit avoir une offre pour recevoir des permissions ; la matrice ne propose que les fonctionnalités
            de son offre. Le compte Superadmin SISBM est protégé.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid gap-0.5">
                <span className="font-medium">{selectedUser.fullName}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
                  <span>{selectedUser.email}</span>
                  <span>· {role?.name ?? selectedUser.role?.name ?? "Rôle non chargé"}</span>
                  {selectedUser.organization ? (
                    <span className="flex items-center gap-1">
                      · <Building2 className="size-3" /> {selectedUser.organization.name}
                    </span>
                  ) : null}
                </span>
              </div>
              {offer ? (
                <Badge variant="secondary" className="gap-1">
                  <Package className="size-3" />
                  Offre {offer.offer.name}
                </Badge>
              ) : null}
              {tree ? (
                <span className="text-muted-foreground text-sm tabular-nums">
                  {summary.modules} fonctionnalité(s) · {summary.actions} autorisation(s)
                </span>
              ) : null}
            </div>
            {tree && !platform && !isSelf ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
                  <PackagePlus data-icon="inline-start" />
                  Changer d'offre
                </Button>
                <Button variant="outline" size="sm" disabled={!dirty} onClick={() => setDraft(baseline)}>
                  <RotateCcw data-icon="inline-start" />
                  Annuler
                </Button>
                <Button size="sm" disabled={!dirty} onClick={save}>
                  <Save data-icon="inline-start" />
                  Enregistrer
                </Button>
              </div>
            ) : null}
          </div>

          {features.isPending || (!platform && clientOffer.isPending) ? (
            <LoadingRows rows={4} />
          ) : !platform && !offer ? (
            <Alert>
              <PackagePlus />
              <AlertTitle>Aucune offre souscrite</AlertTitle>
              <AlertDescription>
                <p>
                  {selectedUser.fullName} doit d'abord souscrire une offre : les permissions dépendent des
                  fonctionnalités qu'elle inclut.
                </p>
                <Button size="sm" className="mt-2" onClick={() => setAssignOpen(true)}>
                  <PackagePlus data-icon="inline-start" />
                  Attribuer une offre
                </Button>
              </AlertDescription>
            </Alert>
          ) : tree ? (
            <>
              {isSelf ? (
                <Alert variant="destructive">
                  <Lock />
                  <AlertTitle>Vos propres permissions</AlertTitle>
                  <AlertDescription>
                    Un utilisateur ne peut pas s'accorder lui-même des privilèges : demandez à un autre administrateur.
                  </AlertDescription>
                </Alert>
              ) : platform ? (
                <Alert>
                  <Lock />
                  <AlertTitle>Collaborateur SISBM — accès complet et protégé</AlertTitle>
                  <AlertDescription>
                    Toutes les permissions sont accordées et ne peuvent pas être modifiées depuis cette page.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Package />
                  <AlertTitle>Fonctionnalités de l'offre {offer?.offer.name}</AlertTitle>
                  <AlertDescription>
                    Seules les fonctionnalités incluses dans l'offre sont proposées ; les modules réservés à SISBM
                    (facturation, catalogue, paramètres…) sont masqués. Enregistrement temporaire, pas encore envoyé à
                    l'API.
                  </AlertDescription>
                </Alert>
              )}
              <PermissionEditor tree={tree} grants={draft} onChange={platform || isSelf ? undefined : setDraft} />
              <p className="text-muted-foreground text-xs">
                Chaque action est indépendante. La ligne d'une fonctionnalité agit sur toutes ses sous-fonctionnalités ;
                « Tout » active ou retire toutes les actions de la ligne.
              </p>
            </>
          ) : null}
        </>
      )}

      <AssignOfferDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        preset={selectedUser ? { userId: selectedUser.id, organizationId: selectedUser.organizationId } : null}
      />
    </div>
  );
}
