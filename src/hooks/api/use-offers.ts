"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { offerService } from "@/services/offer.service";
import type { CreateOfferPayload, OfferListParams, UpdateOfferPayload } from "@/types/offer";

import { queryKeys } from "./query-keys";

export function useOfferFeatures() {
  return useQuery({
    queryKey: queryKeys.offers.features,
    queryFn: () => offerService.features(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useOffers(params: OfferListParams = {}) {
  return useQuery({
    queryKey: queryKeys.offers.list(params),
    queryFn: () => offerService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useOffer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offers.detail(id ?? ""),
    queryFn: () => offerService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOfferPayload) => offerService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.offers.all }),
  });
}

export function useUpdateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOfferPayload }) => offerService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.offers.all }),
  });
}

export function useDeleteOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => offerService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.offers.all }),
  });
}
