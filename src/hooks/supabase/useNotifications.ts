import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRepositoryContext } from './useRepositoryContext';
import {
  getOneSignalSnapshot,
  requestOneSignalPushPermission,
  setOneSignalConsent,
  subscribeToOneSignalPushChanges,
  syncOneSignalUser,
} from '../../lib/onesignal';
import { toDataLayerError } from '../../services';

type NotificationChannel = 'email' | 'push' | 'whatsapp';

type NotificationPreferenceRecord = {
  id: string;
  channel: NotificationChannel;
  enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  metadata: Record<string, unknown> | null;
};

type NotificationSubscriptionRecord = {
  id: string;
  channel: NotificationChannel;
  provider: string;
  provider_subscription_id: string | null;
  endpoint: string | null;
  status: 'active' | 'inactive' | 'revoked';
  metadata: Record<string, unknown> | null;
  last_seen_at: string | null;
};

type NotificationPreferenceState = {
  enabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  metadata: Record<string, unknown>;
};

type NotificationState = Record<NotificationChannel, NotificationPreferenceState>;

const DEFAULT_PREFERENCES: NotificationState = {
  email: {
    enabled: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    metadata: {},
  },
  push: {
    enabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    metadata: {},
  },
  whatsapp: {
    enabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    metadata: {},
  },
};

function mergePreferences(rows: NotificationPreferenceRecord[] | null | undefined): NotificationState {
  const nextState: NotificationState = {
    email: { ...DEFAULT_PREFERENCES.email },
    push: { ...DEFAULT_PREFERENCES.push },
    whatsapp: { ...DEFAULT_PREFERENCES.whatsapp },
  };

  for (const row of rows ?? []) {
    nextState[row.channel] = {
      enabled: row.enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      metadata: row.metadata ?? {},
    };
  }

  return nextState;
}

