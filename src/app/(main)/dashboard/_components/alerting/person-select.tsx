"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUsers } from "@/hooks/api/use-users";
import type { PersonRef } from "@/types/alerting";
import { INCIDENT_QUEUES } from "@/types/incident";

const QUEUE_PREFIX = "queue:";

/**
 * Choix d'un responsable : un utilisateur (collaborateurs SISBM en tête) ou, si `allowQueues`,
 * une file d'affectation. La valeur renvoyée distingue les deux.
 */
export function PersonSelect({
  id,
  value,
  onChange,
  allowQueues = false,
  placeholder = "Choisir un responsable",
}: {
  id?: string;
  value: { assignee: PersonRef | null; queue: string | null };
  onChange: (value: { assignee: PersonRef | null; queue: string | null }) => void;
  allowQueues?: boolean;
  placeholder?: string;
}) {
  const users = useUsers({ perPage: 100, status: "active" });
  const rows = [...(users.data?.data ?? [])].sort(
    (a, b) =>
      Number(b.role?.code === "super_admin") - Number(a.role?.code === "super_admin") ||
      a.fullName.localeCompare(b.fullName),
  );
  const current = value.assignee ? value.assignee.id : value.queue ? `${QUEUE_PREFIX}${value.queue}` : "";

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (v.startsWith(QUEUE_PREFIX)) onChange({ assignee: null, queue: v.slice(QUEUE_PREFIX.length) });
        else {
          const u = rows.find((r) => r.id === v);
          if (u) onChange({ assignee: { id: u.id, name: u.fullName }, queue: null });
        }
      }}
      disabled={users.isPending}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={users.isPending ? "Chargement…" : placeholder}>
          {value.assignee?.name ?? value.queue ?? undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        {allowQueues ? (
          <SelectGroup>
            <SelectLabel>Files d'affectation</SelectLabel>
            {INCIDENT_QUEUES.map((q) => (
              <SelectItem key={q} value={`${QUEUE_PREFIX}${q}`}>
                {q}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        <SelectGroup>
          <SelectLabel>Utilisateurs</SelectLabel>
          {rows.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.fullName} — {u.role?.name ?? u.organization?.name ?? u.email}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
