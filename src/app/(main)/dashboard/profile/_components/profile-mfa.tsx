"use client";

import { useState } from "react";

import { Copy, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { useEnrollMfa, useMfaStatus, useVerifyMfa } from "@/hooks/api/use-access";
import { getErrorMessage } from "@/lib/axios";
import { formatDateTime } from "@/lib/format";
import type { MfaEnrollment } from "@/types/access";

/**
 * Activation de l'authentification multifacteur par l'utilisateur lui-même (§VI.4).
 * Étapes : génération de la clé → saisie dans l'application → premier code → codes de secours.
 */
export function ProfileMfa({ userId, email, roleCode }: { userId: string; email: string; roleCode?: string | null }) {
  const status = useMfaStatus(userId, roleCode);
  const enroll = useEnrollMfa();
  const verify = useVerifyMfa();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copié dans le presse-papiers"))
      .catch(() => toast.error("Copie impossible"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Authentification multifacteur
        </CardTitle>
        <CardDescription>
          Un code à 6 chiffres, généré par une application (Google Authenticator, Microsoft Authenticator…), est demandé
          à chaque connexion en plus du mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status.data?.required && !status.data.enabled ? (
          <Alert variant="destructive">
            <AlertTitle>Obligatoire pour votre rôle</AlertTitle>
            <AlertDescription>Votre compte a des accès privilégiés : activez la MFA maintenant.</AlertDescription>
          </Alert>
        ) : null}

        {recovery ? (
          <div className="flex flex-col gap-3">
            <Alert>
              <AlertTitle>MFA activée — conservez vos codes de secours</AlertTitle>
              <AlertDescription>
                Chaque code ne sert qu'une fois, si vous perdez votre téléphone. Ils ne seront plus jamais affichés.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm sm:grid-cols-4">
              {recovery.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copy(recovery.join("\n"))}>
                <Copy data-icon="inline-start" />
                Copier les codes
              </Button>
              <Button size="sm" onClick={() => setRecovery(null)}>
                J'ai mis mes codes en lieu sûr
              </Button>
            </div>
          </div>
        ) : status.data?.enabled ? (
          <div className="flex flex-col gap-1">
            <StatusBadge tone="success">Activée</StatusBadge>
            <p className="text-muted-foreground text-xs">
              Depuis le {formatDateTime(status.data.enrolledAt)} · {status.data.recoveryCodesLeft} code(s) de secours
              restant(s). En cas de perte du téléphone, demandez une réinitialisation à un administrateur.
            </p>
          </div>
        ) : enrollment ? (
          <div className="flex flex-col gap-4">
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
              <li>Ouvrez votre application d'authentification et ajoutez un compte.</li>
              <li>Choisissez « Saisir une clé » et recopiez la clé ci-dessous (type : basé sur le temps).</li>
              <li>Saisissez le code à 6 chiffres affiché par l'application.</li>
            </ol>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm tracking-widest">
                {enrollment.secret.match(/.{1,4}/g)?.join(" ")}
              </code>
              <Button variant="outline" size="icon" aria-label="Copier la clé" onClick={() => copy(enrollment.secret)}>
                <Copy />
              </Button>
            </div>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="mfa-code">Code de vérification</FieldLabel>
              <InputOTP id="mfa-code" maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <FieldDescription>Démonstration : tout code à 6 chiffres est accepté.</FieldDescription>
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEnrollment(null)}>
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={code.length !== 6 || verify.isPending}
                onClick={() =>
                  verify.mutate(
                    { userId, code },
                    {
                      onSuccess: (r) => {
                        setRecovery(r.recoveryCodes);
                        setEnrollment(null);
                        setCode("");
                        toast.success("Authentification multifacteur activée");
                      },
                      onError: (e) => toast.error("Code refusé", { description: getErrorMessage(e) }),
                    },
                  )
                }
              >
                {verify.isPending ? <Spinner data-icon="inline-start" /> : null}
                Vérifier et activer
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="w-fit"
            disabled={enroll.isPending || status.isPending}
            onClick={() =>
              enroll.mutate(
                { userId, email },
                {
                  onSuccess: setEnrollment,
                  onError: (e) => toast.error("Activation impossible", { description: getErrorMessage(e) }),
                },
              )
            }
          >
            {enroll.isPending ? <Spinner data-icon="inline-start" /> : <Smartphone data-icon="inline-start" />}
            Activer la MFA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
