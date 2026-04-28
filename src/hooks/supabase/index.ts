export { useSupabaseClients, useSupabaseEvents, useSupabasePipeline } from '../../features/crm/hooks/useClients';
export {
  useSupabaseProjects,
  useSupabaseMilestones,
  useSupabaseTasks,
  useSupabaseProjectTeam,
  useSupabaseProjectActivity,
} from '../../features/projects/hooks/useProjects';
export { useSupabaseTransactions } from '../../features/finance/hooks/useFinance';
export { useSupabaseProposals } from '../../features/crm/hooks/useProposals';
export { useSupabaseDocuments } from '../../features/documents/hooks/useDocuments';
export { useSupabaseNotifications } from './useNotifications';
export { useSupabasePrivacy } from './usePrivacy';
export { useSupabaseDashboard } from '../../features/dashboard/hooks/useDashboard';
export { useSupabaseWhatsapp } from '../../features/communications/hooks/useWhatsapp';
export {
  useSupabaseCalendar,
  type CalendarAttendee,
  type CalendarEventType,
  type ManualCalendarEvent,
  type TaskRow,
} from '../../features/calendar/hooks/useCalendar';
export { useSupabaseSettings } from '../../features/settings/hooks/useSettings';
export { useClientAvatarUpload } from '../../features/crm/hooks/useClientAvatarUpload';
export { useSupabaseAutomations } from '../../features/automations/hooks/useAutomations';
export { useSupabaseContracts } from '../../features/contracts/hooks/useContracts';
export { useDomainEventsRealtime } from './useDomainEvents';
