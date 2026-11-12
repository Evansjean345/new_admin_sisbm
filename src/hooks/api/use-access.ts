"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { accessService } from "@/services/access.service";
import type { MfaMethod, UserScopePayload } from "@/types/access";

const KEYS = {
  all: ["access"] as const,
  scope: (userId: string) => ["access", "scope", userId] as const,
  scopes: (ids: string[]) => ["access", "scopes", ids] as const,
  mfa: (userId: string) => ["access", "mfa", userId] as const,
  mfaMany: (ids: string[]) => ["access", "mfa-many", ids] as const,
};

export const useUserScope = (userId: string | undefined) =>
  useQuery({
    queryKey: KEYS.scope(userId ?? ""),
    queryFn: () => accessService.getScope(userId as string),
    enabled: Boolean(userId),
  });

export const useUserScopes = (userIds: string[]) =>
  useQuery({
    queryKey: KEYS.scopes(userIds),
    queryFn: () => accessService.getScopes(userIds),
    enabled: userIds.length > 0,
    placeholderData: keepPreviousData,
  });

export const useMfaStatus = (userId: string | undefined, roleCode: string | null | undefined) =>
  useQuery({
    queryKey: [...KEYS.mfa(userId ?? ""), roleCode ?? ""],
    queryFn: () => accessService.getMfa(userId as string, roleCode),
    enabled: Boolean(userId),
  });

export const useMfaStatuses = (users: Array<{ id: string; roleCode?: string | null }>) =>
  useQuery({
    queryKey: [...KEYS.mfaMany(users.map((u) => u.id)), users.map((u) => u.roleCode ?? "")],
    queryFn: () => accessService.getMfaMany(users),
    enabled: users.length > 0,
    placeholderData: keepPreviousData,
  });

function useAccessMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.all }) });
}

export const useSetUserScope = () =>
  useAccessMutation(({ userId, payload }: { userId: string; payload: UserScopePayload }) =>
    accessService.setScope(userId, payload),
  );
export const useEnrollMfa = () =>
  useAccessMutation(({ userId, email }: { userId: string; email: string }) => accessService.enroll(userId, email));
export const useVerifyMfa = () =>
  useAccessMutation(({ userId, code, method }: { userId: string; code: string; method?: MfaMethod }) =>
    accessService.verify(userId, code, method),
  );
export const useResetMfa = () => useAccessMutation((userId: string) => accessService.resetMfa(userId));
