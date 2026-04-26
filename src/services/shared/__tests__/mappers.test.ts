import { describe, expect, it } from 'vitest';
import { normalizeStringArray, toIsoString, toUnixTimestamp } from '../mappers';

describe('shared mappers', () => {
  it('keeps valid unix timestamps unchanged', () => {
    expect(toUnixTimestamp(1710000000000)).toBe(1710000000000);
  });

  it('converts ISO dates to unix timestamps', () => {
    expect(toUnixTimestamp('2026-01-02T03:04:05.000Z')).toBe(Date.parse('2026-01-02T03:04:05.000Z'));
  });

  it('converts unix timestamps to ISO strings', () => {
    expect(toIsoString(Date.parse('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z');
  });

  it('normalizes mixed arrays into string arrays', () => {
    expect(normalizeStringArray(['crm', 10, null, 'projetos'])).toEqual(['crm', 'projetos']);
  });
});
