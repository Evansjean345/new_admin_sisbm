/**
 * Périmètres d'accès et authentification multifacteur (spécifications SuperAdmin §VI).
 *
 * - Écran 2 « Utilisateurs clients » : groupe ou périmètre autorisé. Un utilisateur client ne voit
 *   que les données de son organisation, éventuellement restreintes à des groupes de véhicules ou à
 *   des véhicules précis (règle « un utilisateur n'accède qu'aux données de son périmètre »).
 * - Règle §VI.4 : les accès privilégiés doivent être protégés par une authentification multifacteur.
 *
 * Rappel : ces contrôles DOIVENT être appliqués par le serveur ; l'écran ne fait que les configurer.
 */

export const SCOPE_MODES = ["organization", "vehicle_groups", "vehicles"] as const;
export type ScopeMode = (typeof SCOPE_MODES)[number];

export interface UserScope {
  userId: string;
  mode: ScopeMode;
  groupIds: string[];
  /** Libellés mémorisés pour l'affichage en liste (évite une requête par ligne). */
  groupNames: string[];
  vehicleIds: string[];
  vehicleLabels: string[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export type UserScopePayload = Pick<UserScope, "mode" | "groupIds" | "groupNames" | "vehicleIds" | "vehicleLabels">;

export type MfaMethod = "totp" | "sms";

export interface MfaStatus {
  userId: string;
  enabled: boolean;
  method: MfaMethod | null;
  enrolledAt: string | null;
  /** Rôle privilégié : la MFA est exigée à la prochaine connexion si elle n'est pas activée. */
  required: boolean;
  /** Codes de secours restants (affichés une seule fois à l'activation). */
  recoveryCodesLeft: number;
}

export interface MfaEnrollment {
  /** Secret TOTP à saisir dans l'application d'authentification (affiché une seule fois). */
  secret: string;
  otpauthUrl: string;
}
