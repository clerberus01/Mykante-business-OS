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

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  order: number;
  status: 'pending' | 'completed';
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
  checklist: { id: string; text: string; completed: boolean }[];
  dueDate?: number;
  createdAt: number;
  updatedAt: number;
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
  clientId?: string;
  projectId?: string;
  isRecurring?: boolean;
  recurrenceInterval?: 'monthly' | 'weekly' | 'yearly';
  attachmentUrl?: string; // Link to receipt in Supabase
  createdAt: number;
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
