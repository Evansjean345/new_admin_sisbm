"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { alertingService } from "@/services/alerting.service";
import type {
  AlertListParams,
  NotificationConfigPayload,
  NotificationTemplatePayload,
  PersonRef,
  SendNotificationPayload,
  SmsListParams,
} from "@/types/alerting";

import { queryKeys } from "./query-keys";

export function useAlerts(params: AlertListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.alerting.alerts(params),
    queryFn: () => alertingService.listAlerts(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useAlertStats() {
  return useQuery({ queryKey: queryKeys.alerting.alertStats, queryFn: () => alertingService.alertStats() });
}

export function useNotificationConfigs() {
  return useQuery({ queryKey: queryKeys.alerting.configs, queryFn: () => alertingService.listConfigs() });
}

export function useSmsMessages(params: SmsListParams = {}) {
  return useQuery({
    queryKey: queryKeys.alerting.sms(params),
    queryFn: () => alertingService.listSms(params),
    placeholderData: keepPreviousData,
  });
}

export function useSmsStats() {
  return useQuery({ queryKey: queryKeys.alerting.smsStats, queryFn: () => alertingService.smsStats() });
}

export function useNotificationTemplates() {
  return useQuery({ queryKey: queryKeys.alerting.templates, queryFn: () => alertingService.listTemplates() });
}

/** Alertes et incidents sont liés : toute écriture rafraîchit les deux. */
function useAlertingMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.alerting.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.incidents.all }),
      ]),
  });
}

export const useAcknowledgeAlert = () => useAlertingMutation((id: string) => alertingService.acknowledge(id));
export const useAssignAlert = () =>
  useAlertingMutation(({ id, assignee }: { id: string; assignee: PersonRef }) => alertingService.assign(id, assignee));
export const useResolveAlert = () =>
  useAlertingMutation(({ id, note }: { id: string; note: string }) => alertingService.resolve(id, note));
export const useSendAlertNotification = () =>
  useAlertingMutation((payload: SendNotificationPayload) => alertingService.sendNotification(payload));
export const useSaveNotificationConfig = () =>
  useAlertingMutation(({ payload, id }: { payload: NotificationConfigPayload; id?: string }) =>
    alertingService.saveConfig(payload, id),
  );
export const useToggleNotificationConfig = () =>
  useAlertingMutation(({ id, active }: { id: string; active: boolean }) => alertingService.toggleConfig(id, active));
export const useSaveNotificationTemplate = () =>
  useAlertingMutation(({ payload, id }: { payload: NotificationTemplatePayload; id?: string }) =>
    alertingService.saveTemplate(payload, id),
  );

export function useAlert(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.alerting.alert(id ?? ""),
    queryFn: () => alertingService.getAlert(id as string),
    enabled: Boolean(id),
  });
}
