import { env } from './env';

type OneSignalPushState = {
  previous: {
    id: string | null;
    token: string | null;
    optedIn: boolean;
  };
  current: {
    id: string | null;
    token: string | null;
    optedIn: boolean;
  };
};

type OneSignalLike = {
  init: (options: Record<string, unknown>) => Promise<void>;
  setConsentRequired: (required: boolean) => void;
  setConsentGiven: (granted: boolean) => void;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications: {
    isPushSupported: () => boolean;
    permission: boolean;
    requestPermission: () => Promise<void>;
  };
  User: {
    onesignalId: string | null;
    addTags: (tags: Record<string, string>) => Promise<void>;
    PushSubscription: {
      id: string | null;
      token: string | null;
      optedIn?: boolean;
      addEventListener: (event: 'change', listener: (event: OneSignalPushState) => void) => void;
      removeEventListener: (event: 'change', listener: (event: OneSignalPushState) => void) => void;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalLike) => void | Promise<void>>;
  }
}

const ONESIGNAL_SDK_SRC = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

let sdkScriptPromise: Promise<void> | null = null;
let initialized = false;

function ensureDeferredQueue() {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  return window.OneSignalDeferred;
}

async function ensureSdkScriptLoaded() {
  if (sdkScriptPromise) {
    return sdkScriptPromise;
  }

  sdkScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${ONESIGNAL_SDK_SRC}"]`);

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolve();
        return;
      }

      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load OneSignal SDK.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = ONESIGNAL_SDK_SRC;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load OneSignal SDK.'));
    document.head.appendChild(script);
  });

  return sdkScriptPromise;
}

export async function initializeOneSignal() {
  if (typeof window === 'undefined' || !env.oneSignalAppId) {
    return false;
  }

  ensureDeferredQueue();
  await ensureSdkScriptLoaded();

  if (initialized) {
    return true;
  }

  await new Promise<void>((resolve, reject) => {
    ensureDeferredQueue().push(async (OneSignal) => {
      try {
        OneSignal.setConsentRequired(true);
        await OneSignal.init({
          appId: env.oneSignalAppId,
          allowLocalhostAsSecureOrigin: window.location.hostname === 'localhost',
          autoResubscribe: true,
          notifyButton: { enable: false },
          serviceWorkerPath: '/OneSignalSDKWorker.js',
        });
        initialized = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });

  return true;
}

async function runWithOneSignal<T>(callback: (oneSignal: OneSignalLike) => Promise<T> | T): Promise<T> {
  await initializeOneSignal();

  return await new Promise<T>((resolve, reject) => {
    ensureDeferredQueue().push(async (OneSignal) => {
      try {
        resolve(await callback(OneSignal));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function syncOneSignalUser(input: {
  userId: string;
  organizationId?: string | null;
  role?: string | null;
}) {
  if (!env.oneSignalAppId) return;

  await runWithOneSignal(async (OneSignal) => {
    await OneSignal.login(input.userId);

    const tags: Record<string, string> = {};
    if (input.organizationId) tags.organization_id = input.organizationId;
    if (input.role) tags.role = input.role;

    if (Object.keys(tags).length > 0) {
      await OneSignal.User.addTags(tags);
    }
  });
}

export async function logoutOneSignalUser() {
  if (!env.oneSignalAppId) return;

  await runWithOneSignal(async (OneSignal) => {
    await OneSignal.logout();
  });
}

export async function setOneSignalConsent(granted: boolean) {
  if (!env.oneSignalAppId) return;

  await runWithOneSignal((OneSignal) => {
    OneSignal.setConsentGiven(granted);
  });
}

export async function requestOneSignalPushPermission() {
  if (!env.oneSignalAppId) {
    throw new Error('OneSignal App ID is not configured.');
  }

  return runWithOneSignal(async (OneSignal) => {
    if (!OneSignal.Notifications.isPushSupported()) {
      throw new Error('Este navegador nao suporta notificacoes push.');
    }

    await OneSignal.Notifications.requestPermission();

    return {
      permission: OneSignal.Notifications.permission,
      subscriptionId: OneSignal.User.PushSubscription.id,
      token: OneSignal.User.PushSubscription.token,
      onesignalId: OneSignal.User.onesignalId,
      optedIn: OneSignal.User.PushSubscription.optedIn ?? false,
    };
  });
}

export async function getOneSignalSnapshot() {
  if (!env.oneSignalAppId) {
    return null;
  }

  return runWithOneSignal((OneSignal) => ({
    permission: OneSignal.Notifications.permission,
    subscriptionId: OneSignal.User.PushSubscription.id,
    token: OneSignal.User.PushSubscription.token,
    onesignalId: OneSignal.User.onesignalId,
    optedIn: OneSignal.User.PushSubscription.optedIn ?? false,
  }));
}

export async function subscribeToOneSignalPushChanges(
  listener: (event: OneSignalPushState & { onesignalId: string | null; permission: boolean }) => void,
) {
  if (!env.oneSignalAppId) {
    return () => undefined;
  }

  let registeredListener: ((event: OneSignalPushState) => void) | null = null;

  await runWithOneSignal((OneSignal) => {
    registeredListener = (event) => {
      listener({
        ...event,
        onesignalId: OneSignal.User.onesignalId,
        permission: OneSignal.Notifications.permission,
      });
    };

    OneSignal.User.PushSubscription.addEventListener('change', registeredListener);
  });

  return () => {
    if (!registeredListener) return;

    ensureDeferredQueue().push((OneSignal) => {
      OneSignal.User.PushSubscription.removeEventListener('change', registeredListener!);
    });
  };
}
