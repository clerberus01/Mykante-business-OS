import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPendingNavigationIntent,
  getPendingNavigationIntent,
  setPendingNavigationIntent,
} from '../navigation';

describe('pending navigation intent', () => {
  afterEach(() => {
    clearPendingNavigationIntent();
  });

  it('stores and reads a valid intent', () => {
    setPendingNavigationIntent({ kind: 'open-project', projectId: 'project-1' });

    expect(getPendingNavigationIntent()).toEqual({
      kind: 'open-project',
      projectId: 'project-1',
    });
  });

  it('clears malformed stored intents', () => {
    window.sessionStorage.setItem(
      'mbos:pending-navigation-intent',
      JSON.stringify({ kind: 'unknown' }),
    );

    expect(getPendingNavigationIntent()).toBeNull();
    expect(window.sessionStorage.getItem('mbos:pending-navigation-intent')).toBeNull();
  });
});
