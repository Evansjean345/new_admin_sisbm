import { mockClone, mockDelay, mockId, mockNow, mockPaginate } from "@/lib/mock";
import { ApiError, type Paginated } from "@/types/api";
import type { CreateOfferPayload, Offer, OfferFeature, OfferListParams, UpdateOfferPayload } from "@/types/offer";

/**
 * Catalogue des offres — SERVICE SIMULÉ.
 *
 * L'API n'expose pas encore `/admin/offers`. Les signatures sont celles attendues
 * de l'API ; pour brancher le backend, remplacer chaque corps de méthode par l'appel
 * axios indiqué en commentaire (voir `vehicle.service.ts` pour le modèle).
 *
 * Les tarifs et la matrice ci-dessous sont des DONNÉES DE DÉMONSTRATION :
 * ils ne reflètent aucune décision commerciale de SISBM.
 */

const FEATURES: OfferFeature[] = [
  {
    key: "supervision.realtime",
    label: "Suivi temps réel",
    module: "Supervision",
    description: null,
    requiresHardware: false,
  },
  {
    key: "supervision.history",
    label: "Historique des trajets",
    module: "Supervision",
    description: null,
    requiresHardware: false,
  },
  {
    key: "supervision.replay",
    label: "Rejeu de trajet",
    module: "Supervision",
    description: null,
    requiresHardware: false,
  },
  { key: "schedules", label: "Gestion des horaires", module: "Horaires", description: null, requiresHardware: false },
  { key: "geofences", label: "Zones géographiques", module: "Zones", description: null, requiresHardware: false },
  {
    key: "speed.alerts",
    label: "Alertes d'excès de vitesse",
    module: "Contrôle de vitesse",
    description: null,
    requiresHardware: false,
  },
  {
    key: "speed.limiter",
    label: "Limiteur de vitesse",
    module: "Contrôle de vitesse",
    description: "Nécessite un équipement compatible.",
    requiresHardware: true,
  },
  {
    key: "rules.engine",
    label: "Moteur de règles",
    module: "Moteur de règles",
    description: null,
    requiresHardware: false,
  },
  {
    key: "alerts.sms",
    label: "Alertes SMS",
    module: "Alertes & notifications",
    description: null,
    requiresHardware: false,
  },
  {
    key: "alerts.email",
    label: "Alertes e-mail",
    module: "Alertes & notifications",
    description: null,
    requiresHardware: false,
  },
  {
    key: "drivers",
    label: "Gestion des conducteurs",
    module: "Conducteurs",
    description: null,
    requiresHardware: false,
  },
  {
    key: "security.immobilization",
    label: "Immobilisation à distance",
    module: "Sécurité",
    description: "Nécessite un boîtier avec relais.",
    requiresHardware: true,
  },
  { key: "incidents", label: "Gestion des incidents", module: "Incidents", description: null, requiresHardware: false },
  {
    key: "reports.standard",
    label: "Rapports standards",
    module: "Rapports",
    description: null,
    requiresHardware: false,
  },
  {
    key: "reports.custom",
    label: "Rapports personnalisés",
    module: "Rapports",
    description: null,
    requiresHardware: false,
  },
  {
    key: "support.technician",
    label: "Technicien dédié",
    module: "Support",
    description: null,
    requiresHardware: false,
  },
];

const keysUpTo = (count: number) => FEATURES.slice(0, count).map((f) => f.key);

