"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingService } from "@/services/billing.service";
import type {
  BillingStatsParams,
  GenerateInvoicesPayload,
  InvoiceDraftPayload,
  InvoiceListParams,
  PaymentListParams,
  RecordPaymentPayload,
  ReminderListParams,
  SendRemindersPayload,
} from "@/types/billing";

import { queryKeys } from "./query-keys";

// ── Lectures ─────────────────────────────────────────────────────────────────

export function useInvoices(params: InvoiceListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.billing.invoices(params),
    queryFn: () => billingService.listInvoices(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.billing.invoice(id ?? ""),
    queryFn: () => billingService.getInvoice(id as string),
    enabled: Boolean(id),
  });
}

export function useBillingStats(params: BillingStatsParams = {}) {
  return useQuery({
    queryKey: queryKeys.billing.stats(params),
    queryFn: () => billingService.stats(params),
    placeholderData: keepPreviousData,
  });
}

/** Préremplissage d'une facture depuis la souscription (période vide = cycle en cours). */
export function useInvoicePreview(subscriptionId: string | undefined, periodStart?: string, periodEnd?: string) {
  return useQuery({
    queryKey: queryKeys.billing.preview(subscriptionId ?? "", periodStart, periodEnd),
    queryFn: () => billingService.preview(subscriptionId as string, periodStart, periodEnd),
    enabled: Boolean(subscriptionId),
    placeholderData: keepPreviousData,
  });
}

export function useBillingContactEmail(organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.billing.contactEmail(organizationId ?? ""),
    queryFn: () => billingService.contactEmail(organizationId as string),
    enabled: Boolean(organizationId),
  });
}

export function usePayments(params: PaymentListParams = {}) {
  return useQuery({
    queryKey: queryKeys.billing.payments(params),
    queryFn: () => billingService.listPayments(params),
    placeholderData: keepPreviousData,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: queryKeys.billing.paymentMethods,
    queryFn: () => billingService.paymentMethods(),
    staleTime: 5 * 60_000,
  });
}

export function useReminders(params: ReminderListParams = {}) {
  return useQuery({
    queryKey: queryKeys.billing.reminders(params),
    queryFn: () => billingService.listReminders(params),
    placeholderData: keepPreviousData,
  });
}

// ── Écritures ────────────────────────────────────────────────────────────────

/** Toute écriture change soldes, statuts ou relances : on rafraîchit tout le module. */
function useInvalidateBilling() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
}

function useBillingMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const invalidate = useInvalidateBilling();
  return useMutation({ mutationFn: fn, onSuccess: invalidate });
}

export function useCreateInvoice() {
  return useBillingMutation((payload: InvoiceDraftPayload) => billingService.createInvoice(payload));
}

export function useUpdateInvoiceDraft() {
  return useBillingMutation(({ id, payload }: { id: string; payload: InvoiceDraftPayload }) =>
    billingService.updateDraft(id, payload),
  );
}

export function useIssueInvoice() {
  return useBillingMutation((id: string) => billingService.issue(id));
}

export function useCancelInvoice() {
  return useBillingMutation(({ id, reason }: { id: string; reason: string }) => billingService.cancel(id, reason));
}

export function useCreateCreditNote() {
  return useBillingMutation(({ id, amount, reason }: { id: string; amount: number; reason: string }) =>
    billingService.createCreditNote(id, amount, reason),
  );
}

export function useEmailInvoice() {
  return useBillingMutation(({ id, to }: { id: string; to: string }) => billingService.emailInvoice(id, to));
}

export function useGenerateInvoices() {
  return useBillingMutation((payload: GenerateInvoicesPayload) => billingService.generate(payload));
}

export function useRecordPayment() {
  return useBillingMutation((payload: RecordPaymentPayload) => billingService.recordPayment(payload));
}

export function useCancelPayment() {
  return useBillingMutation(({ id, reason }: { id: string; reason: string }) =>
    billingService.cancelPayment(id, reason),
  );
}

export function useSendReminders() {
  return useBillingMutation((payload: SendRemindersPayload) => billingService.sendReminders(payload));
}

export function useRetryReminder() {
  return useBillingMutation((id: string) => billingService.retryReminder(id));
}
