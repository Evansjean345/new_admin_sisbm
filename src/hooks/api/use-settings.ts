"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingService } from "@/services/billing.service";
import { settingsService } from "@/services/settings.service";
import type {
  EmailPayload,
  GeneralSettings,
  ReferentialKind,
  SmsGatewayPayload,
  TechnicalSettings,
} from "@/types/settings";

import { queryKeys } from "./query-keys";

export const useGeneralSettings = () =>
  useQuery({ queryKey: queryKeys.settings.general, queryFn: () => settingsService.getGeneral() });
export const useSmsGatewaySettings = () =>
  useQuery({ queryKey: queryKeys.settings.sms, queryFn: () => settingsService.getSms() });
export const useEmailSettings = () =>
  useQuery({ queryKey: queryKeys.settings.email, queryFn: () => settingsService.getEmail() });
export const useReferential = (kind: ReferentialKind) =>
  useQuery({ queryKey: queryKeys.settings.referential(kind), queryFn: () => settingsService.getReferential(kind) });
export const useTechnicalSettings = () =>
  useQuery({ queryKey: queryKeys.settings.technical, queryFn: () => settingsService.getTechnical() });
export const useSettingsHistory = () =>
  useQuery({ queryKey: queryKeys.settings.history, queryFn: () => settingsService.history() });
/** Surveillance des services : rafraîchie toutes les 60 s. */
export const useServiceHealth = () =>
  useQuery({ queryKey: queryKeys.settings.health, queryFn: () => settingsService.health(), refetchInterval: 60_000 });

function useSettingsMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.billing.paymentMethods }),
      ]),
  });
}

export const useSaveGeneralSettings = () => useSettingsMutation((v: GeneralSettings) => settingsService.saveGeneral(v));
export const useSaveSmsGateway = () => useSettingsMutation((v: SmsGatewayPayload) => settingsService.saveSms(v));
export const useTestSmsGateway = () => useSettingsMutation(() => settingsService.testSms());
export const useSaveEmailSettings = () => useSettingsMutation((v: EmailPayload) => settingsService.saveEmail(v));
export const useTestEmail = () => useSettingsMutation((to: string) => settingsService.testEmail(to));
export const useSaveTechnicalSettings = () =>
  useSettingsMutation((v: TechnicalSettings) => settingsService.saveTechnical(v));
export const useRunBackup = () => useSettingsMutation(() => settingsService.runBackup());
export const useAddReferentialItem = () =>
  useSettingsMutation(({ kind, label, parentId }: { kind: ReferentialKind; label: string; parentId?: string }) =>
    settingsService.addReferentialItem(kind, label, parentId),
  );
export const useUpdateReferentialItem = () =>
  useSettingsMutation(
    ({ kind, id, patch }: { kind: ReferentialKind; id: string; patch: { label?: string; active?: boolean } }) =>
      settingsService.updateReferentialItem(kind, id, patch),
  );
export const useAddPaymentMethod = () => useSettingsMutation((label: string) => billingService.addPaymentMethod(label));
export const useUpdatePaymentMethod = () =>
  useSettingsMutation(({ id, patch }: { id: string; patch: { label?: string; active?: boolean } }) =>
    billingService.updatePaymentMethod(id, patch),
  );
