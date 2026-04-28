import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepositoryContext } from './useRepositoryContext';
import { queryKeys } from './queryKeys';

export type CalendarEventType =
  | 'meeting'
  | 'review'
  | 'deadline'
  | 'technical_visit'
  | 'client_call'
  | 'time_block'
  | 'travel'
  | 'day_off'
  | 'maintenance';

export type CalendarAttendee = {
  id: string;
  eventId: string;
  attendeeType: 'internal' | 'client' | 'external';
  name: string;
  email?: string;
  phoneE164?: string;
  responseStatus: 'pending' | 'confirmed' | 'declined';
};

export type ManualCalendarEvent = {
  id: string;
  title: string;
  description?: string;
  eventType: CalendarEventType;
  startsAt: number;
  endsAt: number;
  recurrenceRule: 'none' | 'weekly' | 'monthly';
  recurrenceUntil?: number;
  clientId?: string;
  projectId?: string;
  location?: string;
  meetingUrl?: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  attendees: CalendarAttendee[];
};

export type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
  due_date: string | null;
};

type CalendarEventRecord = {
  id: string;
  title: string;
  description: string | null;
  event_type: CalendarEventType;
  starts_at: string;
  ends_at: string;
  recurrence_rule: 'none' | 'weekly' | 'monthly' | null;
  recurrence_until: string | null;
  client_id: string | null;
  project_id: string | null;
  location: string | null;
  meeting_url: string | null;
  status: ManualCalendarEvent['status'];
};

type CalendarAttendeeRecord = {
  id: string;
  event_id: string;
  attendee_type: CalendarAttendee['attendeeType'];
  name: string;
  email: string | null;
  phone_e164: string | null;
  response_status: CalendarAttendee['responseStatus'];
};

type CalendarState = {
  taskRows: TaskRow[];
  manualEvents: ManualCalendarEvent[];
};

type CalendarEventInput = {
  id?: string;
  title: string;
  description: string | null;
  eventType: CalendarEventType;
  startsAt: string;
  endsAt: string;
  recurrenceRule: 'none' | 'weekly' | 'monthly';
  recurrenceUntil: string | null;
  clientId: string | null;
  projectId: string | null;
  location: string | null;
  meetingUrl: string | null;
  attendees: Array<{
    attendeeType: CalendarAttendee['attendeeType'];
    name: string;
    email: string | null;
    phoneE164: string | null;
  }>;
};

function mapManualEvents(
  events: CalendarEventRecord[] | null | undefined,
  attendees: CalendarAttendeeRecord[] | null | undefined,
) {
  const mappedAttendees = (attendees ?? []).map((attendee) => ({
    id: attendee.id,
    eventId: attendee.event_id,
    attendeeType: attendee.attendee_type,
    name: attendee.name,
    email: attendee.email ?? undefined,
    phoneE164: attendee.phone_e164 ?? undefined,
    responseStatus: attendee.response_status,
  }));

  return (events ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description ?? undefined,
    eventType: event.event_type,
    startsAt: new Date(event.starts_at).getTime(),
    endsAt: new Date(event.ends_at).getTime(),
    recurrenceRule: event.recurrence_rule ?? 'none',
    recurrenceUntil: event.recurrence_until ? new Date(event.recurrence_until).getTime() : undefined,
    clientId: event.client_id ?? undefined,
    projectId: event.project_id ?? undefined,
    location: event.location ?? undefined,
    meetingUrl: event.meeting_url ?? undefined,
    status: event.status,
    attendees: mappedAttendees.filter((attendee) => attendee.eventId === event.id),
  }));
}

