export type EntityStatus = 'active' | 'inactive' | 'archived' | 'lead';
export type ISODateString = string;

export interface Proposal {
  id: string;
  clientId: string;
  title: string;
  value: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt: ISODateString;
  updatedAt: ISODateString;
  validUntil: ISODateString;
  description?: string;
  publicToken?: string;
}

export interface Client {
  id: string;
  personType: 'Física' | 'Jurídica';
  name: string; // Nome Completo or Razão Social
  taxId: string; // CPF or CNPJ
  email: string;
  phone: string;
  company?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  avatarUrl?: string;
  status: EntityStatus;
  source?: 'web' | 'mobile' | 'whatsapp' | 'import' | string;
  createdFromMobile?: boolean;
  whatsappOptIn?: boolean;
  responsibleId?: string;
  segment?: string;
  customFields?: Record<string, unknown>;
  
  // Financial
  address: {
    street: string;
    number: string;
    complement?: string;
    zipCode: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  dueDay: number;
  pixKey?: string;
  bankingInfo?: string;

  // Context
  tags: string[];
  attention: string;
  origin: string;
  publicToken?: string;
  publicStatusEnabled?: boolean;
  publicStatusClosedAt?: ISODateString;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type TimelineEventType = 'email' | 'whatsapp' | 'note' | 'file' | 'system';

export interface TimelineEvent {
  id: string;
  clientId: string;
  type: TimelineEventType;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  createdAt: ISODateString;
  createdBy: string;
}

export interface CrmPipelineStage {
  id: string;
  key: string;
  name: string;
  position: number;
  color: string;
  isDefault: boolean;
}

export interface CrmDeal {
  id: string;
  clientId: string;
  stageId: string;
  title: string;
  value: number;
  probability: number;
  status: 'open' | 'won' | 'lost';
  expectedCloseAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ProjectStatus = 'draft' | 'ongoing' | 'paused' | 'completed' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export interface Project {
  id: string;
  name: string;
  clientId: string; 
  description: string;
  status: ProjectStatus;
  startDate: ISODateString;
  deadline: ISODateString;
  budget: number;
  paymentStatus: PaymentStatus;
  progress: number; // 0 to 100
  financialBalance?: number; // Added for transversal visibility
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  estimatedDays: number;
  defaultBudget?: number;
  createdAt: ISODateString;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  order: number;
  status: 'pending' | 'completed';
  approvalStatus?: 'not_requested' | 'requested' | 'approved' | 'rejected';
  approvalUrl?: string;
  createdAt: ISODateString;
}

export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  responsible: string;
  responsibleId?: string;
  checklist: { id: string; text: string; completed: boolean }[];
  timeSpentMinutes?: number;
  activeTimeEntryId?: string;
  billableMinutes?: number;
  billedAmount?: number;
  dueDate?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ProjectTimeEntry {
  id: string;
  projectId: string;
  taskId?: string;
  userId?: string;
  startedAt: ISODateString;
  stoppedAt?: ISODateString;
  durationMinutes?: number;
  billable?: boolean;
  hourlyRate?: number;
  billedAmount?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: ISODateString;
  rejectionReason?: string;
  note?: string;
  createdAt: ISODateString;
}

export interface ProjectPerformanceReview {
  id: string;
  projectId: string;
  revieweeId?: string;
  reviewerId?: string;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  rating: number;
  deliveryScore: number;
  qualityScore: number;
  collaborationScore: number;
  summary?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: ISODateString;
}

export type TransactionType = 'income' | 'expense';

export type TransactionStatus = 'pending' | 'liquidated' | 'cancelled';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: ISODateString;
  dueDate: ISODateString;
  status: TransactionStatus;
  categoryId: string;
  costCenterId?: string;
  clientId?: string;
  projectId?: string;
  isRecurring?: boolean;
  recurrenceInterval?: 'monthly' | 'weekly' | 'yearly';
  attachmentUrl?: string; // Link to receipt in Supabase
  paymentProvider?: 'pagseguro' | 'manual';
  paymentMethod?: 'pix' | 'boleto';
  paymentUrl?: string;
  providerPaymentId?: string;
  bankStatementLineId?: string;
  createdAt: ISODateString;
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: TransactionType | 'both';
  dreGroup: string;
}

export interface CostCenter {
  id: string;
  name: string;
  code?: string;
}

export interface BankStatementLine {
  id: string;
  description: string;
  amount: number;
  occurredAt: ISODateString;
  matchedTransactionId?: string;
  matchConfidence?: number;
  status: 'unmatched' | 'matched' | 'ignored';
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  clientId: string;
  projectId?: string;
  number: string;
  amount: number;
  dueDate: ISODateString;
  status: InvoiceStatus;
  items: InvoiceItem[];
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface StoredDocument {
  id: string;
  bucketId: string;
  storagePath: string;
  fileName: string;
  displayName: string;
  fileExtension?: string;
  mimeType?: string;
  sizeBytes: number;
  folder: string;
  clientId?: string;
  projectId?: string;
  proposalId?: string;
  signatureStatus?: 'not_requested' | 'requested' | 'signed' | 'declined' | 'expired';
  signatureProvider?: string;
  signatureRequestId?: string;
  signatureUrl?: string;
  signatureRequestedAt?: ISODateString;
  signatureCompletedAt?: ISODateString;
  ocrStatus?: 'not_requested' | 'queued' | 'processing' | 'completed' | 'failed' | 'provider_required';
  ocrText?: string;
  ocrData?: Record<string, unknown>;
  ocrProcessedAt?: ISODateString;
  currentVersion?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  bucketId: string;
  storagePath: string;
  fileName: string;
  fileExtension?: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  changeSummary?: string;
  createdAt: ISODateString;
}

export interface Contract {
  id: string;
  clientId?: string;
  projectId?: string;
  documentId?: string;
  title: string;
  status: 'draft' | 'active' | 'pending_signature' | 'expired' | 'cancelled' | 'renewed';
  contractType: string;
  amount: number;
  currency: string;
  startsAt: ISODateString;
  endsAt?: ISODateString;
  renewalInterval: 'none' | 'monthly' | 'quarterly' | 'yearly';
  autoRenew: boolean;
  renewalNoticeDays: number;
  nextRenewalAt?: ISODateString;
  lastRenewedAt?: ISODateString;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface TemplateMarketplaceItem {
  id: string;
  templateType: 'proposal' | 'checklist' | 'workflow' | 'project';
  name: string;
  description?: string;
  payload: Record<string, unknown>;
  locale: string;
  currency: string;
  isPublic: boolean;
  installCount: number;
  createdAt: ISODateString;
}

export interface WhatsappConversation {
  id: string;
  channel?: 'whatsapp' | 'email' | 'sms';
  clientId?: string;
  projectId?: string;
  contactName: string;
  phoneE164: string;
  status: 'open' | 'archived';
  category?: 'opportunity' | 'support' | 'billing';
  classificationConfidence?: number;
  unreadCount: number;
  suggestedClientStatus?: 'none' | 'pending' | 'created' | 'dismissed';
  suggestedClientPayload?: {
    name?: string;
    phone?: string;
    source?: 'whatsapp' | 'mobile' | 'web' | 'import' | string;
    lastMessageBody?: string;
  };
  lastMessageBody?: string;
  lastMessageAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface WhatsappMessage {
  id: string;
  conversationId: string;
  channel?: 'whatsapp' | 'email' | 'sms';
  direction: 'inbound' | 'outbound';
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  providerMessageId?: string;
  errorMessage?: string;
  sentBy?: string;
  retryCount?: number;
  maxRetries?: number;
  nextAttemptAt?: ISODateString;
  templateId?: string;
  createdAt: ISODateString;
  sentAt?: ISODateString;
  deliveredAt?: ISODateString;
  readAt?: ISODateString;
}

export interface WhatsappTemplate {
  id: string;
  templateKey: string;
  metaTemplateName: string;
  languageCode: string;
  category: 'utility' | 'marketing' | 'authentication';
  bodyPreview: string;
  status: 'approved' | 'paused' | 'rejected' | 'draft';
}

export type AutomationRuleKey =
  | 'proposal_accepted_create_project'
  | 'task_overdue_follow_up'
  | 'payment_received_mark_paid';

export interface AutomationRule {
  id: string;
  ruleKey: AutomationRuleKey;
  name: string;
  description?: string;
  triggerKey: string;
  isActive: boolean;
  actions: Array<{ type: string; label: string }>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AutomationRun {
  id: string;
  ruleKey: AutomationRuleKey;
  eventSource: string;
  eventId: string;
  status: 'success' | 'skipped' | 'failed';
  details: Record<string, unknown>;
  createdAt: ISODateString;
}
