"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type SocDestination, socService } from "@/services/soc.service";
import type { AuditLogListParams } from "@/types/audit";

import { queryKeys } from "./query-keys";

export function useSocDestination() {
  return useQuery({ queryKey: queryKeys.soc.destination, queryFn: () => socService.getDestination() });
}

export function useSocHistory() {
  return useQuery({ queryKey: queryKeys.soc.history, queryFn: () => socService.history() });
}

function useInvalidateSoc() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.soc.all });
}

export function useSaveSocDestination() {
  const invalidate = useInvalidateSoc();
  return useMutation({
    mutationFn: (d: Omit<SocDestination, "updatedAt">) => socService.saveDestination(d),
    onSuccess: invalidate,
  });
}

export function usePushToSoc() {
  const invalidate = useInvalidateSoc();
  return useMutation({
    mutationFn: (params: AuditLogListParams & { from: string; to: string }) => socService.push(params),
    onSuccess: invalidate,
  });
}

/** Téléchargement : collecte des événements réels puis journalisation de la sortie. */
export function useInvalidateSocHistory() {
  return useInvalidateSoc();
}
