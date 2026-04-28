import type React from 'react';

export type OrganizationBranding = {
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  darkColor?: string;
  backgroundColor?: string;
  textColor?: string;
  portalTitle?: string;
  portalSubtitle?: string;
};

export const defaultBranding: Required<OrganizationBranding> = {
  appName: 'Mykante Business OS',
  logoUrl: '',
  primaryColor: '#FF6321',
  darkColor: '#141414',
  backgroundColor: '#F8F9FA',
  textColor: '#1A1A1A',
  portalTitle: 'Acompanhamento do pedido',
  portalSubtitle: 'Consulta segura por email',
};

const hexColorPattern = /^#[0-9a-f]{6}$/i;

function validColor(value: unknown, fallback: string) {
  return typeof value === 'string' && hexColorPattern.test(value.trim()) ? value.trim() : fallback;
}

function validText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizeBranding(input: unknown): Required<OrganizationBranding> {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};

  return {
    appName: validText(source.appName, defaultBranding.appName),
    logoUrl: typeof source.logoUrl === 'string' ? source.logoUrl.trim() : defaultBranding.logoUrl,
    primaryColor: validColor(source.primaryColor, defaultBranding.primaryColor),
    darkColor: validColor(source.darkColor, defaultBranding.darkColor),
    backgroundColor: validColor(source.backgroundColor, defaultBranding.backgroundColor),
    textColor: validColor(source.textColor, defaultBranding.textColor),
    portalTitle: validText(source.portalTitle, defaultBranding.portalTitle),
    portalSubtitle: validText(source.portalSubtitle, defaultBranding.portalSubtitle),
  };
}

export function getBrandingStyle(branding: OrganizationBranding | null | undefined): React.CSSProperties {
  const normalized = normalizeBranding(branding);

  return {
    '--brand-color': normalized.primaryColor,
    '--os-dark-color': normalized.darkColor,
    '--os-bg-color': normalized.backgroundColor,
    '--os-text-color': normalized.textColor,
  } as React.CSSProperties;
}
