import React from 'react';
import {
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Link,
  Loader2,
  Plus,
  Send,
  Users,
  Video,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSupabaseClients, useSupabaseProjects, useSupabaseTransactions } from '../hooks/supabase';
import { useRepositoryContext } from '../hooks/supabase/useRepositoryContext';

type CalendarEventType =
  | 'meeting'
  | 'review'
  | 'deadline'
  | 'technical_visit'
  | 'client_call'
  | 'time_block'
  | 'travel'
  | 'day_off'
  | 'maintenance';

type ManualCalendarEvent = {
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

type CalendarAttendee = {
  id: string;
  eventId: string;
  attendeeType: 'internal' | 'client' | 'external';
  name: string;
  email?: string;
  phoneE164?: string;
  responseStatus: 'pending' | 'confirmed' | 'declined';
};

type CalendarEvent = {
  id: string;
  dayKey: string;
  timestamp: number;
  endTimestamp?: number;
  title: string;
  subtitle: string;
  time: string;
  type: CalendarEventType;
  projectId?: string;
  target: 'project' | 'finance' | 'manual';
  manual?: ManualCalendarEvent;
};

type TaskRow = {
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

function startOfDayTimestamp(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDayKey(value: number) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateInput(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTimeInput(value: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatMonthLabel(value: Date) {
  return value.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

function getCalendarGrid(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - firstWeekday);

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function getEventIcon(type: CalendarEventType) {
  if (type === 'meeting' || type === 'client_call') return Video;
  if (type === 'deadline' || type === 'time_block' || type === 'travel') return Clock;
  if (type === 'technical_visit' || type === 'maintenance') return Users;
  return FileText;
}

function normalizeWhatsappPhone(value?: string) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function expandRecurringEvent(event: ManualCalendarEvent, month: Date) {
  const occurrences: ManualCalendarEvent[] = [];
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const maxUntil = Math.min(event.recurrenceUntil ?? monthEnd, monthEnd + 35 * 86400000);

  if (event.recurrenceRule === 'none') return [event];

  let start = event.startsAt;
  let end = event.endsAt;

  while (start <= maxUntil) {
    if (end >= monthStart && start < monthEnd) {
      occurrences.push({ ...event, startsAt: start, endsAt: end });
    }

    const nextStart = new Date(start);
    const nextEnd = new Date(end);

    if (event.recurrenceRule === 'weekly') {
      nextStart.setDate(nextStart.getDate() + 7);
      nextEnd.setDate(nextEnd.getDate() + 7);
    } else {
      nextStart.setMonth(nextStart.getMonth() + 1);
      nextEnd.setMonth(nextEnd.getMonth() + 1);
    }

    start = nextStart.getTime();
    end = nextEnd.getTime();
  }

  return occurrences;
}

interface CalendarProps {
  onOpenProject: (projectId: string) => void;
  onOpenFinance: () => void;
  onCreateTransaction: (timestamp: number) => void;
}

export default function Calendar({ onOpenProject, onOpenFinance, onCreateTransaction }: CalendarProps) {
  const { projects, loading: loadingProjects } = useSupabaseProjects();
  const { transactions, loading: loadingTransactions } = useSupabaseTransactions();
  const { clients } = useSupabaseClients();
  const { supabase, organizationId, currentUserId } = useRepositoryContext();
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [taskRows, setTaskRows] = React.useState<TaskRow[]>([]);
  const [manualEvents, setManualEvents] = React.useState<ManualCalendarEvent[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState(Boolean(organizationId));
  const [loadingManualEvents, setLoadingManualEvents] = React.useState(Boolean(organizationId));
  const [showEventModal, setShowEventModal] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<ManualCalendarEvent | null>(null);
  const [savingEvent, setSavingEvent] = React.useState(false);
  const [bookingLink, setBookingLink] = React.useState('');
  const today = React.useMemo(() => startOfDayTimestamp(Date.now()), []);
  const now = Date.now();
  const [eventForm, setEventForm] = React.useState(() => {
    const start = new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    return {
      title: '',
      description: '',
      eventType: 'meeting' as CalendarEventType,
      startsAt: formatDateTimeInput(start.getTime()),
      endsAt: formatDateTimeInput(end.getTime()),
      recurrenceRule: 'none' as 'none' | 'weekly' | 'monthly',
      recurrenceUntil: '',
      clientId: '',
      projectId: '',
      location: '',
      meetingUrl: '',
      attendees: '',
    };
  });

  const loadCalendarData = React.useCallback(async () => {
    if (!organizationId) {
      setTaskRows([]);
      setManualEvents([]);
      setLoadingTasks(false);
      setLoadingManualEvents(false);
      return;
    }

    setLoadingTasks(true);
    setLoadingManualEvents(true);

    try {
      const [taskResult, eventResult, attendeeResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, project_id, title, status, due_date')
          .eq('organization_id', organizationId)
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true }),
        supabase
          .from('calendar_events')
          .select('id, title, description, event_type, starts_at, ends_at, recurrence_rule, recurrence_until, client_id, project_id, location, meeting_url, status')
          .eq('organization_id', organizationId)
          .order('starts_at', { ascending: true }),
        supabase
          .from('calendar_event_attendees')
          .select('id, event_id, attendee_type, name, email, phone_e164, response_status')
          .eq('organization_id', organizationId),
      ]);

      if (taskResult.error) throw taskResult.error;
      setTaskRows((taskResult.data as TaskRow[] | null) ?? []);

      if (eventResult.error) {
        console.warn('Supabase manual calendar events load failed:', eventResult.error);
        setManualEvents([]);
      } else {
        const attendees = ((attendeeResult.data as CalendarAttendeeRecord[] | null) ?? []).map((attendee) => ({
          id: attendee.id,
          eventId: attendee.event_id,
          attendeeType: attendee.attendee_type,
          name: attendee.name,
          email: attendee.email ?? undefined,
          phoneE164: attendee.phone_e164 ?? undefined,
          responseStatus: attendee.response_status,
        }));

        setManualEvents(((eventResult.data as CalendarEventRecord[] | null) ?? []).map((event) => ({
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
          attendees: attendees.filter((attendee) => attendee.eventId === event.id),
        })));
      }
    } catch (error) {
      console.warn('Supabase calendar load failed:', error);
      setTaskRows([]);
    } finally {
      setLoadingTasks(false);
      setLoadingManualEvents(false);
    }
  }, [organizationId, supabase]);

  React.useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  const projectMap = React.useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const clientMap = React.useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  const openEventModal = React.useCallback((timestamp?: number) => {
    const start = new Date(timestamp ?? Date.now());
    start.setHours(timestamp ? 9 : start.getHours() + 1, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    setSelectedEvent(null);
    setEventForm({
      title: '',
      description: '',
      eventType: 'meeting',
      startsAt: formatDateTimeInput(start.getTime()),
      endsAt: formatDateTimeInput(end.getTime()),
      recurrenceRule: 'none',
      recurrenceUntil: '',
      clientId: '',
      projectId: '',
      location: '',
      meetingUrl: '',
      attendees: '',
    });
    setShowEventModal(true);
  }, []);

  const openManualEvent = React.useCallback((event: ManualCalendarEvent) => {
    setSelectedEvent(event);
    setEventForm({
      title: event.title,
      description: event.description ?? '',
      eventType: event.eventType,
      startsAt: formatDateTimeInput(event.startsAt),
      endsAt: formatDateTimeInput(event.endsAt),
      recurrenceRule: event.recurrenceRule,
      recurrenceUntil: event.recurrenceUntil ? formatDateInput(event.recurrenceUntil) : '',
      clientId: event.clientId ?? '',
      projectId: event.projectId ?? '',
      location: event.location ?? '',
      meetingUrl: event.meetingUrl ?? '',
      attendees: event.attendees.map((attendee) => [attendee.name, attendee.email, attendee.phoneE164].filter(Boolean).join(' | ')).join('\n'),
    });
    setShowEventModal(true);
  }, []);

  const saveManualEvent = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!organizationId) return;

    setSavingEvent(true);

    try {
      const payload = {
        organization_id: organizationId,
        title: eventForm.title,
        description: eventForm.description || null,
        event_type: eventForm.eventType,
        starts_at: new Date(eventForm.startsAt).toISOString(),
        ends_at: new Date(eventForm.endsAt).toISOString(),
        recurrence_rule: eventForm.recurrenceRule,
        recurrence_until: eventForm.recurrenceUntil ? new Date(eventForm.recurrenceUntil).toISOString() : null,
        client_id: eventForm.clientId || null,
        project_id: eventForm.projectId || null,
        location: eventForm.location || null,
        meeting_url: eventForm.meetingUrl || null,
        status: 'scheduled',
        created_by: currentUserId,
      };
      const result = selectedEvent
        ? await supabase
            .from('calendar_events')
            .update(payload)
            .eq('organization_id', organizationId)
            .eq('id', selectedEvent.id)
            .select('id')
            .single()
        : await supabase.from('calendar_events').insert(payload).select('id').single();

      if (result.error) throw result.error;

      const eventId = result.data.id as string;
      const attendees = eventForm.attendees
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name = '', email = '', phone = ''] = line.split('|').map((part) => part.trim());
          return {
            organization_id: organizationId,
            event_id: eventId,
            attendee_type: email.includes('@mykante') ? 'internal' : 'client',
            name,
            email: email || null,
            phone_e164: normalizeWhatsappPhone(phone) ? `+${normalizeWhatsappPhone(phone)}` : null,
          };
        });

      if (selectedEvent) {
        await supabase.from('calendar_event_attendees').delete().eq('organization_id', organizationId).eq('event_id', eventId);
      }

      if (attendees.length > 0) {
        const attendeeResult = await supabase.from('calendar_event_attendees').insert(attendees).select('id');
        if (attendeeResult.error) throw attendeeResult.error;
      }

      setShowEventModal(false);
      await loadCalendarData();
    } catch (error) {
      console.error('Calendar event save failed:', error);
      window.alert('Nao foi possivel salvar o evento do calendario. Verifique se a migration do calendario foi aplicada.');
    } finally {
      setSavingEvent(false);
    }
  };

  const createBookingLink = async () => {
    if (!organizationId) return;

    const token = crypto.randomUUID().slice(0, 8);
    const title = window.prompt('Titulo do link de agendamento', 'Agendar call com cliente')?.trim();

    if (!title) return;

    const { error } = await supabase.from('calendar_booking_links').insert({
      organization_id: organizationId,
      token,
      title,
      duration_minutes: 60,
      event_type: 'client_call',
      created_by: currentUserId,
    });

    if (error) {
      console.error('Booking link creation failed:', error);
      window.alert('Nao foi possivel criar o link de agendamento.');
      return;
    }

    const url = `${window.location.origin}/booking/${token}`;
    setBookingLink(url);
    window.open(`https://wa.me/?text=${encodeURIComponent(`Escolha seu horario para ${title}: ${url}`)}`, '_blank', 'noopener,noreferrer');
  };

  const sendWhatsappConfirmation = (event: ManualCalendarEvent) => {
    const attendee = event.attendees.find((item) => item.phoneE164) ?? event.attendees[0];
    const client = event.clientId ? clientMap.get(event.clientId) : undefined;
    const phone = normalizeWhatsappPhone(attendee?.phoneE164 || client?.contactPhone || client?.phone);

    if (!phone) {
      window.alert('Nenhum telefone encontrado para confirmar via WhatsApp.');
      return;
    }

    const message = [
      `Confirmar reuniao?`,
      `Evento: ${event.title}`,
      `Quando: ${new Date(event.startsAt).toLocaleString('pt-BR')}`,
      event.meetingUrl ? `Link: ${event.meetingUrl}` : '',
      `Responda CONFIRMAR ou REAGENDAR.`,
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const connectExternalCalendar = async (provider: 'google' | 'outlook') => {
    if (!organizationId) return;

    await supabase.from('calendar_external_sync_accounts').insert({
      organization_id: organizationId,
      provider,
      status: 'pending_oauth',
      webhook_status: 'not_configured',
      created_by: currentUserId,
    });

    window.alert(`${provider === 'google' ? 'Google Calendar' : 'Outlook'} registrado como pendente de OAuth. Configure client_id/client_secret e webhook no backend.`);
  };

  const events = React.useMemo(() => {
    const nextEvents: CalendarEvent[] = [];

    manualEvents.flatMap((event) => expandRecurringEvent(event, currentMonth)).forEach((event) => {
      nextEvents.push({
        id: `manual-${event.id}-${event.startsAt}`,
        dayKey: formatDayKey(event.startsAt),
        timestamp: event.startsAt,
        endTimestamp: event.endsAt,
        title: event.title,
        subtitle: event.eventType === 'time_block' ? 'Time blocking' : event.eventType === 'day_off' ? 'Folga' : 'Evento manual',
        time: formatTime(event.startsAt),
        type: event.eventType,
        projectId: event.projectId,
        target: 'manual',
        manual: event,
      });
    });

    projects.forEach((project) => {
      nextEvents.push({
        id: `project-${project.id}`,
        dayKey: formatDayKey(project.deadline),
        timestamp: project.deadline,
        title: project.name,
        subtitle: 'Prazo do projeto',
        time: formatTime(project.deadline),
        type: 'deadline',
        projectId: project.id,
        target: 'project',
      });
    });

    taskRows
      .filter((task) => task.status !== 'done' && task.due_date)
      .forEach((task) => {
        const dueDate = new Date(task.due_date as string).getTime();
        const project = projectMap.get(task.project_id);

        nextEvents.push({
          id: `task-${task.id}`,
          dayKey: formatDayKey(dueDate),
          timestamp: dueDate,
          title: task.title,
          subtitle: project ? `Tarefa - ${project.name}` : 'Tarefa pendente',
          time: formatTime(dueDate),
          type: 'review',
          projectId: task.project_id,
          target: project ? 'project' : 'finance',
        });
      });

    transactions
      .filter((transaction) => transaction.status !== 'liquidated')
      .forEach((transaction) => {
        nextEvents.push({
          id: `transaction-${transaction.id}`,
          dayKey: formatDayKey(transaction.dueDate),
          timestamp: transaction.dueDate,
          title: transaction.description,
          subtitle: transaction.type === 'income' ? 'Recebimento previsto' : 'Pagamento previsto',
          time: formatTime(transaction.dueDate),
          type: 'meeting',
          target: 'finance',
        });
      });

    return nextEvents.sort((left, right) => left.timestamp - right.timestamp);
  }, [clientMap, currentMonth, manualEvents, projectMap, projects, taskRows, transactions]);

  const monthDays = React.useMemo(() => getCalendarGrid(currentMonth), [currentMonth]);

  const visibleMonthEvents = React.useMemo(
    () =>
      events.filter((event) => {
        const eventDate = new Date(event.timestamp);
        return eventDate.getFullYear() === currentMonth.getFullYear() && eventDate.getMonth() === currentMonth.getMonth();
      }),
    [currentMonth, events],
  );

  const upcomingEvents = React.useMemo(() => events.filter((event) => event.timestamp >= today).slice(0, 3), [events, today]);
  const weekStart = React.useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);
  const weekEnd = weekStart + 7 * 86400000;
  const weeklyManualEvents = manualEvents.filter((event) => event.startsAt >= weekStart && event.startsAt < weekEnd);
  const weeklyScheduledHours = weeklyManualEvents.reduce((total, event) => total + Math.max(0, event.endsAt - event.startsAt) / 3600000, 0);
  const teamOccupancy = Math.min(100, Math.round((weeklyScheduledHours / Math.max(1, 40 * Math.max(1, new Set(weeklyManualEvents.flatMap((event) => event.attendees.map((attendee) => attendee.name))).size))) * 100));
  const recurringLateCount = manualEvents.filter((event) => event.recurrenceRule !== 'none' && event.status !== 'completed' && event.endsAt < now).length;
  const loading = loadingProjects || loadingTransactions || loadingTasks || loadingManualEvents;

  const handleOpenEvent = React.useCallback(
    (event: CalendarEvent) => {
      if (event.target === 'manual' && event.manual) {
        openManualEvent(event.manual);
        return;
      }

      if (event.target === 'project' && event.projectId) {
        onOpenProject(event.projectId);
        return;
      }

      onOpenFinance();
    },
    [onOpenFinance, onOpenProject, openManualEvent],
  );

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">
              Schedule
            </span>
            <span className="text-[10px] font-mono text-gray-400">UPCOMING_EVENTS: {visibleMonthEvents.length}</span>
          </div>
          <h2 className="text-2xl font-bold text-os-text tracking-tight">Calendario de Atividades</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-100 rounded px-3 py-1 shadow-sm">
            <button type="button" onClick={() => setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="p-1 hover:bg-gray-50 rounded transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-xs font-bold text-os-text px-4 uppercase tracking-widest">{formatMonthLabel(currentMonth)}</span>
            <button type="button" onClick={() => setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="p-1 hover:bg-gray-50 rounded transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <button type="button" onClick={createBookingLink} className="bg-white border border-gray-100 text-os-text text-[10px] px-4 py-2 rounded font-bold hover:border-brand hover:text-brand transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm">
            <Link className="w-3.5 h-3.5" />
            Booking
          </button>
          <button type="button" onClick={() => openEventModal()} className="bg-brand text-white text-[10px] px-4 py-2 rounded font-bold hover:bg-os-dark transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm shadow-brand/20">
            <CalendarPlus className="w-3.5 h-3.5" />
            Novo Evento
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Horas agendadas/semana</p>
          <p className="text-2xl font-black text-os-text">{Math.round(weeklyScheduledHours * 10) / 10}h</p>
        </div>
        <div className="bg-white p-4 rounded border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Ocupacao da equipe</p>
          <p className="text-2xl font-black text-brand">{teamOccupancy}%</p>
        </div>
        <div className="bg-white p-4 rounded border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Atrasos recorrentes</p>
          <p className="text-2xl font-black text-red-500">{recurringLateCount}</p>
        </div>
        <div className="bg-white p-4 rounded border border-gray-100 shadow-sm flex items-center gap-2">
          <button type="button" onClick={() => void connectExternalCalendar('google')} className="flex-1 py-2 bg-gray-50 rounded text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-brand">
            Google OAuth
          </button>
          <button type="button" onClick={() => void connectExternalCalendar('outlook')} className="flex-1 py-2 bg-gray-50 rounded text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-brand">
            Outlook OAuth
          </button>
        </div>
      </div>

      {bookingLink && (
        <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded p-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-between">
          <span>Link de booking criado: {bookingLink}</span>
          <button type="button" onClick={() => navigator.clipboard?.writeText(bookingLink)} className="underline">Copiar</button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-7 border-t border-l border-gray-100 bg-white">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((day) => (
          <div key={day} className="p-3 border-r border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
            {day}
          </div>
        ))}
        {monthDays.map((day, index) => {
          const dayTimestamp = startOfDayTimestamp(day.getTime());
          const isToday = dayTimestamp === today;
          const isOutOfMonth = day.getMonth() !== currentMonth.getMonth();
          const dayEvents = visibleMonthEvents.filter((event) => event.dayKey === formatDayKey(dayTimestamp));

          return (
            <div key={`${day.toISOString()}-${index}`} className={cn('min-h-[120px] p-2 border-r border-b border-gray-100 transition-colors hover:bg-gray-50/50 relative group', isOutOfMonth ? 'bg-gray-50/20 opacity-30 pointer-events-none' : '')}>
              <span className={cn('text-[10px] font-mono font-bold w-6 h-6 flex items-center justify-center rounded-full mb-2 transition-all', isToday ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-400 group-hover:text-os-text')}>
                {day.getDate()}
              </span>

              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    title={`${event.subtitle} • ${event.time}`}
                    onClick={() => handleOpenEvent(event)}
                    className={cn(
                      'p-1.5 rounded-[2px] border text-[9px] font-bold truncate leading-tight transition-transform hover:scale-[1.02] cursor-pointer',
                      event.type === 'meeting' || event.type === 'client_call'
                        ? 'bg-blue-50 border-blue-100 text-blue-600'
                        : event.type === 'deadline'
                          ? 'bg-red-50 border-red-100 text-red-600'
                          : event.type === 'time_block' || event.type === 'travel' || event.type === 'day_off'
                            ? 'bg-gray-100 border-gray-200 text-gray-600'
                            : 'bg-amber-50 border-amber-100 text-amber-600',
                    )}
                  >
                    <span className="opacity-60 mr-1">{event.time}</span>
                    {event.title}
                  </div>
                ))}
              </div>

              {!isOutOfMonth && (
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button type="button" onClick={() => openEventModal(dayTimestamp)} className="p-1 bg-white border border-gray-100 rounded text-gray-300 hover:text-brand hover:border-brand shadow-sm">
                    <CalendarPlus className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => onCreateTransaction(dayTimestamp)} className="p-1 bg-white border border-gray-100 rounded text-gray-300 hover:text-brand hover:border-brand shadow-sm">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {loading && (
          <div className="md:col-span-3 bg-white p-6 rounded border border-gray-100 shadow-sm text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
            Carregando agenda operacional...
          </div>
        )}
        {!loading &&
          upcomingEvents.map((item) => {
            const Icon = getEventIcon(item.type);

            return (
              <div key={item.id} onClick={() => handleOpenEvent(item)} className="bg-white p-4 rounded border border-gray-100 shadow-sm flex items-center gap-4 group hover:border-brand transition-all cursor-pointer">
                <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-brand transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-mono text-gray-400 font-bold mb-0.5">{item.time}</p>
                  <h4 className="text-xs font-bold text-os-text leading-tight">{item.title}</h4>
                  <p className="text-[9px] font-mono text-gray-300 uppercase mt-1">{item.subtitle}</p>
                </div>
                {item.manual && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      sendWhatsappConfirmation(item.manual as ManualCalendarEvent);
                    }}
                    className="p-2 text-green-600 bg-green-50 rounded hover:bg-green-100"
                    title="Confirmar via WhatsApp"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
                <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-os-text transform group-hover:translate-x-1 transition-all" />
              </div>
            );
          })}
      </div>

      {showEventModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-os-dark/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase text-os-text">{selectedEvent ? 'Editar Evento' : 'Novo Evento'}</h3>
                <p className="text-[10px] font-mono uppercase text-gray-400">Reunioes, calls, visitas, bloqueios, folgas e recorrencias</p>
              </div>
              <button type="button" onClick={() => setShowEventModal(false)} className="p-2 hover:bg-gray-50 rounded text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveManualEvent} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input required value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} placeholder="Titulo do evento" className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold outline-none focus:border-brand" />
                <select value={eventForm.eventType} onChange={(event) => setEventForm({ ...eventForm, eventType: event.target.value as CalendarEventType })} className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold uppercase outline-none">
                  <option value="meeting">Reuniao</option>
                  <option value="client_call">Call com cliente</option>
                  <option value="technical_visit">Visita tecnica</option>
                  <option value="time_block">Time blocking / foco</option>
                  <option value="travel">Viagem</option>
                  <option value="day_off">Folga</option>
                  <option value="maintenance">Manutencao</option>
                </select>
                <input required type="datetime-local" value={eventForm.startsAt} onChange={(event) => setEventForm({ ...eventForm, startsAt: event.target.value })} className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-mono font-bold outline-none focus:border-brand" />
                <input required type="datetime-local" value={eventForm.endsAt} onChange={(event) => setEventForm({ ...eventForm, endsAt: event.target.value })} className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-mono font-bold outline-none focus:border-brand" />
                <select value={eventForm.recurrenceRule} onChange={(event) => setEventForm({ ...eventForm, recurrenceRule: event.target.value as 'none' | 'weekly' | 'monthly' })} className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold uppercase outline-none">
                  <option value="none">Sem recorrencia</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
                <input type="date" value={eventForm.recurrenceUntil} onChange={(event) => setEventForm({ ...eventForm, recurrenceUntil: event.target.value })} className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-mono font-bold outline-none focus:border-brand" />
                <select value={eventForm.clientId} onChange={(event) => setEventForm({ ...eventForm, clientId: event.target.value })} className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold uppercase outline-none">
                  <option value="">Cliente opcional</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
                <select value={eventForm.projectId} onChange={(event) => setEventForm({ ...eventForm, projectId: event.target.value })} className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold uppercase outline-none">
                  <option value="">Projeto opcional</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                <input value={eventForm.location} onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })} placeholder="Local / endereco" className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold outline-none focus:border-brand" />
                <input value={eventForm.meetingUrl} onChange={(event) => setEventForm({ ...eventForm, meetingUrl: event.target.value })} placeholder="Link da call" className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold outline-none focus:border-brand" />
              </div>
              <textarea value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} rows={3} placeholder="Descricao / pauta" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold outline-none focus:border-brand resize-none" />
              <textarea value={eventForm.attendees} onChange={(event) => setEventForm({ ...eventForm, attendees: event.target.value })} rows={4} placeholder="Participantes: Nome | email | telefone. Um por linha." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold outline-none focus:border-brand resize-none" />
              {selectedEvent && (
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.attendees.map((attendee) => (
                    <span key={attendee.id} className="px-2 py-1 rounded bg-gray-50 border border-gray-100 text-[9px] font-bold uppercase text-gray-500 flex items-center gap-1">
                      <CheckCircle2 className={cn('w-3 h-3', attendee.responseStatus === 'confirmed' ? 'text-green-500' : 'text-gray-300')} />
                      {attendee.name}: {attendee.responseStatus}
                    </span>
                  ))}
                </div>
              )}
              <div className="pt-4 border-t border-gray-100 flex gap-3">
                {selectedEvent && (
                  <button type="button" onClick={() => sendWhatsappConfirmation(selectedEvent)} className="px-4 py-3 bg-green-50 text-green-600 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Confirmar WhatsApp
                  </button>
                )}
                {eventForm.meetingUrl && (
                  <a href={eventForm.meetingUrl} target="_blank" rel="noreferrer" className="px-4 py-3 bg-gray-50 text-gray-500 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Abrir Link
                  </a>
                )}
                <button type="button" onClick={() => setShowEventModal(false)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Cancelar</button>
                <button type="submit" disabled={savingEvent} className="flex-[2] py-3 bg-brand text-white rounded text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                  {savingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Salvar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
