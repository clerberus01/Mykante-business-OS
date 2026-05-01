import { describe, expect, it } from 'vitest';
import { defaultBranding, normalizeBranding } from '../branding';

describe('normalizeBranding', () => {
  it('keeps valid HTTPS logo URLs', () => {
    expect(normalizeBranding({ logoUrl: 'https://cdn.example.com/logo.png' }).logoUrl).toBe(
      'https://cdn.example.com/logo.png',
    );
  });

  it('drops unsafe logo URLs', () => {
    expect(normalizeBranding({ logoUrl: 'http://cdn.example.com/logo.png' }).logoUrl).toBe(
      defaultBranding.logoUrl,
    );
    expect(normalizeBranding({ logoUrl: 'https://localhost/logo.png' }).logoUrl).toBe(
      defaultBranding.logoUrl,
    );
  });
});
