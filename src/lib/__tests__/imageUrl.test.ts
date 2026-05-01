import { describe, expect, it } from 'vitest';
import { assertOptionalImageUrl, normalizeOptionalImageUrl } from '../imageUrl';

describe('image URL validation', () => {
  it('normalizes valid public HTTPS image URLs', () => {
    expect(normalizeOptionalImageUrl(' https://cdn.example.com/avatar.png ')).toBe(
      'https://cdn.example.com/avatar.png',
    );
    expect(assertOptionalImageUrl('https://assets.example.com/logo.svg', 'Logo')).toBe(
      'https://assets.example.com/logo.svg',
    );
  });

  it('allows empty optional image URLs', () => {
    expect(normalizeOptionalImageUrl('')).toBe('');
    expect(assertOptionalImageUrl('   ', 'Avatar')).toBe('');
  });

  it('rejects unsafe image URL shapes', () => {
    expect(normalizeOptionalImageUrl('http://cdn.example.com/avatar.png')).toBe('');
    expect(normalizeOptionalImageUrl('javascript:alert(1)')).toBe('');
    expect(normalizeOptionalImageUrl('https://user:pass@cdn.example.com/avatar.png')).toBe('');
    expect(() => assertOptionalImageUrl('http://cdn.example.com/avatar.png', 'Avatar')).toThrow(
      'Avatar deve ser uma URL HTTPS publica valida.',
    );
  });

  it('rejects local or private hosts', () => {
    expect(normalizeOptionalImageUrl('https://localhost/avatar.png')).toBe('');
    expect(normalizeOptionalImageUrl('https://127.0.0.1/avatar.png')).toBe('');
    expect(normalizeOptionalImageUrl('https://10.0.0.1/avatar.png')).toBe('');
    expect(normalizeOptionalImageUrl('https://192.168.0.10/avatar.png')).toBe('');
    expect(normalizeOptionalImageUrl('https://[::1]/avatar.png')).toBe('');
  });
});
