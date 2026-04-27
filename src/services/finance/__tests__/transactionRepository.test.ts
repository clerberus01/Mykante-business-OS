import { describe, expect, it, vi } from 'vitest';
import { SupabaseTransactionRepository } from '../transactionRepository';

function createSupabaseMock() {
  const calls: {
    insert?: Record<string, unknown>;
    update?: Record<string, unknown>;
  } = {};

  const query = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      calls.insert = payload;
      return query;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      calls.update = payload;
      return query;
    }),
    eq: vi.fn(() => query),
    select: vi.fn(async () => ({ data: [{ id: 'transaction-1' }], error: null })),
  };

  return {
    calls,
    supabase: {
      from: vi.fn(() => query),
    },
  };
}

describe('SupabaseTransactionRepository', () => {
  it('normalizes empty optional relation ids to null on create', async () => {
    const { calls, supabase } = createSupabaseMock();
    const repository = new SupabaseTransactionRepository(supabase as never, '00000000-0000-0000-0000-000000000001');

    await repository.createTransaction({
      type: 'expense',
      amount: 100,
      description: 'Teste',
      date: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-01-10T00:00:00.000Z',
      status: 'pending',
      categoryId: 'Outros',
      costCenterId: '',
      clientId: '',
      projectId: '',
    });

    expect(calls.insert).toMatchObject({
      cost_center_id: null,
      client_id: null,
      project_id: null,
    });
  });

  it('normalizes empty optional relation ids to null on update', async () => {
    const { calls, supabase } = createSupabaseMock();
    const repository = new SupabaseTransactionRepository(supabase as never, '00000000-0000-0000-0000-000000000001');

    await repository.updateTransaction('transaction-1', {
      costCenterId: '',
      clientId: '',
      projectId: '',
    });

    expect(calls.update).toEqual({
      cost_center_id: null,
      client_id: null,
      project_id: null,
    });
  });
});
