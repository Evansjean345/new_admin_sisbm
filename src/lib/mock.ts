import type { Paginated, PaginationParams } from "@/types/api";

/**
 * Outils des services SIMULÉS (modules dont l'API n'existe pas encore).
 *
 * Les services qui s'en servent gardent les mêmes signatures qu'un service axios :
 * le jour où la route existe, on remplace le corps des méthodes par `api.get(...)`
 * sans toucher aux hooks ni aux écrans. Les données vivent en mémoire et sont
 * réinitialisées au rechargement de la page.
 */

/** Latence artificielle pour que les états de chargement restent visibles. */
export function mockDelay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockId(): string {
  return crypto.randomUUID();
}

export function mockNow(): string {
  return new Date().toISOString();
}

/** Copie profonde : l'appelant ne doit jamais muter le magasin en mémoire. */
export function mockClone<T>(value: T): T {
  return structuredClone(value);
}

/** Pagination au format de l'API (`meta` Lucid / AdonisJS). */
export function mockPaginate<T>(rows: T[], params: PaginationParams = {}): Paginated<T> {
  const perPage = params.perPage ?? 25;
  const total = rows.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, params.page ?? 1), lastPage);
  const start = (currentPage - 1) * perPage;
  return {
    meta: {
      total,
      perPage,
      currentPage,
      lastPage,
      firstPage: 1,
      firstPageUrl: "",
      lastPageUrl: "",
      nextPageUrl: currentPage < lastPage ? "" : null,
      previousPageUrl: currentPage > 1 ? "" : null,
    },
    data: mockClone(rows.slice(start, start + perPage)),
  };
}
