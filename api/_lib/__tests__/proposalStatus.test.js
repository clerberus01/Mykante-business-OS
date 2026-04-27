import { describe, expect, it } from 'vitest';
import {
  isAuthorizedClientEmail,
  mapPublicProposalStatus,
  normalizeEmail,
} from '../proposalStatus.js';

describe('public proposal status helpers', () => {
  it('normalizes emails before authorization', () => {
    expect(normalizeEmail(' Cliente@Email.com ')).toBe('cliente@email.com');
    expect(
      isAuthorizedClientEmail('cliente@email.com', {
        email: 'CLIENTE@email.com',
        contact_email: null,
      }),
    ).toBe(true);
  });

  it('accepts contact email as an authorized email', () => {
    expect(
      isAuthorizedClientEmail('financeiro@empresa.com', {
        email: 'diretoria@empresa.com',
        contact_email: 'financeiro@empresa.com',
      }),
    ).toBe(true);
  });

  it('maps only public proposal fields', () => {
    expect(
      mapPublicProposalStatus({
        id: 'proposal-1',
        title: 'Site',
        status: 'sent',
        value: '1500.50',
        description: 'Escopo',
        valid_until: '2026-05-01T00:00:00.000Z',
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-02T00:00:00.000Z',
        clients: { name: 'Cliente', email: 'cliente@email.com' },
      }),
    ).toEqual({
      id: 'proposal-1',
      title: 'Site',
      status: 'sent',
      value: 1500.5,
      description: 'Escopo',
      validUntil: '2026-05-01T00:00:00.000Z',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
      clientName: 'Cliente',
    });
  });
});
