import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { BankStatementLine, CostCenter, FinanceCategory, Transaction } from '../../types';
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
  cost_center_id?: string | null;
  client_id: string | null;
  project_id: string | null;
  is_recurring: boolean | null;
  recurrence_interval: Transaction['recurrenceInterval'] | null;
  attachment_url: string | null;
  payment_provider?: Transaction['paymentProvider'] | null;
  payment_method?: Transaction['paymentMethod'] | null;
  payment_url?: string | null;
  provider_payment_id?: string | null;
  bank_statement_line_id?: string | null;
  created_at: string;
};

const transactionRecordSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number(),
  description: z.string(),
  date: z.string(),
  due_date: z.string(),
  status: z.enum(['pending', 'liquidated', 'cancelled']),
  category_id: z.string(),
  cost_center_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  is_recurring: z.boolean().nullable(),
  recurrence_interval: z.enum(['monthly', 'weekly', 'yearly']).nullable(),
  attachment_url: z.string().nullable(),
  payment_provider: z.enum(['pagseguro', 'manual']).nullable().optional(),
  payment_method: z.enum(['pix', 'boleto']).nullable().optional(),
  payment_url: z.string().nullable().optional(),
  provider_payment_id: z.string().nullable().optional(),
  bank_statement_line_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
});

function mapTransactionRecord(record: TransactionRecord): Transaction {
  return {
    id: record.id,
    type: record.type,
    amount: Number(record.amount),
    description: record.description,
    date: toIsoString(record.date),
    dueDate: toIsoString(record.due_date),
    status: record.status,
    categoryId: record.category_id,
    costCenterId: record.cost_center_id ?? undefined,
    clientId: record.client_id ?? undefined,
    projectId: record.project_id ?? undefined,
    isRecurring: record.is_recurring ?? undefined,
    recurrenceInterval: record.recurrence_interval ?? undefined,
    attachmentUrl: record.attachment_url ?? undefined,
    paymentProvider: record.payment_provider ?? undefined,
    paymentMethod: record.payment_method ?? undefined,
    paymentUrl: record.payment_url ?? undefined,
    providerPaymentId: record.provider_payment_id ?? undefined,
    bankStatementLineId: record.bank_statement_line_id ?? undefined,
    createdAt: toIsoString(record.created_at),
  };
}

function scoreMatch(line: { description: string; amount: number; occurredAt: string }, transaction: Transaction) {
  const amountScore = Math.abs(line.amount - transaction.amount) < 0.01 ? 60 : 0;
  const days = Math.abs(new Date(line.occurredAt).getTime() - new Date(transaction.dueDate).getTime()) / 86400000;
  const dateScore = days <= 1 ? 25 : days <= 3 ? 15 : 0;
  const descriptionScore = transaction.description
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .some((word) => line.description.toLowerCase().includes(word)) ? 15 : 0;

  return amountScore + dateScore + descriptionScore;
}

