import type { SupabaseClient } from '@supabase/supabase-js';
import type { Transaction } from '../../types';
import { SupabaseRepository } from '../shared/supabaseRepository';
import { toIsoString, toUnixTimestamp } from '../shared/mappers';

type TransactionRecord = {
  id: string;
  organization_id: string;
  type: Transaction['type'];
  amount: number;
  description: string;
  date: string;
  due_date: string;
  status: Transaction['status'];
  category_id: string;
  client_id: string | null;
  project_id: string | null;
  is_recurring: boolean | null;
  recurrence_interval: Transaction['recurrenceInterval'] | null;
  attachment_url: string | null;
  created_at: string;
};

function mapTransactionRecord(record: TransactionRecord): Transaction {
  return {
    id: record.id,
    type: record.type,
    amount: Number(record.amount),
    description: record.description,
    date: toUnixTimestamp(record.date),
    dueDate: toUnixTimestamp(record.due_date),
    status: record.status,
    categoryId: record.category_id,
    clientId: record.client_id ?? undefined,
    projectId: record.project_id ?? undefined,
    isRecurring: record.is_recurring ?? undefined,
    recurrenceInterval: record.recurrence_interval ?? undefined,
    attachmentUrl: record.attachment_url ?? undefined,
    createdAt: toUnixTimestamp(record.created_at),
  };
}

export class SupabaseTransactionRepository extends SupabaseRepository {
  constructor(supabase: SupabaseClient, organizationId: string) {
    super(supabase, organizationId);
  }

  async listTransactions() {
    const rows = await this.unwrap(
      this.supabase
        .from('transactions')
        .select('*')
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .order('date', { ascending: false }),
      'Nao foi possivel carregar os lancamentos financeiros.',
    );

    return (rows as TransactionRecord[]).map(mapTransactionRecord);
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
    await this.unwrap(
      this.supabase
        .from('transactions')
        .insert({
          organization_id: this.organizationId,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          date: toIsoString(transaction.date),
          due_date: toIsoString(transaction.dueDate),
          status: transaction.status,
          category_id: transaction.categoryId,
          client_id: transaction.clientId ?? null,
          project_id: transaction.projectId ?? null,
          is_recurring: transaction.isRecurring ?? false,
          recurrence_interval: transaction.recurrenceInterval ?? null,
          attachment_url: transaction.attachmentUrl ?? null,
        })
        .select('id'),
      'Nao foi possivel criar o lancamento financeiro.',
    );
  }

  async updateTransaction(id: string, data: Partial<Transaction>) {
    const payload: Record<string, unknown> = {};

    if (data.type !== undefined) payload.type = data.type;
    if (data.amount !== undefined) payload.amount = data.amount;
    if (data.description !== undefined) payload.description = data.description;
    if (data.date !== undefined) payload.date = toIsoString(data.date);
    if (data.dueDate !== undefined) payload.due_date = toIsoString(data.dueDate);
    if (data.status !== undefined) payload.status = data.status;
    if (data.categoryId !== undefined) payload.category_id = data.categoryId;
    if (data.clientId !== undefined) payload.client_id = data.clientId ?? null;
    if (data.projectId !== undefined) payload.project_id = data.projectId ?? null;
    if (data.isRecurring !== undefined) payload.is_recurring = data.isRecurring;
    if (data.recurrenceInterval !== undefined) payload.recurrence_interval = data.recurrenceInterval ?? null;
    if (data.attachmentUrl !== undefined) payload.attachment_url = data.attachmentUrl ?? null;

    await this.unwrap(
      this.supabase
        .from('transactions')
        .update(payload)
        .eq('organization_id', this.organizationId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel atualizar o lancamento financeiro.',
    );
  }
}

export function createTransactionRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseTransactionRepository(supabase, organizationId);
}