function seed(): Offer[] {
  const created = "2026-01-15T09:00:00.000Z";
  const base = {
    currency: "XOF",
    periodicity: "monthly" as const,
    options: null,
    createdAt: created,
    updatedAt: created,
  };
  return [
    {
      ...base,
      id: mockId(),
      code: "STANDARD",
      name: "Standard",
      description: "Géolocalisation et historique des trajets.",
      referencePrice: 10_000,
      featureKeys: ["supervision.realtime", "supervision.history", "speed.alerts", "alerts.email", "reports.standard"],
      limitations: { maxVehicles: null, historyDays: 30, smsPerMonth: 0 },
      status: "active",
      launchDate: "2026-02-01",
      stats: { subscriptions: 12, vehicles: 148 },
    },
    {
      ...base,
      id: mockId(),
      code: "GOLD",
      name: "Gold",
      description: "Standard + horaires, zones et alertes SMS.",
      referencePrice: 15_000,
      featureKeys: keysUpTo(10).filter((k) => k !== "speed.limiter"),
      limitations: { maxVehicles: null, historyDays: 90, smsPerMonth: 100 },
      status: "active",
      launchDate: "2026-02-01",
      stats: { subscriptions: 7, vehicles: 64 },
    },
    {
      ...base,
      id: mockId(),
      code: "PREMIUM",
      name: "Premium",
      description: "Gold + conducteurs, immobilisation et incidents.",
      referencePrice: 22_500,
      featureKeys: keysUpTo(14),
      limitations: { maxVehicles: null, historyDays: 180, smsPerMonth: 500 },
      status: "active",
      launchDate: "2026-02-01",
      stats: { subscriptions: 4, vehicles: 31 },
    },
    {
      ...base,
      id: mockId(),
      code: "PLATINUM",
      name: "Platinum",
      description: "Toutes les fonctionnalités et un technicien dédié.",
      referencePrice: 35_000,
      featureKeys: FEATURES.map((f) => f.key),
      limitations: { maxVehicles: null, historyDays: 365, smsPerMonth: null },
      status: "draft",
      launchDate: null,
      stats: { subscriptions: 1, vehicles: 6 },
    },
  ];
}

let store: Offer[] | null = null;
const db = () => {
  store ??= seed();
  return store;
};

function findOrThrow(id: string): Offer {
  const offer = db().find((o) => o.id === id);
  if (!offer) throw new ApiError(404, "E_NOT_FOUND", "Offre introuvable.");
  return offer;
}

export const offerService = {
  /** GET /admin/offers/features — lignes de la matrice des fonctionnalités. */
  async features(): Promise<OfferFeature[]> {
    await mockDelay();
    return mockClone(FEATURES);
  },

  /** GET /admin/offers?search=&status= */
  async list(params: OfferListParams = {}): Promise<Paginated<Offer>> {
    await mockDelay();
    const search = params.search?.toLowerCase();
    const rows = db().filter(
      (o) =>
        (!params.status || o.status === params.status) &&
        (!search || o.name.toLowerCase().includes(search) || o.code.toLowerCase().includes(search)),
    );
    return mockPaginate(rows, params);
  },

  /** GET /admin/offers/:id */
  async get(id: string): Promise<Offer> {
    await mockDelay();
    return mockClone(findOrThrow(id));
  },

  /** POST /admin/offers — le code est unique. */
  async create(payload: CreateOfferPayload): Promise<Offer> {
    await mockDelay();
    const code = payload.code.trim().toUpperCase();
    if (db().some((o) => o.code === code)) {
      throw new ApiError(409, "E_OFFER_CODE_TAKEN", `Le code « ${code} » est déjà utilisé.`);
    }
    const now = mockNow();
    const offer: Offer = {
      id: mockId(),
      code,
      name: payload.name,
      description: payload.description ?? null,
      referencePrice: payload.referencePrice,
      currency: payload.currency ?? "XOF",
      periodicity: payload.periodicity,
      featureKeys: payload.featureKeys,
      options: payload.options ?? null,
      limitations: payload.limitations,
      status: payload.status,
      launchDate: payload.launchDate ?? null,
      stats: { subscriptions: 0, vehicles: 0 },
      createdAt: now,
      updatedAt: now,
    };
    db().push(offer);
    return mockClone(offer);
  },

  /** PATCH /admin/offers/:id */
  async update(id: string, payload: UpdateOfferPayload): Promise<Offer> {
    await mockDelay();
    const offer = findOrThrow(id);
    Object.assign(offer, payload, { updatedAt: mockNow() });
    return mockClone(offer);
  },

  /** DELETE /admin/offers/:id — refusé (409) si des souscriptions utilisent l'offre. */
  async remove(id: string): Promise<void> {
    await mockDelay();
    const offer = findOrThrow(id);
    if (offer.stats.subscriptions > 0) {
      throw new ApiError(
        409,
        "E_OFFER_IN_USE",
        `${offer.stats.subscriptions} souscription(s) utilisent cette offre : retirez-la du catalogue plutôt que de la supprimer.`,
      );
    }
    store = db().filter((o) => o.id !== id);
  },
};
