type PendingNavigationIntent =
  | { kind: 'open-project'; projectId: string }
  | { kind: 'create-project' }
  | { kind: 'open-client'; clientId: string }
  | { kind: 'create-client' }
  | { kind: 'create-transaction'; timestamp?: number }
  | { kind: 'upload-document' };

const STORAGE_KEY = 'mbos:pending-navigation-intent';

export function setPendingNavigationIntent(intent: PendingNavigationIntent) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

export function getPendingNavigationIntent() {
  if (typeof window === 'undefined') return null;

  const rawValue = window.sessionStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingNavigationIntent;
  } catch {
    return null;
  }
}

export function clearPendingNavigationIntent() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
