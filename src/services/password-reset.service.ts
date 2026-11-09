import { mockDelay, mockNow } from "@/lib/mock";

/**
 * Réinitialisation du mot de passe par un administrateur (§VI.3) — SERVICE SIMULÉ.
 *
 * L'API n'expose que `POST /users/me/password` (changer SON mot de passe).
 * Route attendue : POST /admin/users/:id/password-reset → envoie un lien à usage
 * unique par e-mail, invalide le mot de passe actuel et révoque les sessions.
 * Rien n'est envoyé ici.
 */
export const passwordResetService = {
  async request(_userId: string): Promise<{ requestedAt: string }> {
    await mockDelay(500);
    return { requestedAt: mockNow() };
  },
};