function optionalId(value: string | null | undefined) {
  return value?.trim() ? value : null;
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

    return transactionRecordSchema.array().parse(rows).map(mapTransactionRecord);
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
          cost_center_id: optionalId(transaction.costCenterId),
          client_id: optionalId(transaction.clientId),
          project_id: optionalId(transaction.projectId),
          is_recurring: transaction.isRecurring ?? false,
          recurrence_interval: transaction.recurrenceInterval ?? null,
          attachment_url: transaction.attachmentUrl ?? null,
          payment_provider: transaction.paymentProvider ?? null,
          payment_method: transaction.paymentMethod ?? null,
          payment_url: transaction.paymentUrl ?? null,
          provider_payment_id: transaction.providerPaymentId ?? null,
          bank_statement_line_id: transaction.bankStatementLineId ?? null,
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
    if (data.costCenterId !== undefined) payload.cost_center_id = optionalId(data.costCenterId);
    if (data.clientId !== undefined) payload.client_id = optionalId(data.clientId);
    if (data.projectId !== undefined) payload.project_id = optionalId(data.projectId);
    if (data.isRecurring !== undefined) payload.is_recurring = data.isRecurring;
    if (data.recurrenceInterval !== undefined) payload.recurrence_interval = data.recurrenceInterval ?? null;
    if (data.attachmentUrl !== undefined) payload.attachment_url = data.attachmentUrl ?? null;
    if (data.paymentProvider !== undefined) payload.payment_provider = data.paymentProvider ?? null;
    if (data.paymentMethod !== undefined) payload.payment_method = data.paymentMethod ?? null;
    if (data.paymentUrl !== undefined) payload.payment_url = data.paymentUrl ?? null;
    if (data.providerPaymentId !== undefined) payload.provider_payment_id = data.providerPaymentId ?? null;
    if (data.bankStatementLineId !== undefined) payload.bank_statement_line_id = data.bankStatementLineId ?? null;

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

  async listCategories(): Promise<FinanceCategory[]> {
    const rows = await this.unwrap(
      this.supabase
        .from('finance_categories')
        .select('id, name, type, dre_group')
        .eq('organization_id', this.organizationId)
        .eq('active', true)
        .order('name', { ascending: true }),
      'Nao foi possivel carregar categorias financeiras.',
    );

    return (rows as Array<{ id: string; name: string; type: FinanceCategory['type']; dre_group: string }>).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      dreGroup: row.dre_group,
    }));
  }

  async createCategory(name: string, type: FinanceCategory['type'], dreGroup = 'operational') {
    await this.unwrap(
      this.supabase.from('finance_categories').insert({
        organization_id: this.organizationId,
        name,
        type,
        dre_group: dreGroup,
      }).select('id'),
      'Nao foi possivel criar categoria financeira.',
    );
  }

  async listCostCenters(): Promise<CostCenter[]> {
    const rows = await this.unwrap(
      this.supabase
        .from('cost_centers')
        .select('id, name, code')
        .eq('organization_id', this.organizationId)
        .eq('active', true)
        .order('name', { ascending: true }),
      'Nao foi possivel carregar centros de custo.',
    );

    return (rows as Array<{ id: string; name: string; code: string | null }>).map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code ?? undefined,
    }));
  }

  async createCostCenter(name: string, code?: string) {
    await this.unwrap(
      this.supabase.from('cost_centers').insert({
        organization_id: this.organizationId,
        name,
        code: code ?? null,
      }).select('id'),
      'Nao foi possivel criar centro de custo.',
    );
  }

  async generatePaymentRequest(transaction: Transaction, method: 'pix' | 'boleto') {
    const paymentUrl = `https://sandbox.pagseguro.uol.com.br/checkout/${transaction.id}-${method}`;
    const providerPaymentId = `pagseguro_${transaction.id.slice(0, 8)}_${method}`;

    await this.unwrap(
      this.supabase.from('payment_requests').insert({
        organization_id: this.organizationId,
        transaction_id: transaction.id,
        provider: 'pagseguro',
        method,
        status: 'created',
        payment_url: paymentUrl,
        provider_payment_id: providerPaymentId,
        payload: { sandbox: true, provider: 'pagseguro', amount: transaction.amount },
      }).select('id'),
      'Nao foi possivel gerar cobranca.',
    );

    await this.updateTransaction(transaction.id, {
      paymentProvider: 'pagseguro',
      paymentMethod: method,
      paymentUrl,
      providerPaymentId,
    });

    return paymentUrl;
  }

  async importBankStatement(fileName: string, content: string, transactions: Transaction[], userId?: string) {
    const importRows = await this.unwrap(
      this.supabase.from('bank_statement_imports').insert({
        organization_id: this.organizationId,
        file_name: fileName,
        imported_by: userId ?? null,
      }).select('id').limit(1),
      'Nao foi possivel importar extrato bancario.',
    );
    const importId = (importRows as Array<{ id: string }>)[0]?.id;
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 200)
      .map((line) => {
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        const [date = '', description = '', amount = '0'] = parts.map((part) => part.trim());
        const occurredAt = new Date(date).getTime();
        const parsedAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
        return {
          description: description || line,
          amount: Number.isFinite(parsedAmount) ? Math.abs(parsedAmount) : 0,
          occurredAt: Number.isFinite(occurredAt) ? new Date(occurredAt).toISOString() : new Date().toISOString(),
        };
      });

    const payload = lines.map((line) => {
      const best = transactions
        .filter((transaction) => transaction.status === 'pending')
        .map((transaction) => ({ transaction, score: scoreMatch(line, transaction) }))
        .sort((left, right) => right.score - left.score)[0];

      return {
        organization_id: this.organizationId,
        import_id: importId,
        occurred_at: toIsoString(line.occurredAt),
        description: line.description,
        amount: line.amount,
        matched_transaction_id: best?.score >= 70 ? best.transaction.id : null,
        match_confidence: best?.score ?? 0,
        status: best?.score >= 70 ? 'matched' : 'unmatched',
      };
    });

    if (payload.length > 0) {
      await this.unwrap(
        this.supabase.from('bank_statement_lines').insert(payload).select('id'),
        'Nao foi possivel gravar linhas do extrato.',
      );
    }

    await Promise.all(
      payload
        .filter((line) => line.matched_transaction_id)
        .map((line) => this.updateTransaction(line.matched_transaction_id as string, { status: 'liquidated' })),
    );

    return payload.length;
  }

  async listBankStatementLines(): Promise<BankStatementLine[]> {
    const rows = await this.unwrap(
      this.supabase
        .from('bank_statement_lines')
        .select('id, description, amount, occurred_at, matched_transaction_id, match_confidence, status')
        .eq('organization_id', this.organizationId)
        .order('occurred_at', { ascending: false })
        .limit(50),
      'Nao foi possivel carregar conciliacao bancaria.',
    );

    return (rows as Array<{
      id: string;
      description: string;
      amount: number;
      occurred_at: string;
      matched_transaction_id: string | null;
      match_confidence: number | null;
      status: BankStatementLine['status'];
    }>).map((row) => ({
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      occurredAt: toIsoString(row.occurred_at),
      matchedTransactionId: row.matched_transaction_id ?? undefined,
      matchConfidence: row.match_confidence ?? undefined,
      status: row.status,
    }));
  }
}

export function createTransactionRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseTransactionRepository(supabase, organizationId);
}
