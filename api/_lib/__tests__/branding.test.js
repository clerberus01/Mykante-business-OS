import { describe, expect, it } from 'vitest';
import { defaultBranding, normalizePublicBranding } from '../branding.js';

describe('public branding normalization', () => {
  it('keeps safe branding values', () => {
    expect(
      normalizePublicBranding({
        branding: {
          appName: 'Portal Cliente',
          logoUrl: 'https://cdn.example.com/logo.png',
          primaryColor: '#123abc',
          portalTitle: 'Status',
        },
      }),
    ).toMatchObject({
      appName: 'Portal Cliente',
      logoUrl: 'https://cdn.example.com/logo.png',
      primaryColor: '#123abc',
      portalTitle: 'Status',
    });
  });

  it('drops unsafe logo URLs and invalid colors from public API output', () => {
    expect(
      normalizePublicBranding({
        branding: {
          logoUrl: 'http://127.0.0.1:54321/private.png',
          primaryColor: 'red',
          darkColor: '#111111',
        },
      }),
    ).toMatchObject({
      logoUrl: '',
      primaryColor: defaultBranding.primaryColor,
      darkColor: '#111111',
    });
  });

  it('rejects credentials, localhost and private network logo URLs', () => {
    for (const logoUrl of [
      'https://user:pass@example.com/logo.png',
      'https://localhost/logo.png',
      'https://192.168.0.10/logo.png',
      'https://[::1]/logo.png',
      'javascript:alert(1)',
    ]) {
      expect(normalizePublicBranding({ branding: { logoUrl } }).logoUrl).toBe('');
    }
  });
});
