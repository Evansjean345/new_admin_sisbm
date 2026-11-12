"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { incidentService } from "@/services/incident.service";
import type { PersonRef, Severity } from "@/types/alerting";
import type { Attachment } from "@/types/billing";
import type { CreateIncidentPayload, IncidentListParams, IncidentStatus } from "@/types/incident";

import { queryKeys } from "./query-keys";

export function useIncidents(params: IncidentListParams = {}) {
  return useQuery({
    queryKey: queryKeys.incidents.list(params),
    queryFn: () => incidentService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useIncident(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.incidents.detail(id ?? ""),
    queryFn: () => incidentService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useIncidentStats() {
  return useQuery({ queryKey: queryKeys.incidents.stats, queryFn: () => incidentService.stats() });
}

function useIncidentMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.incidents.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerting.all }),
      ]),
  });
}

export const useCreateIncident = () => useIncidentMutation((p: CreateIncidentPayload) => incidentService.create(p));
export const useAssignIncident = () =>
  useIncidentMutation(({ id, assignee, queue }: { id: string; assignee: PersonRef | null; queue: string | null }) =>
    incidentService.assign(id, assignee, queue),
  );
export const useSetIncidentPriority = () =>
  useIncidentMutation(({ id, priority }: { id: string; priority: Severity }) =>
    incidentService.setPriority(id, priority),
  );
export const useSetIncidentStatus = () =>
  useIncidentMutation(({ id, status, note }: { id: string; status: IncidentStatus; note?: string }) =>
    incidentService.setStatus(id, status, note),
  );
export const useReopenIncident = () =>
  useIncidentMutation(({ id, reason }: { id: string; reason: string }) => incidentService.reopen(id, reason));
export const useEscalateIncident = () =>
  useIncidentMutation(({ id, reason }: { id: string; reason: string }) => incidentService.escalate(id, reason));
export const useAddIncidentComment = () =>
  useIncidentMutation(({ id, text }: { id: string; text: string }) => incidentService.addComment(id, text));
export const useAddIncidentAction = () =>
  useIncidentMutation(({ id, text }: { id: string; text: string }) => incidentService.addAction(id, text));
export const useAddIncidentAttachment = () =>
  useIncidentMutation(({ id, file }: { id: string; file: Attachment }) => incidentService.addAttachment(id, file));
