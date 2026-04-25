export function toUnixTimestamp(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (!value) {
    return Date.now();
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function toIsoString(value: number | string | null | undefined) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

export function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}
