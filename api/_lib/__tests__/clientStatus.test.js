import { describe, expect, it } from 'vitest';
import {
  isAuthorizedClientEmail,
  mapPublicClientStatus,
  normalizeEmail,
} from '../clientStatus.js';

describe('public client status helpers', () => {
  it('authorizes the primary client email', () => {
    expect(normalizeEmail(' Cliente@Email.com ')).toBe('cliente@email.com');
    expect(
      isAuthorizedClientEmail('cliente@email.com', {
        email: 'CLIENTE@email.com',
        contact_email: null,
      }),
    ).toBe(true);
  });

  it('maps public client status with proposals and pipeline', () => {
    expect(
      mapPublicClientStatus(
        {
          id: 'client-1',
          name: 'Cliente',
          status: 'lead',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-02T00:00:00.000Z',
          public_status_closed_at: null,
        },
        [{ id: 'proposal-1', title: 'Site', status: 'sent', value: '1000', valid_until: '2026-05-01', updated_at: '2026-04-03' }],
        [{ id: 'deal-1', title: 'Orcamento', status: 'open', value: '1000', probability: 50, updated_at: '2026-04-04', crm_pipeline_stages: { name: 'Fechamento' } }],
      ),
    ).toMatchObject({
      id: 'client-1',
      proposals: [{ id: 'proposal-1', value: 1000 }],
      pipeline: [{ id: 'deal-1', stageName: 'Fechamento' }],
    });
  });
});
