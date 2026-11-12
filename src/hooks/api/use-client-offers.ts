"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clientOfferService } from "@/services/client-offer.service";
import type { AssignClientOfferPayload, ClientOfferListParams } from "@/types/client-offer";

import { queryKeys } from "./query-keys";

export function useClientOffers(params: ClientOfferListParams = {}) {
  return useQuery({
    queryKey: queryKeys.clientOffers.list(params),
    queryFn: () => clientOfferService.list(params),
  });
}

/** Offre du client ; `null` = aucune offre, donc aucune permission attribuable. */
export function useClientOffer(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientOffers.ofUser(userId ?? ""),
    queryFn: () => clientOfferService.get(userId as string),
    enabled: Boolean(userId),
  });
}

/** Une attribution peut créer une souscription : on rafraîchit aussi souscriptions et offres. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.clientOffers.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.offers.all }),
    ]);
}

export function useAssignClientOffer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: AssignClientOfferPayload) => clientOfferService.assign(payload),
    onSuccess: invalidate,
  });
}

export function useUnassignClientOffer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (userId: string) => clientOfferService.unassign(userId),
    onSuccess: invalidate,
  });
}
