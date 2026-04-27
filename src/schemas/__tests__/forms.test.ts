import { describe, expect, it } from 'vitest';
import { projectFormSchema, transactionFormSchema } from '..';

describe('form schemas', () => {
  it('accepts valid project form data and coerces budget', () => {
    const result = projectFormSchema.parse({
      name: 'Projeto',
      clientId: 'client-1',
      description: '',
      status: 'ongoing',
      startDate: '2026-01-01',
      deadline: '2026-01-10',
      budget: '1500',
      paymentStatus: 'pending',
      templateId: '',
    });

    expect(result.budget).toBe(1500);
  });

  it('rejects a project deadline before the start date', () => {
    expect(() =>
      projectFormSchema.parse({
        name: 'Projeto',
        clientId: 'client-1',
        description: '',
        status: 'draft',
        startDate: '2026-01-10',
        deadline: '2026-01-01',
        budget: 100,
        paymentStatus: 'pending',
      }),
    ).toThrow('O prazo deve ser igual ou posterior ao inicio.');
  });

  it('rejects a finance transaction without positive amount', () => {
    expect(() =>
      transactionFormSchema.parse({
        type: 'expense',
        amount: 0,
        description: 'Conta',
        date: '2026-01-01',
        dueDate: '2026-01-05',
        status: 'pending',
        categoryId: 'Outros',
      }),
    ).toThrow('Informe um valor maior que zero.');
  });
});
