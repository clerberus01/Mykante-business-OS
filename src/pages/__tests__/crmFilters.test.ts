import { describe, expect, it } from 'vitest';
import { filterByClientId } from '../crmFilters';

describe('CRM filters', () => {
  it('keeps only records from the selected client', () => {
    const records = [
      { id: 'deal-1', clientId: 'client-1' },
      { id: 'deal-2', clientId: 'client-2' },
      { id: 'deal-3', clientId: 'client-1' },
    ];

    expect(filterByClientId(records, 'client-1')).toEqual([
      { id: 'deal-1', clientId: 'client-1' },
      { id: 'deal-3', clientId: 'client-1' },
    ]);
  });

  it('returns no records without a selected client', () => {
    expect(filterByClientId([{ id: 'deal-1', clientId: 'client-1' }], null)).toEqual([]);
  });
});
