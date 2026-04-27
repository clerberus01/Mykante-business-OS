import {
  pendingNavigationIntentSchema,
  type PendingNavigationIntent,
} from '../schemas/navigation';

const STORAGE_KEY = 'mbos:pending-navigation-intent';

export function setPendingNavigationIntent(intent: PendingNavigationIntent) {
  if (typeof window === 'undefined') return;
  const parsedIntent = pendingNavigationIntentSchema.parse(intent);
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsedIntent));
}

export function getPendingNavigationIntent() {
  if (typeof window === 'undefined') return null;

  const rawValue = window.sessionStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return pendingNavigationIntentSchema.parse(JSON.parse(rawValue));
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearPendingNavigationIntent() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