export function useSupabaseCalendar() {
  const { supabase, organizationId, currentUserId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const calendarQueryKey = queryKeys.calendar.root(organizationId);

  const calendarQuery = useQuery<CalendarState>({
    queryKey: calendarQueryKey,
    enabled: Boolean(organizationId),
    initialData: { taskRows: [], manualEvents: [] },
    queryFn: async () => {
      if (!organizationId) {
        return { taskRows: [], manualEvents: [] };
      }

      const [taskResult, eventResult, attendeeResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, project_id, title, status, due_date')
          .eq('organization_id', organizationId)
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true }),
        supabase
          .from('calendar_events')
          .select(
            'id, title, description, event_type, starts_at, ends_at, recurrence_rule, recurrence_until, client_id, project_id, location, meeting_url, status',
          )
          .eq('organization_id', organizationId)
          .order('starts_at', { ascending: true }),
        supabase
          .from('calendar_event_attendees')
          .select('id, event_id, attendee_type, name, email, phone_e164, response_status')
          .eq('organization_id', organizationId),
      ]);

      if (taskResult.error) throw taskResult.error;
      if (eventResult.error) throw eventResult.error;
      if (attendeeResult.error) throw attendeeResult.error;

      return {
        taskRows: (taskResult.data as TaskRow[] | null) ?? [],
        manualEvents: mapManualEvents(
          eventResult.data as CalendarEventRecord[] | null,
          attendeeResult.data as CalendarAttendeeRecord[] | null,
        ),
      };
    },
  });

  const saveEventMutation = useMutation({
    mutationFn: async (event: CalendarEventInput) => {
      if (!organizationId) return;

      const payload = {
        organization_id: organizationId,
        title: event.title,
        description: event.description,
        event_type: event.eventType,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        recurrence_rule: event.recurrenceRule,
        recurrence_until: event.recurrenceUntil,
        client_id: event.clientId,
        project_id: event.projectId,
        location: event.location,
        meeting_url: event.meetingUrl,
        status: 'scheduled',
        created_by: currentUserId,
      };

      const result = event.id
        ? await supabase
            .from('calendar_events')
            .update(payload)
            .eq('organization_id', organizationId)
            .eq('id', event.id)
            .select('id')
            .single()
        : await supabase.from('calendar_events').insert(payload).select('id').single();

      if (result.error) throw result.error;

      const eventId = result.data.id as string;
      const attendees = event.attendees.map((attendee) => ({
        organization_id: organizationId,
        event_id: eventId,
        attendee_type: attendee.attendeeType,
        name: attendee.name,
        email: attendee.email,
        phone_e164: attendee.phoneE164,
      }));

      if (event.id) {
        const deleteResult = await supabase
          .from('calendar_event_attendees')
          .delete()
          .eq('organization_id', organizationId)
          .eq('event_id', eventId);

        if (deleteResult.error) throw deleteResult.error;
      }

      if (attendees.length > 0) {
        const attendeeResult = await supabase.from('calendar_event_attendees').insert(attendees).select('id');
        if (attendeeResult.error) throw attendeeResult.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: calendarQueryKey });
    },
  });

  const createBookingLinkMutation = useMutation({
    mutationFn: async ({ token, title }: { token: string; title: string }) => {
      if (!organizationId) return null;

      const { error } = await supabase.from('calendar_booking_links').insert({
        organization_id: organizationId,
        token,
        title,
        duration_minutes: 60,
        event_type: 'client_call',
        created_by: currentUserId,
      });

      if (error) throw error;
      return token;
    },
  });

  const connectExternalCalendarMutation = useMutation({
    mutationFn: async (provider: 'google' | 'outlook') => {
      if (!organizationId) return;

      const { error } = await supabase.from('calendar_external_sync_accounts').insert({
        organization_id: organizationId,
        provider,
        status: 'pending_oauth',
        webhook_status: 'not_configured',
        created_by: currentUserId,
      });

      if (error) throw error;
    },
  });

  if (calendarQuery.error) {
    console.warn('Supabase calendar load failed:', calendarQuery.error);
  }

  return {
    taskRows: calendarQuery.data.taskRows,
    manualEvents: calendarQuery.data.manualEvents,
    loading: calendarQuery.isLoading || calendarQuery.isFetching,
    savingEvent: saveEventMutation.isPending,
    saveManualEvent: saveEventMutation.mutateAsync,
    createBookingLink: createBookingLinkMutation.mutateAsync,
    connectExternalCalendar: connectExternalCalendarMutation.mutateAsync,
    refreshCalendar: async () => {
      await calendarQuery.refetch();
    },
  };
}
