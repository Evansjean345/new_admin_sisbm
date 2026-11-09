"use client";

import { useMutation } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/axios";
import { passwordResetService } from "@/services/password-reset.service";
import type { User } from "@/types/user";

/** Réinitialisation du mot de passe par un administrateur (§VI.3). */
export function UserResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reset = useMutation({ mutationFn: () => passwordResetService.request(user.id) });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Réinitialiser le mot de passe de ${user.fullName} ?`}
      description={`Un lien à usage unique sera envoyé à ${user.email}. Le mot de passe actuel sera invalidé et les sessions ouvertes fermées.`}
      confirmLabel="Envoyer le lien"
      loading={reset.isPending}
      onConfirm={() =>
        reset.mutate(undefined, {
          onSuccess: () => {
            toast.info("Simulation de réinitialisation", {
              description: `Aucun e-mail envoyé à ${user.email} : la route API n'existe pas encore.`,
            });
            onOpenChange(false);
          },
          onError: (error) => toast.error("Réinitialisation impossible", { description: getErrorMessage(error) }),
        })
      }
    >
      <Alert>
        <FlaskConical />
        <AlertDescription>
          Démonstration : la réinitialisation par un administrateur n'est pas encore disponible côté serveur. Aucun
          e-mail ne sera envoyé.
        </AlertDescription>
      </Alert>
    </ConfirmDialog>
  );
}
