import type { PaginationParams } from "./api";

/**
 * Module 2 — Facturation (spécifications SuperAdmin §II).
 *
 * Cycle de vie d'une facture : brouillon → émise → (payée / annulée).
 *  - Le BROUILLON est modifiable et n'a pas de numéro.
 *  - L'ÉMISSION attribue un numéro unique et fige la facture (règles 6 et 8) : toute
 *    correction passe ensuite par un avoir ou une annulation, historisés (règle 7).
 *  - Le statut affiché d'une facture émise est DÉRIVÉ du solde et de l'échéance.
 */

export type OrganizationRef = { id: string; name: string; code: string };

/** Étape enregistrée ; le statut affiché (`InvoiceStatus`) en est déduit. */
export type InvoiceLifecycle = "draft" | "issued" | "cancelled";

export const INVOICE_STATUSES = ["draft", "unpaid", "partial", "overdue", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Règle 9 : une seule facture `standard` par souscription et par période.
 * Un complément ou une correction doit être demandé explicitement.
 */
export const INVOICE_KINDS = ["standard", "complement", "correction"] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

/**
 * Une ligne = un véhicule sur la partie de la période où il était affecté à la souscription.
 * Un changement d'offre en cours de période (règle 4) donne deux lignes au prorata,
 * une sur chaque souscription.
 */
export interface InvoiceLine {
  id: string;
  vehicleId: string;
  registration: string;
  label: string | null;
  /** Bornes facturées pour ce véhicule (incluses). */
  startDate: string;
  endDate: string;
  days: number;
  periodDays: number;
  /** Tarif unitaire par véhicule et par période, avant remise. */
  unitPrice: number;
  /** unitPrice × days / periodDays, arrondi. */
  amount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  amountHT: number;
  taxAmount: number;
  amountTTC: number;
}

export interface InvoiceEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  description: string;
}

export interface CreditNote {
  id: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string;
  organizationId: string;
  organization: OrganizationRef;
  /** Montant TTC crédité. */
  amount: number;
  currency: string;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface Invoice extends InvoiceTotals {
  id: string;
  /** null tant que la facture est un brouillon. */
  number: string | null;
  kind: InvoiceKind;
  lifecycle: InvoiceLifecycle;
  organizationId: string;
  organization: OrganizationRef;
  subscriptionId: string;
  subscriptionReference: string;
  offer: { id: string; code: string; name: string };
  periodStart: string;
  periodEnd: string;
  /** « Octobre 2026 », « T4 2026 »… */
  periodLabel: string;
  lines: InvoiceLine[];
  vehicleCount: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  observations: string | null;
  /** Dernier envoi par e-mail. */
  emailedAt: string | null;
  emailedTo: string | null;
  cancelReason: string | null;
  history: InvoiceEvent[];
  createdAt: string;
  updatedAt: string;

  // Champs dérivés (calculés par le serveur à chaque lecture).
  status: InvoiceStatus;
  /** Somme des paiements confirmés. */
  paidAmount: number;
  /** Somme des avoirs. */
  creditedAmount: number;
  /** Reste à payer = TTC − payé − avoirs. */
  balance: number;
  daysOverdue: number;
  reminderLevel: number;
  lastReminderAt: string | null;
  creditNotes: CreditNote[];
}

export interface InvoiceListParams extends PaginationParams {
  search?: string;
  organizationId?: string;
  subscriptionId?: string;
  status?: InvoiceStatus;
  /** Uniquement les factures émises avec un reste à payer. */
  openOnly?: boolean;
  /** Filtre sur la date d'émission (AAAA-MM-JJ, bornes incluses). */
  from?: string;
  to?: string;
}

/** Création ou modification d'un brouillon (écran 3). */
export interface InvoiceDraftPayload {
  subscriptionId: string;
  kind: InvoiceKind;
  periodStart: string;
  periodEnd: string;
  /** Véhicules retenus parmi ceux proposés par `preview`. */
  vehicleIds: string[];
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  issueDate: string;
  dueDate: string;
  observations?: string;
  /** true = émettre immédiatement après l'enregistrement. */
  issue?: boolean;
}

/** Préremplissage depuis la souscription (écran 3). */
export interface InvoicePreview {
  subscriptionId: string;
  subscriptionReference: string;
  organization: OrganizationRef;
  offer: { id: string; code: string; name: string };
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  /** Une ligne par affectation qui chevauche la période, au tarif de la souscription. */
  lines: InvoiceLine[];
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  currency: string;
  /** Facture standard déjà existante pour cette période (règle 9). */
  duplicateOf: { id: string; number: string | null } | null;
}

export interface GenerateInvoicesPayload {
  /** Premier jour du mois à facturer (AAAA-MM-01). */
  month: string;
  /** true = émettre les factures générées ; false = brouillons à vérifier. */
  issue: boolean;
}

export interface GenerateInvoicesResult {
  created: Array<{ id: string; label: string }>;
  skipped: Array<{ subscriptionReference: string; reason: string }>;
}

export interface BillingStats {
  currency: string;
  totalInvoiced: number;
  totalCollected: number;
  totalDue: number;
  totalCredited: number;
  counts: Record<Exclude<InvoiceStatus, "cancelled">, number>;
  overdueAmount: number;
}

export interface BillingStatsParams {
  from?: string;
  to?: string;
}

// ── Paiements (écran 4) ──────────────────────────────────────────────────────

/** Mode de paiement : liste configurable (Paramètres › Référentiels), les 4 premiers sont prévus par la spec. */
export interface PaymentMethod {
  id: string;
  label: string;
  active: boolean;
}

export type PaymentStatus = "confirmed" | "cancelled";

export interface Attachment {
  name: string;
  sizeKb: number;
  type: string;
}

export interface Payment {
  id: string;
  reference: string;
  invoiceId: string;
  invoiceNumber: string;
  organizationId: string;
  organization: OrganizationRef;
  amount: number;
  currency: string;
  methodId: string;
  methodLabel: string;
  paidAt: string;
  transactionRef: string | null;
  /** Pièce justificative (reçu, avis de virement…). */
  attachment: Attachment | null;
  comment: string | null;
  status: PaymentStatus;
  cancelReason: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface PaymentListParams extends PaginationParams {
  search?: string;
  organizationId?: string;
  invoiceId?: string;
  methodId?: string;
  status?: PaymentStatus;
}

export interface RecordPaymentPayload {
  invoiceId: string;
  amount: number;
  methodId: string;
  paidAt: string;
  transactionRef?: string;
  attachment?: Attachment | null;
  comment?: string;
}

// ── Relances (écran 5) ───────────────────────────────────────────────────────

export const REMINDER_CHANNELS = ["email", "sms"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export type ReminderSendStatus = "sent" | "failed";

export interface Reminder {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  organizationId: string;
  organization: OrganizationRef;
  /** 1 = rappel amiable, 2 = relance, 3 = mise en demeure. */
  level: number;
  channel: ReminderChannel;
  recipient: string;
  amountDue: number;
  daysOverdue: number;
  currency: string;
  message: string;
  sentAt: string;
  sentBy: string;
  sendStatus: ReminderSendStatus;
  error: string | null;
}

export interface ReminderListParams extends PaginationParams {
  search?: string;
  organizationId?: string;
  channel?: ReminderChannel;
  sendStatus?: ReminderSendStatus;
}

export interface SendRemindersPayload {
  invoiceIds: string[];
  channels: ReminderChannel[];
  /** Message libre ; vide = modèle du niveau de relance. */
  message?: string;
}
