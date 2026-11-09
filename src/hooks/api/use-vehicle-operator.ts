"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { vehicleOperatorService } from "@/services/vehicle-operator.service";

import { queryKeys } from "./query-keys";

export function useVehicleOperator(vehicleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.vehicleOperators.detail(vehicleId ?? ""),
    queryFn: () => vehicleOperatorService.get(vehicleId as string),
    enabled: Boolean(vehicleId),
  });
}

export function useSetVehicleOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      vehicleId,
      operator,
    }: {
      vehicleId: string;
      operator: { organizationId: string; organizationName: string } | null;
    }) => vehicleOperatorService.set(vehicleId, operator),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vehicleOperators.all }),
  });
}
