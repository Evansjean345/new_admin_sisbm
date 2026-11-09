"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { roleAdminService } from "@/services/role-admin.service";
import type { RoleDefinitionPayload } from "@/types/permission";

import { queryKeys } from "./query-keys";

export function useRoleDefinitions() {
  return useQuery({
    queryKey: queryKeys.roles.definitions,
    queryFn: () => roleAdminService.list(),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.definitions });
}

export function useCreateRoleDefinition() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: RoleDefinitionPayload) => roleAdminService.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateRoleDefinition() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RoleDefinitionPayload> }) =>
      roleAdminService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteRoleDefinition() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => roleAdminService.remove(id),
    onSuccess: invalidate,
  });
}