export function useSupabaseNotifications() {
  const { supabase, organizationId, currentUserId, currentUserName, currentUserRole } =
    useRepositoryContext();
  const [preferences, setPreferences] = useState<NotificationState>(DEFAULT_PREFERENCES);
  const [pushSubscription, setPushSubscription] = useState<NotificationSubscriptionRecord | null>(null);
  const [pushStatus, setPushStatus] = useState<{
    permission: boolean;
    subscriptionId: string | null;
    onesignalId: string | null;
    optedIn: boolean;
  }>({
    permission: false,
    subscriptionId: null,
    onesignalId: null,
    optedIn: false,
  });
  const [loading, setLoading] = useState(Boolean(organizationId));

  const loadNotificationState = useCallback(async () => {
    if (!organizationId) {
      setPreferences(DEFAULT_PREFERENCES);
      setPushSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [preferenceResult, subscriptionResult, oneSignalSnapshot] = await Promise.all([
        supabase
          .from('notification_preferences')
          .select('id, channel, enabled, quiet_hours_start, quiet_hours_end, metadata')
          .eq('organization_id', organizationId)
          .eq('user_id', currentUserId),
        supabase
          .from('notification_subscriptions')
          .select('id, channel, provider, provider_subscription_id, endpoint, status, metadata, last_seen_at')
          .eq('organization_id', organizationId)
          .eq('user_id', currentUserId)
          .eq('channel', 'push')
          .eq('provider', 'onesignal')
          .limit(1),
        getOneSignalSnapshot(),
      ]);

      if (preferenceResult.error) {
        throw preferenceResult.error;
      }

      if (subscriptionResult.error) {
        throw subscriptionResult.error;
      }

      setPreferences(mergePreferences(preferenceResult.data as NotificationPreferenceRecord[]));
      setPushSubscription(((subscriptionResult.data as NotificationSubscriptionRecord[] | null) ?? [])[0] ?? null);
      setPushStatus({
        permission: oneSignalSnapshot?.permission ?? false,
        subscriptionId: oneSignalSnapshot?.subscriptionId ?? null,
        onesignalId: oneSignalSnapshot?.onesignalId ?? null,
        optedIn: oneSignalSnapshot?.optedIn ?? false,
      });
    } catch (error) {
      console.warn(
        'Supabase notifications load failed:',
        toDataLayerError(error, 'Falha ao carregar preferencias de notificacao.'),
      );
      setPreferences(DEFAULT_PREFERENCES);
      setPushSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, organizationId, supabase]);

  const notificationQuery = useQuery({
    queryKey: ['notifications', organizationId, currentUserId],
    queryFn: async () => {
      await loadNotificationState();
      return true;
    },
    enabled: Boolean(currentUserId),
  });

  const upsertConsent = useCallback(
    async (channel: NotificationChannel, status: 'granted' | 'revoked') => {
      if (!organizationId) return;

      await supabase.from('consents').insert({
        organization_id: organizationId,
        subject_type: 'user',
        subject_id: currentUserId,
        subject_email: null,
        legal_basis: 'consent',
        purpose: channel === 'push' ? 'push_notifications' : 'transactional_notifications',
        channel,
        status,
        granted_at: status === 'granted' ? new Date().toISOString() : null,
        revoked_at: status === 'revoked' ? new Date().toISOString() : null,
        source: channel === 'push' ? 'onesignal_web_sdk' : 'application_settings',
        metadata: {
          actor_name: currentUserName,
        },
        created_by: currentUserId,
      });
    },
    [currentUserId, currentUserName, organizationId, supabase],
  );

  const persistPushSubscription = useCallback(
    async (payload: {
      subscriptionId: string | null;
      onesignalId: string | null;
      token: string | null;
      permission: boolean;
      optedIn: boolean;
    }) => {
      if (!organizationId) return;

      const metadata = {
        onesignal_id: payload.onesignalId,
        token: payload.token,
        permission: payload.permission,
        opted_in: payload.optedIn,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      };

      const { error } = await supabase.from('notification_subscriptions').upsert(
        {
          organization_id: organizationId,
          user_id: currentUserId,
          channel: 'push',
          provider: 'onesignal',
          provider_subscription_id: payload.subscriptionId,
          endpoint: payload.subscriptionId,
          status: payload.optedIn && payload.permission ? 'active' : payload.permission ? 'inactive' : 'revoked',
          last_seen_at: new Date().toISOString(),
          metadata,
        },
        {
          onConflict: 'organization_id,user_id,channel,provider',
        },
      );

      if (error) {
        throw error;
      }
    },
    [currentUserId, organizationId, supabase],
  );

  useEffect(() => {
    let detach: (() => void) | null = null;

    const startListener = async () => {
      detach = await subscribeToOneSignalPushChanges(async (event) => {
        const nextState = {
          permission: event.permission,
          subscriptionId: event.current.id,
          onesignalId: event.onesignalId,
          optedIn: event.current.optedIn,
        };

        setPushStatus(nextState);

        if (!organizationId) return;

        try {
          await persistPushSubscription({
            subscriptionId: event.current.id,
            onesignalId: event.onesignalId,
            token: event.current.token,
            permission: event.permission,
            optedIn: event.current.optedIn,
          });
          await upsertConsent('push', event.current.optedIn && event.permission ? 'granted' : 'revoked');
          await loadNotificationState();
        } catch (error) {
          console.warn(
            'OneSignal subscription sync failed:',
            toDataLayerError(error, 'Falha ao sincronizar a inscricao push.'),
          );
        }
      });
    };

    void startListener();

    return () => {
      detach?.();
    };
  }, [loadNotificationState, organizationId, persistPushSubscription, upsertConsent]);

  const setChannelEnabled = useCallback(
    async (channel: NotificationChannel, enabled: boolean) => {
      if (!organizationId) return;

      const nextState = {
        ...preferences[channel],
        enabled,
      };

      if (channel === 'push') {
        await setOneSignalConsent(enabled);

        if (enabled) {
          await syncOneSignalUser({
            userId: currentUserId,
            organizationId,
            role: currentUserRole,
          });
          const pushSnapshot = await requestOneSignalPushPermission();

          if (!pushSnapshot.permission || !pushSnapshot.optedIn) {
            await setOneSignalConsent(false);
            throw new Error('Push permission was not granted.');
          }

          setPushStatus({
            permission: pushSnapshot.permission,
            subscriptionId: pushSnapshot.subscriptionId,
            onesignalId: pushSnapshot.onesignalId,
            optedIn: pushSnapshot.optedIn,
          });
          await persistPushSubscription({
            subscriptionId: pushSnapshot.subscriptionId,
            onesignalId: pushSnapshot.onesignalId,
            token: pushSnapshot.token,
            permission: pushSnapshot.permission,
            optedIn: pushSnapshot.optedIn,
          });
          await upsertConsent('push', 'granted');
        } else {
          await persistPushSubscription({
            subscriptionId: pushStatus.subscriptionId,
            onesignalId: pushStatus.onesignalId,
            token: null,
            permission: false,
            optedIn: false,
          });
          await upsertConsent('push', 'revoked');
        }
      }

      const { error } = await supabase.from('notification_preferences').upsert(
        {
          organization_id: organizationId,
          user_id: currentUserId,
          channel,
          enabled,
          quiet_hours_start: nextState.quietHoursStart,
          quiet_hours_end: nextState.quietHoursEnd,
          metadata: nextState.metadata,
        },
        {
          onConflict: 'organization_id,user_id,channel',
        },
      );

      if (error) {
        throw error;
      }

      setPreferences((current) => ({
        ...current,
        [channel]: nextState,
      }));

      if (channel === 'email') {
        await upsertConsent('email', enabled ? 'granted' : 'revoked');
      }

      await loadNotificationState();
    },
    [
      currentUserId,
      currentUserRole,
      loadNotificationState,
      organizationId,
      persistPushSubscription,
      preferences,
      pushStatus.onesignalId,
      pushStatus.subscriptionId,
      supabase,
      upsertConsent,
    ],
  );

  const summary = useMemo(
    () => ({
      canUsePush: Boolean(pushStatus.permission || pushSubscription?.provider_subscription_id),
      pushSubscriptionId: pushSubscription?.provider_subscription_id ?? pushStatus.subscriptionId,
      pushProviderStatus: pushSubscription?.status ?? 'inactive',
    }),
    [pushStatus.permission, pushStatus.subscriptionId, pushSubscription?.provider_subscription_id, pushSubscription?.status],
  );

  return {
    preferences,
    pushStatus,
    pushSubscription,
    summary,
    loading: loading || notificationQuery.isLoading || notificationQuery.isFetching,
    setChannelEnabled,
    refreshNotifications: async () => {
      await notificationQuery.refetch();
    },
  };
}
