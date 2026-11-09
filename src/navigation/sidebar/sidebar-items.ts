import {
  Banknote,
  BellRing,
  BuildingComplex,
  CarBattery,
  CarIcon,
  CarTaxiFront,
  Clock3,
  FileSignature,
  Gauge,
  Handshake,
  LayoutDashboard,
  type LucideIcon,
  Map as MapIcon,
  MapPinned,
  Package,
  ReceiptText,
  ScrollText,
  Server,
  ServerCog,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserGroupIcon,
  UserRound,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

/**
 * Écran prévu par les spécifications mais pas encore développé : page d'attente
 * qui nomme le module. Le paramètre garde chaque entrée distincte dans le menu.
 */
const soon = (module: string) => `/dashboard/coming-soon?module=${encodeURIComponent(module)}`;

/**
 * Menu principal = les 7 modules des spécifications SuperAdmin, dans leur ordre.
 * Le second groupe rassemble les rubriques de la plateforme Client (§III.1) :
 * à terme, elles s'ouvriront depuis la fiche client, filtrées sur ce client.
 */
export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "SuperAdmin",
    items: [
      {
        id: "default",
        title: "Tableau de bord",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        id: "billing",
        title: "Facturation",
        icon: Banknote,
        subItems: [
          { id: "billing-dashboard", title: "Tableau de bord financier", url: "/dashboard/billing" },
          { id: "invoice", title: "Factures", url: "/dashboard/invoice", icon: ReceiptText },
          { id: "payments", title: "Paiements", url: soon("Gestion des paiements") },
          { id: "reminders", title: "Relances", url: soon("Relances") },
        ],
      },
      {
        id: "offers-clients",
        title: "Offres & Clients",
        icon: Handshake,
        subItems: [
          { id: "offers", title: "Catalogue des offres", url: "/dashboard/offers", icon: Package },
          { id: "entreprises", title: "Gestion des clients", url: "/dashboard/entreprises", icon: BuildingComplex },
          {
            id: "subscriptions",
            title: "Gestion des souscriptions",
            url: "/dashboard/subscriptions",
            icon: FileSignature,
          },
          { id: "vehicles", title: "Gestion des véhicules", url: "/dashboard/vehicles", icon: CarIcon },
        ],
      },
      {
        id: "alerts",
        title: "Alertes & Notifications",
        icon: BellRing,
        subItems: [
          { id: "alert-center", title: "Centre des alertes", url: "/dashboard/mail" },
          {
            id: "notification-config",
            title: "Configuration des notifications",
            url: soon("Configuration des notifications"),
          },
          { id: "sms", title: "Gestion des SMS", url: soon("Gestion des SMS") },
          { id: "templates", title: "Modèles de notifications", url: soon("Modèles de notifications") },
        ],
      },
      {
        id: "incidents",
        title: "Gestion des incidents",
        url: soon("Gestion des incidents"),
        icon: TriangleAlert,
      },
      {
        id: "administration",
        title: "Administration & Habilitations",
        icon: ShieldCheck,
        subItems: [
          { id: "users", title: "Utilisateurs", url: "/dashboard/users", icon: Users },
          { id: "roles", title: "Rôles et permissions", url: "/dashboard/roles" },
          { id: "audit", title: "Journal d'audit", url: "/dashboard/audit", icon: ScrollText },
          { id: "profile", title: "Mon profil", url: "/dashboard/profile", icon: UserRound },
        ],
      },
      {
        id: "settings",
        title: "Paramètres",
        icon: Settings,
        subItems: [
          { id: "settings-general", title: "Paramètres généraux", url: soon("Paramètres généraux") },
          { id: "channel", title: "Intégrations GPS (Flespi)", url: "/dashboard/channel", icon: Server },
          { id: "device", title: "Trackers", url: "/dashboard/device", icon: CarBattery },
          { id: "group_device", title: "Lots de trackers", url: "/dashboard/group_device", icon: ServerCog },
          { id: "sms-gateway", title: "Passerelle SMS", url: soon("Passerelle SMS") },
          { id: "email-settings", title: "Paramètres e-mail", url: soon("Paramètres e-mail") },
          { id: "referentials", title: "Référentiels", url: soon("Référentiels") },
          { id: "technical", title: "Paramètres techniques", url: soon("Paramètres techniques") },
        ],
      },
    ],
  },
  {
    id: 2,
    label: "Rubriques client",
    items: [
      {
        id: "fleet",
        title: "Supervision",
        url: "/dashboard/fleet",
        icon: MapPinned,
      },
      {
        id: "clock",
        title: "Horaires",
        url: "/dashboard/clock",
        icon: Clock3,
      },
      {
        id: "zone",
        title: "Zones géographiques",
        url: soon("Zones géographiques"),
        icon: MapIcon,
      },
      {
        id: "speed",
        title: "Contrôle de vitesse",
        url: soon("Contrôle de vitesse"),
        icon: Gauge,
      },
      {
        id: "rules",
        title: "Moteur de règles",
        url: soon("Moteur de règles"),
        icon: Workflow,
      },
      {
        id: "drivers",
        title: "Conducteurs",
        icon: UserGroupIcon,
        subItems: [
          { id: "driver", title: "Conducteurs", url: "/dashboard/driver" },
          { id: "group_driver", title: "Équipes de conducteurs", url: "/dashboard/group_driver", icon: UsersRound },
        ],
      },
      {
        id: "group_vehicle",
        title: "Groupes de véhicules",
        url: "/dashboard/group_vehicle",
        icon: CarTaxiFront,
      },
    ],
  },
];
