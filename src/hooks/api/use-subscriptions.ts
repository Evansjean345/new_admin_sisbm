"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { subscriptionService } from "@/services/subscription.service";
import type {
  CreateSubscriptionPayload,
  SubscriptionListParams,
  SubscriptionStatus,
  UpdateSubscriptionPayload,
} from "@/types/subscription";

import { queryKeys } from "./query-keys";

export function useSubscriptions(params: SubscriptionListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.subscriptions.list(params),
    queryFn: () => subscriptionService.list(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useSubscription(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.subscriptions.detail(id ?? ""),
    queryFn: () => subscriptionService.get(id as string),
    enabled: Boolean(id),
  });
}

/** Véhicules déjà affectés à une souscription active (un véhicule = une affectation). */
export function useVehicleAvailability(enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscriptions.availability,
    queryFn: () => subscriptionService.availability(),
    enabled,
  });
}

/** Toutes les affectations d'un véhicule (en cours et clôturées). */
export function useVehicleSubscriptionHistory(vehicleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.subscriptions.vehicleHistory(vehicleId ?? ""),
    queryFn: () => subscriptionService.vehicleHistory(vehicleId as string),
    enabled: Boolean(vehicleId),
  });
}

/** Toute écriture invalide les souscriptions ET les offres (compteurs). */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.offers.all }),
    ]);
}

export function useCreateSubscription() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: CreateSubscriptionPayload) => subscriptionService.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateSubscription() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSubscriptionPayload }) =>
      subscriptionService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetSubscriptionStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: SubscriptionStatus; reason: string }) =>
      subscriptionService.setStatus(id, status, reason),
    onSuccess: invalidate,
  });
}

export function useAssignSubscriptionVehicles() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, vehicleIds }: { id: string; vehicleIds: string[] }) =>
      subscriptionService.assignVehicles(id, vehicleIds),
    onSuccess: invalidate,
  });
}

export function useRemoveSubscriptionVehicle() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, vehicleId, reason }: { id: string; vehicleId: string; reason: string }) =>
      subscriptionService.removeVehicle(id, vehicleId, reason),
    onSuccess: invalidate,
  });
}

export function useTransferSubscriptionVehicle() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: { id: string; vehicleId: string; targetId: string; effectiveDate: string }) =>
      subscriptionService.transferVehicle(args.id, args.vehicleId, args.targetId, args.effectiveDate),
    onSuccess: invalidate,
  });
}
