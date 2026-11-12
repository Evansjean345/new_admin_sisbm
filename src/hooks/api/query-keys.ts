import type { ActivityParams, AdminCommandListParams, AdminStatsParams } from "@/types/admin";
import type { AlertListParams, SmsListParams } from "@/types/alerting";
import type { AuditLogListParams } from "@/types/audit";
import type { BillingStatsParams, InvoiceListParams, PaymentListParams, ReminderListParams } from "@/types/billing";
import type { ClientOfferListParams } from "@/types/client-offer";
import type { DeviceListParams } from "@/types/device";
import type { DriverListParams } from "@/types/driver";
import type { GroupKind, GroupListParams } from "@/types/group";
import type { IncidentListParams } from "@/types/incident";
import type { OfferListParams } from "@/types/offer";
import type { OrganizationListParams } from "@/types/organization";
import type { ScheduleHistoryParams, ScheduleListParams } from "@/types/schedule";
import type { ReferentialKind } from "@/types/settings";
import type { SubscriptionListParams } from "@/types/subscription";
import type { UserListParams } from "@/types/user";
import type { VehicleListParams } from "@/types/vehicle";

/** Clés React Query centralisées : une invalidation = un préfixe. */
export const queryKeys = {
  /** Tableau de bord admin (/api/v1/admin/*) : invalider `admin.all` rafraîchit tous les compteurs. */
  admin: {
    all: ["admin"] as const,
    overview: ["admin", "overview"] as const,
    activity: (params: ActivityParams) => ["admin", "activity", params] as const,
    organizationsStats: ["admin", "organizations", "stats"] as const,
    usersStats: (params: AdminStatsParams) => ["admin", "users", "stats", params] as const,
    vehiclesStats: (params: AdminStatsParams) => ["admin", "vehicles", "stats", params] as const,
    devicesStats: (params: AdminStatsParams) => ["admin", "devices", "stats", params] as const,
    commandsStats: (params: AdminStatsParams) => ["admin", "commands", "stats", params] as const,
    commands: (params: AdminCommandListParams) => ["admin", "commands", "list", params] as const,
  },
  auth: {
    me: ["auth", "me"] as const,
  },
  roles: {
    all: ["roles"] as const,
    /** Rôles traduits dans le modèle module × 7 actions, rôles personnalisés inclus. */
    definitions: ["roles", "definitions"] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params: UserListParams) => ["users", "list", params] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },
  vehicles: {
    all: ["vehicles"] as const,
    list: (params: VehicleListParams) => ["vehicles", "list", params] as const,
    detail: (id: string) => ["vehicles", "detail", id] as const,
  },
  devices: {
    all: ["devices"] as const,
    list: (params: DeviceListParams) => ["devices", "list", params] as const,
    detail: (id: string) => ["devices", "detail", id] as const,
    diagnostic: (id: string) => ["devices", "diagnostic", id] as const,
    telemetry: (id: string) => ["devices", "telemetry", id] as const,
    logs: (id: string, count: number) => ["devices", "logs", id, count] as const,
  },
  commands: {
    all: (deviceId: string) => ["commands", deviceId] as const,
    history: (deviceId: string) => ["commands", deviceId, "history"] as const,
    catalog: (deviceId: string) => ["commands", deviceId, "catalog"] as const,
    flespiCatalog: (deviceId: string) => ["commands", deviceId, "flespi-catalog"] as const,
  },
  organizations: {
    all: ["organizations"] as const,
    list: (params: OrganizationListParams) => ["organizations", "list", params] as const,
    detail: (id: string) => ["organizations", "detail", id] as const,
    roles: (id: string) => ["organizations", "roles", id] as const,
    users: (id: string, params: UserListParams) => ["organizations", "users", id, params] as const,
  },
  /** Calendriers d'utilisation : invalider `schedules.all` rafraîchit aussi les états planifiés. */
  schedules: {
    all: ["schedules"] as const,
    list: (params: ScheduleListParams) => ["schedules", "list", params] as const,
    detail: (id: string) => ["schedules", "detail", id] as const,
    preview: (id: string, at: string | undefined) => ["schedules", "preview", id, at ?? "now"] as const,
    vehicleStatus: (vehicleId: string) => ["schedules", "vehicle-status", vehicleId] as const,
    ofGroup: (groupId: string) => ["schedules", "group", groupId] as const,
    history: (params: ScheduleHistoryParams) => ["schedules", "history", params] as const,
  },
  /** Catalogue des offres (service simulé tant que l'API n'existe pas). */
  offers: {
    all: ["offers"] as const,
    features: ["offers", "features"] as const,
    list: (params: OfferListParams) => ["offers", "list", params] as const,
    detail: (id: string) => ["offers", "detail", id] as const,
  },
  /** Fiches commerciales des clients (service simulé). */
  clientProfiles: {
    all: ["client-profiles"] as const,
    detail: (organizationId: string) => ["client-profiles", "detail", organizationId] as const,
    many: (organizationIds: string[]) => ["client-profiles", "many", organizationIds] as const,
  },
  /** Souscriptions (service simulé) : `availability` = véhicules déjà affectés. */
  subscriptions: {
    all: ["subscriptions"] as const,
    list: (params: SubscriptionListParams) => ["subscriptions", "list", params] as const,
    detail: (id: string) => ["subscriptions", "detail", id] as const,
    availability: ["subscriptions", "availability"] as const,
    vehicleHistory: (vehicleId: string) => ["subscriptions", "vehicle-history", vehicleId] as const,
  },
  /** Factures émises, paiements et relances (service simulé) : invalider `billing.all` rafraîchit tout. */
  billing: {
    all: ["billing"] as const,
    invoices: (params: InvoiceListParams) => ["billing", "invoices", params] as const,
    invoice: (id: string) => ["billing", "invoice", id] as const,
    stats: (params: BillingStatsParams) => ["billing", "stats", params] as const,
    preview: (subscriptionId: string, start?: string, end?: string) =>
      ["billing", "preview", subscriptionId, start ?? "", end ?? ""] as const,
    contactEmail: (organizationId: string) => ["billing", "contact-email", organizationId] as const,
    payments: (params: PaymentListParams) => ["billing", "payments", params] as const,
    paymentMethods: ["billing", "payment-methods"] as const,
    reminders: (params: ReminderListParams) => ["billing", "reminders", params] as const,
  },
  /** Offre attribuée à chaque client (service simulé) : conditionne ses permissions. */
  clientOffers: {
    all: ["client-offers"] as const,
    list: (params: ClientOfferListParams) => ["client-offers", "list", params] as const,
    ofUser: (userId: string) => ["client-offers", "user", userId] as const,
  },
  /** Client exploitant d'un véhicule (service simulé). */
  vehicleOperators: {
    all: ["vehicle-operators"] as const,
    detail: (vehicleId: string) => ["vehicle-operators", vehicleId] as const,
  },
  drivers: {
    all: ["drivers"] as const,
    list: (params: DriverListParams) => ["drivers", "list", params] as const,
    detail: (id: string) => ["drivers", "detail", id] as const,
    ofVehicle: (vehicleId: string) => ["drivers", "vehicle", vehicleId] as const,
  },
  /** Une seule entrée pour les trois familles : la clé porte le type de groupe. */
  groups: {
    all: (kind: GroupKind) => ["groups", kind] as const,
    list: (kind: GroupKind, params: GroupListParams) => ["groups", kind, "list", params] as const,
    detail: (kind: GroupKind, id: string) => ["groups", kind, "detail", id] as const,
    members: (kind: GroupKind, id: string) => ["groups", kind, "members", id] as const,
  },
  audit: {
    all: ["audit"] as const,
    list: (params: AuditLogListParams) => ["audit", "list", params] as const,
    actions: (params: Pick<AuditLogListParams, "from" | "to" | "organizationId">) =>
      ["audit", "actions", params] as const,
    organization: (id: string, params: AuditLogListParams) => ["audit", "organization", id, params] as const,
    group: (kind: GroupKind, id: string, params: AuditLogListParams) => ["audit", "group", kind, id, params] as const,
  },
  /** Alertes, configurations, SMS et modèles (service simulé) : invalider `alerting.all` rafraîchit tout. */
  alerting: {
    all: ["alerting"] as const,
    alerts: (params: AlertListParams) => ["alerting", "alerts", params] as const,
    alert: (id: string) => ["alerting", "alert", id] as const,
    alertStats: ["alerting", "alert-stats"] as const,
    configs: ["alerting", "configs"] as const,
    sms: (params: SmsListParams) => ["alerting", "sms", params] as const,
    smsStats: ["alerting", "sms-stats"] as const,
    templates: ["alerting", "templates"] as const,
  },
  /** Incidents (service simulé) — liés aux alertes : une écriture invalide aussi `alerting`. */
  incidents: {
    all: ["incidents"] as const,
    list: (params: IncidentListParams) => ["incidents", "list", params] as const,
    detail: (id: string) => ["incidents", "detail", id] as const,
    stats: ["incidents", "stats"] as const,
  },
  /** Paramètres (service simulé, sauf la surveillance des services). */
  settings: {
    all: ["settings"] as const,
    general: ["settings", "general"] as const,
    sms: ["settings", "sms"] as const,
    email: ["settings", "email"] as const,
    referential: (kind: ReferentialKind) => ["settings", "referential", kind] as const,
    technical: ["settings", "technical"] as const,
    health: ["settings", "health"] as const,
    history: ["settings", "history"] as const,
  },
  /** Transfert du journal d'audit vers le SOC (destination et historique simulés). */
  soc: {
    all: ["soc"] as const,
    destination: ["soc", "destination"] as const,
    history: ["soc", "history"] as const,
  },
  flespi: {
    all: ["flespi"] as const,
    health: ["flespi", "health"] as const,
    channels: ["flespi", "channels"] as const,
    connections: (id: number) => ["flespi", "channels", id, "connections"] as const,
    logs: (id: number, count: number) => ["flespi", "channels", id, "logs", count] as const,
    idents: (id: number) => ["flespi", "channels", id, "idents"] as const,
    deviceTypes: (protocol: string, search?: string) => ["flespi", "device-types", protocol, search ?? ""] as const,
  },
};
