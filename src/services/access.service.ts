import { mockClone, mockDelay, mockNow } from "@/lib/mock";
import type { MfaEnrollment, MfaMethod, MfaStatus, UserScope, UserScopePayload } from "@/types/access";
import { ApiError } from "@/types/api";

/**
 * Périmètres d'accès et MFA — SERVICE SIMULÉ.
 * Routes attendues : GET/PUT /admin/users/:id/scope, GET /admin/users/:id/mfa,
 * POST /auth/mfa/enroll, POST /auth/mfa/verify, DELETE /admin/users/:id/mfa (réinitialisation).
 *
 * Règles (§VI.4) — à appliquer par le serveur :
 *  - par défaut, un utilisateur client voit toute son organisation et rien d'autre ;
 *  - un périmètre « groupes » ou « véhicules » doit contenir au moins un élément ;
 *  - les rôles privilégiés (SuperAdmin, Distributeur, rôles plateforme) doivent activer la MFA ;
 *  - un administrateur ne peut que RÉINITIALISER la MFA d'un autre compte (l'utilisateur
 *    se réenrôle lui-même) : il n'en connaît jamais le secret.
 */

const ACTOR = "Vous (démo)";
/** Codes de rôles pour lesquels la MFA est obligatoire. */
export const PRIVILEGED_ROLE_CODES = new Set(["super_admin", "admin"]);

const scopes = new Map<string, UserScope>();
const mfa = new Map<string, Omit<MfaStatus, "required">>();
const pending = new Map<string, string>();

function defaultScope(userId: string): UserScope {
  return {
    userId,
    mode: "organization",
    groupIds: [],
    groupNames: [],
    vehicleIds: [],
    vehicleLabels: [],
    updatedAt: null,
    updatedBy: null,
  };
}

function randomSecret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => alphabet[b % 32]).join("");
}

export const accessService = {
  async getScope(userId: string): Promise<UserScope> {
    await mockDelay(120);
    return mockClone(scopes.get(userId) ?? defaultScope(userId));
  },

  /** Périmètres de plusieurs utilisateurs (colonne de la liste). */
  async getScopes(userIds: string[]): Promise<Record<string, UserScope>> {
    await mockDelay(80);
    return Object.fromEntries(userIds.map((id) => [id, mockClone(scopes.get(id) ?? defaultScope(id))]));
  },

  async setScope(userId: string, payload: UserScopePayload): Promise<UserScope> {
    await mockDelay();
    if (payload.mode === "vehicle_groups" && payload.groupIds.length === 0) {
      throw new ApiError(422, "E_VALIDATION", "Choisissez au moins un groupe de véhicules.");
    }
    if (payload.mode === "vehicles" && payload.vehicleIds.length === 0) {
      throw new ApiError(422, "E_VALIDATION", "Choisissez au moins un véhicule.");
    }
    const next: UserScope = {
      ...defaultScope(userId),
      ...payload,
      groupIds: payload.mode === "vehicle_groups" ? payload.groupIds : [],
      groupNames: payload.mode === "vehicle_groups" ? payload.groupNames : [],
      vehicleIds: payload.mode === "vehicles" ? payload.vehicleIds : [],
      vehicleLabels: payload.mode === "vehicles" ? payload.vehicleLabels : [],
      updatedAt: mockNow(),
      updatedBy: ACTOR,
    };
    scopes.set(userId, next);
    return mockClone(next);
  },

  async getMfa(userId: string, roleCode: string | null | undefined): Promise<MfaStatus> {
    await mockDelay(100);
    const state = mfa.get(userId) ?? { userId, enabled: false, method: null, enrolledAt: null, recoveryCodesLeft: 0 };
    return { ...mockClone(state), required: PRIVILEGED_ROLE_CODES.has(roleCode ?? "") };
  },

  async getMfaMany(users: Array<{ id: string; roleCode?: string | null }>): Promise<Record<string, MfaStatus>> {
    await mockDelay(80);
    return Object.fromEntries(
      users.map((u) => {
        const state = mfa.get(u.id) ?? {
          userId: u.id,
          enabled: false,
          method: null,
          enrolledAt: null,
          recoveryCodesLeft: 0,
        };
        return [u.id, { ...mockClone(state), required: PRIVILEGED_ROLE_CODES.has(u.roleCode ?? "") }];
      }),
    );
  },

  /** Étape 1 de l'activation (par l'utilisateur lui-même) : génère le secret TOTP. */
  async enroll(userId: string, email: string): Promise<MfaEnrollment> {
    await mockDelay(300);
    const secret = randomSecret();
    pending.set(userId, secret);
    const label = encodeURIComponent(`SISBM CORE:${email}`);
    return { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=SISBM%20CORE&digits=6&period=30` };
  },

  /**
   * Étape 2 : vérification du premier code. En démonstration, tout code à 6 chiffres est accepté ;
   * le serveur vérifiera le TOTP (RFC 6238) avec le secret enregistré.
   */
  async verify(
    userId: string,
    code: string,
    method: MfaMethod = "totp",
  ): Promise<{ status: MfaStatus; recoveryCodes: string[] }> {
    await mockDelay(400);
    if (!pending.has(userId)) throw new ApiError(409, "E_NO_ENROLLMENT", "Relancez l'activation.");
    if (!/^\d{6}$/.test(code)) throw new ApiError(422, "E_INVALID_CODE", "Code à 6 chiffres attendu.");
    pending.delete(userId);
    const recoveryCodes = Array.from({ length: 8 }, () =>
      Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join(""),
    );
    const state = { userId, enabled: true, method, enrolledAt: mockNow(), recoveryCodesLeft: recoveryCodes.length };
    mfa.set(userId, state);
    return { status: { ...state, required: false }, recoveryCodes };
  },

  /** Réinitialisation par un administrateur (téléphone perdu…) : l'utilisateur devra se réenrôler. */
  async resetMfa(userId: string): Promise<void> {
    await mockDelay();
    mfa.delete(userId);
    pending.delete(userId);
  },
};
