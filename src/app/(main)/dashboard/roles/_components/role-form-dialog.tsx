"use client";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRoleDefinition, useUpdateRoleDefinition } from "@/hooks/api/use-role-definitions";
import { getErrorMessage } from "@/lib/axios";
import { ROLE_SCOPES, type RoleDefinition, type RoleScope, roleScopeLabels } from "@/types/permission";

const schema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{2,40}$/, { message: "2 à 40 caractères : minuscules, chiffres ou souligné." }),
  name: z.string().trim().min(2, { message: "2 caractères minimum." }).max(80),
  description: z.string().trim().max(300),
  scope: z.enum(ROLE_SCOPES),
});

type Values = z.infer<typeof schema>;

/**
 * Identité d'un rôle personnalisé. Trois usages :
 * création vierge, duplication (`source` = rôle copié, permissions comprises), modification (`role`).
 */
export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  source,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleDefinition;
  source?: RoleDefinition;
  onSaved?: (role: RoleDefinition) => void;
}) {
  const create = useCreateRoleDefinition();
  const update = useUpdateRoleDefinition();
  const pending = create.isPending || update.isPending;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", name: "", description: "", scope: "client" },
  });

  useEffect(() => {
    if (!open) return;
    if (role) {
      form.reset({ code: role.code, name: role.name, description: role.description ?? "", scope: role.scope });
    } else if (source) {
      form.reset({
        code: `${source.code}_copie`,
        name: `${source.name} (copie)`,
        description: source.description ?? "",
        scope: source.scope,
      });
    } else {
      form.reset({ code: "", name: "", description: "", scope: "client" });
    }
  }, [open, role, source, form]);

  function onSubmit(values: Values) {
    const handlers = {
      onSuccess: (saved: RoleDefinition) => {
        toast.success(role ? "Rôle mis à jour" : "Rôle créé", { description: saved.name });
        onOpenChange(false);
        onSaved?.(saved);
      },
      onError: (error: unknown) =>
        toast.error(role ? "Mise à jour impossible" : "Création impossible", { description: getErrorMessage(error) }),
    };
    if (role) {
      update.mutate({ id: role.id, payload: values }, handlers);
    } else {
      create.mutate({ ...values, grants: source?.grants ?? {} }, handlers);
    }
  }

  const title = role ? `Modifier ${role.name}` : source ? `Dupliquer ${source.name}` : "Nouveau rôle";

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {source
              ? "Le nouveau rôle reprend toutes les permissions du rôle copié ; ajustez-les ensuite dans l'onglet Permissions."
              : "Les permissions se règlent ensuite dans l'onglet Permissions."}
          </DialogDescription>
        </DialogHeader>
        <form id="role-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="role-name">Nom</FieldLabel>
                    <Input
                      {...field}
                      id="role-name"
                      placeholder="Support technique"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="code"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="role-code">Code</FieldLabel>
                    <Input
                      {...field}
                      id="role-code"
                      className="font-mono"
                      placeholder="support_technique"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="scope"
              render={({ field }) => (
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="role-scope">Portée</FieldLabel>
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as RoleScope)}>
                    <SelectTrigger id="role-scope" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {ROLE_SCOPES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {roleScopeLabels[s]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Plateforme : collaborateurs SISBM. Client : utilisateurs d'une entreprise cliente, limités à son
                    périmètre.
                  </FieldDescription>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="role-description">Description</FieldLabel>
                  <Textarea {...field} id="role-description" rows={2} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="role-form" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {role ? "Enregistrer" : "Créer le rôle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
