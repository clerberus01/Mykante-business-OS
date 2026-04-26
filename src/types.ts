export type EntityStatus = 'active' | 'inactive' | 'archived' | 'lead';

export interface Proposal {
  id: string;
  clientId: string;
  title: string;
  value: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt: number;
  updatedAt: number;
  validUntil: number;
  description?: string;
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
  status: EntityStatus;
  
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

  createdAt: number;
  updatedAt: number;
}

export type TimelineEventType = 'email' | 'whatsapp' | 'note' | 'file' | 'system';

export interface TimelineEvent {
  id: string;
  clientId: string;
  type: TimelineEventType;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  createdAt: number;
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
  expectedCloseAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type ProjectStatus = 'draft' | 'ongoing' | 'paused' | 'completed' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export interface Project {
  id: string;
  name: string;
  clientId: string; 
  description: string;
  status: ProjectStatus;
  startDate: number;
  deadline: number;
  budget: number;
  paymentStatus: PaymentStatus;
  progress: number; // 0 to 100
  financialBalance?: number; // Added for transversal visibility
  createdAt: number;
  updatedAt: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  estimatedDays: number;
  defaultBudget?: number;
  createdAt: number;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  order: number;
  status: 'pending' | 'completed';
  approvalStatus?: 'not_requested' | 'requested' | 'approved' | 'rejected';
  approvalUrl?: string;
  createdAt: number;
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
  dueDate?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectTimeEntry {
  id: string;
  projectId: string;
  taskId?: string;
  userId?: string;
  startedAt: number;
  stoppedAt?: number;
  durationMinutes?: number;
  billable?: boolean;
  hourlyRate?: number;
  billedAmount?: number;
  note?: string;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: number;
}

export type TransactionType = 'income' | 'expense';

export type TransactionStatus = 'pending' | 'liquidated' | 'cancelled';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: number;
  dueDate: number;
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
  createdAt: number;
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
  occurredAt: number;
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
  dueDate: number;
  status: InvoiceStatus;
  items: InvoiceItem[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
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
  createdAt: number;
  updatedAt: number;
}

export interface WhatsappConversation {
  id: string;
  clientId?: string;
  contactName: string;
  phoneE164: string;
  status: 'open' | 'archived';
  unreadCount: number;
  lastMessageBody?: string;
  lastMessageAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface WhatsappMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  providerMessageId?: string;
  errorMessage?: string;
  sentBy?: string;
  createdAt: number;
  sentAt?: number;
  deliveredAt?: number;
  readAt?: number;
}
