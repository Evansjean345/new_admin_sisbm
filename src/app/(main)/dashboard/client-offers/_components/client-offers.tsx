"use client";

import { useState } from "react";

import Link from "next/link";

import {
  FlaskConical,
  MoreVertical,
  PackagePlus,
  PackageX,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { AssignOfferDialog } from "@/app/(main)/dashboard/_components/client-offers/assign-offer-dialog";
import {
  OrganizationCell,
  OrganizationFilter,
} from "@/app/(main)/dashboard/_components/organization/organization-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientOffers, useUnassignClientOffer } from "@/hooks/api/use-client-offers";
import { useUsers } from "@/hooks/api/use-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime } from "@/lib/format";
import type { ClientOfferAssignment } from "@/types/client-offer";

type Preset = { userId: string; organizationId: string } | null;

/**
 * Rubrique « Attribution des offres » (retour de la direction, 12/11/2026) :
 * choisir une offre et l'attribuer directement à un client d'une organisation.
 */
export function ClientOffers() {
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [assign, setAssign] = useState<{ open: boolean; preset: Preset }>({ open: false, preset: null });
  const [toRemove, setToRemove] = useState<ClientOfferAssignment | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const assignments = useClientOffers({ organizationId, search: debouncedSearch || undefined });
  const users = useUsers({ organizationId, search: debouncedSearch || undefined, perPage: 100 });
  const unassign = useUnassignClientOffer();

  const assignedIds = new Set((assignments.data ?? []).map((a) => a.userId));
  const withoutOffer = (users.data?.data ?? []).filter((u) => u.role?.code !== "super_admin" && !assignedIds.has(u.id));
  const openAssign = (preset: Preset = null) => setAssign({ open: true, preset });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attribution des offres"
        description="Offre souscrite par chaque client d'une organisation. Sans offre, un client ne peut pas recevoir de permissions."
        actions={
          <Button onClick={() => openAssign()}>
            <PackagePlus data-icon="inline-start" />
            Attribuer une offre
          </Button>
        }
      />

      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          Les clients et organisations sont réels ; les attributions sont simulées en attendant l'API et sont perdues au
          rechargement.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <InputGroup className="md:max-w-md">
          <InputGroupInput
            placeholder="Client, e-mail, organisation, offre…"
            aria-label="Rechercher un client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
          <OrganizationFilter value={organizationId} onChange={setOrganizationId} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => Promise.all([assignments.refetch(), users.refetch()])}
            disabled={assignments.isFetching || users.isFetching}
          >
            <RefreshCw
              data-icon="inline-start"
              className={assignments.isFetching || users.isFetching ? "animate-spin" : undefined}
            />
            Actualiser
          </Button>
        </div>
      </div>

      <Tabs defaultValue="assigned" className="gap-4">
        <TabsList>
          <TabsTrigger value="assigned">Clients avec offre ({assignments.data?.length ?? "…"})</TabsTrigger>
          <TabsTrigger value="missing">Sans offre ({users.data ? withoutOffer.length : "…"})</TabsTrigger>
        </TabsList>

        <TabsContent value="assigned">
          <Card>
            <CardContent className="px-0">
              {assignments.isPending ? (
                <LoadingRows rows={5} />
              ) : assignments.isError ? (
                <div className="px-4">
                  <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />
                </div>
              ) : assignments.data.length === 0 ? (
                <div className="px-4">
                  <EmptyState
                    icon={<PackagePlus />}
                    title="Aucune offre attribuée"
                    description="Attribuez une offre à un client pour pouvoir lui accorder des permissions."
                    action={
                      <Button size="sm" onClick={() => openAssign()}>
                        <PackagePlus data-icon="inline-start" />
                        Attribuer une offre
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead className="hidden md:table-cell">Organisation</TableHead>
                        <TableHead>Offre</TableHead>
                        <TableHead className="hidden lg:table-cell">Souscription</TableHead>
                        <TableHead className="hidden xl:table-cell">Attribuée le</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.data.map((a) => (
                        <TableRow key={a.userId}>
                          <TableCell>
                            <Link
                              href={`/dashboard/users/${a.userId}`}
                              prefetch={false}
                              className="flex flex-col hover:underline"
                            >
                              <span className="font-medium">{a.userName}</span>
                              <span className="text-muted-foreground text-xs">
                                {a.userEmail}
                                {a.roleName ? ` · ${a.roleName}` : ""}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="hidden max-w-48 md:table-cell">
                            <OrganizationCell organization={a.organization} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{a.offer.name}</Badge>
                            <span className="block text-muted-foreground text-xs">
                              {a.featureKeys.length} fonctionnalités
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Link
                              href={`/dashboard/subscriptions/${a.subscriptionId}`}
                              prefetch={false}
                              className="font-mono text-xs hover:underline"
                            >
                              {a.subscriptionReference}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground xl:table-cell">
                            {formatDateTime(a.assignedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${a.userName}`}>
                                    <MoreVertical />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/users/${a.userId}`} prefetch={false}>
                                      <UserRound />
                                      Fiche du client
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href="/dashboard/roles" prefetch={false}>
                                      <ShieldCheck />
                                      Gérer ses permissions
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openAssign({ userId: a.userId, organizationId: a.organizationId })}
                                  >
                                    <PackagePlus />
                                    Changer d'offre
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => setToRemove(a)}>
                                    <PackageX />
                                    Retirer l'offre
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missing">
          <Card>
            <CardContent className="px-0">
              {users.isPending ? (
                <LoadingRows rows={5} />
              ) : users.isError ? (
                <div className="px-4">
                  <ErrorState error={users.error} onRetry={() => users.refetch()} />
                </div>
              ) : withoutOffer.length === 0 ? (
                <div className="px-4">
                  <EmptyState icon={<PackagePlus />} title="Tous les clients ont une offre" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead className="hidden md:table-cell">Organisation</TableHead>
                        <TableHead className="hidden sm:table-cell">Rôle</TableHead>
                        <TableHead className="w-40">
                          <span className="sr-only">Action</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withoutOffer.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/users/${u.id}`}
                              prefetch={false}
                              className="flex flex-col hover:underline"
                            >
                              <span className="font-medium">{u.fullName}</span>
                              <span className="text-muted-foreground text-xs">{u.email}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="hidden max-w-48 md:table-cell">
                            <OrganizationCell organization={u.organization} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{u.role?.name ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssign({ userId: u.id, organizationId: u.organizationId })}
                            >
                              <PackagePlus data-icon="inline-start" />
                              Attribuer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AssignOfferDialog
        open={assign.open}
        onOpenChange={(open) => setAssign((s) => ({ ...s, open }))}
        preset={assign.preset}
      />
      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`Retirer l'offre de ${toRemove?.userName ?? ""} ?`}
        description="Le client ne pourra plus recevoir de permissions tant qu'une nouvelle offre ne lui est pas attribuée. La souscription de l'organisation n'est pas modifiée."
        confirmLabel="Retirer"
        destructive
        loading={unassign.isPending}
        onConfirm={() => {
          if (!toRemove) return;
          unassign.mutate(toRemove.userId, {
            onSuccess: () => {
              toast.success("Offre retirée", { description: toRemove.userName });
              setToRemove(null);
            },
            onError: (error) => toast.error("Retrait impossible", { description: getErrorMessage(error) }),
          });
        }}
      />
    </div>
  );
}
