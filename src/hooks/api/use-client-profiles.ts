"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clientProfileService } from "@/services/client-profile.service";
import type { UpdateClientProfilePayload } from "@/types/client-profile";

import { queryKeys } from "./query-keys";

export function useClientProfile(organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientProfiles.detail(organizationId ?? ""),
    queryFn: () => clientProfileService.get(organizationId as string),
    enabled: Boolean(organizationId),
  });
}

/** Fiches des organisations affichées dans une liste. */
export function useClientProfiles(organizationIds: string[]) {
  return useQuery({
    queryKey: queryKeys.clientProfiles.many(organizationIds),
    queryFn: () => clientProfileService.many(organizationIds),
    enabled: organizationIds.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useUpdateClientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, payload }: { organizationId: string; payload: UpdateClientProfilePayload }) =>
      clientProfileService.update(organizationId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clientProfiles.all }),
  });
}
