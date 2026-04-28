import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client, Project, Task, Transaction } from '../../types';
import {
  createClientRepository,
  createProjectRepository,
  createTransactionRepository,
  toDataLayerError,
} from '../../services';
import { toIsoString } from '../../services/shared/mappers';
import { useRepositoryContext } from './useRepositoryContext';
import { queryKeys } from './queryKeys';

type TaskRecord = {
  id: string;
  project_id: string;
  milestone_id: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  responsible: string;
  checklist: Task['checklist'] | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type DashboardData = {
  clients: Client[];
  projects: Project[];
  transactions: Transaction[];
  tasks: Task[];
};

function mapTaskRecord(record: TaskRecord): Task {
  return {
    id: record.id,
    projectId: record.project_id,
    milestoneId: record.milestone_id,
    title: record.title,
    description: record.description ?? undefined,
    status: record.status,
    priority: record.priority,
    responsible: record.responsible,
    checklist: Array.isArray(record.checklist) ? record.checklist : [],
    dueDate: record.due_date ? toIsoString(record.due_date) : undefined,
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
  };
}

function getMonthBounds(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1).getTime();
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1).getTime();
  return { start, end };
}

function compareTasks(a: Task, b: Task) {
  const priorityWeight = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  } as const;

  const aWeight = priorityWeight[a.priority] ?? 0;
  const bWeight = priorityWeight[b.priority] ?? 0;

  if (aWeight !== bWeight) {
    return bWeight - aWeight;
  }

  const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

  if (aDue !== bDue) {
    return aDue - bDue;
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function compareProjects(a: Project, b: Project) {
  const statusWeight = {
    ongoing: 4,
    paused: 3,
    draft: 2,
    completed: 1,
    cancelled: 0,
  } as const;

  const aWeight = statusWeight[a.status] ?? 0;
  const bWeight = statusWeight[b.status] ?? 0;

  if (aWeight !== bWeight) {
    return bWeight - aWeight;
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function useSupabaseDashboard() {
  const { supabase, organizationId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const clientRepository = useMemo(
    () => (organizationId ? createClientRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const projectRepository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const transactionRepository = useMemo(
    () => (organizationId ? createTransactionRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const dashboardQueryKey = useMemo(() => queryKeys.dashboard.root(organizationId), [organizationId]);

  const fetchDashboard = useCallback(async (): Promise<DashboardData> => {
    if (!organizationId || !clientRepository || !projectRepository || !transactionRepository) {
      return {
        clients: [] as Client[],
        projects: [] as Project[],
        transactions: [] as Transaction[],
        tasks: [] as Task[],
      };
    }

    try {
      const [clientRows, projectRows, transactionRows, taskRows] = await Promise.all([
        clientRepository.listClients(),
        projectRepository.listProjects(),
        transactionRepository.listTransactions(),
        supabase
          .from('tasks')
          .select(
            'id, project_id, milestone_id, title, description, status, priority, responsible, checklist, due_date, created_at, updated_at',
          )
          .eq('organization_id', organizationId)
          .order('updated_at', { ascending: false })
          .limit(100),
      ]);

      if (taskRows.error) {
        throw taskRows.error;
      }

      return {
        clients: clientRows,
        projects: projectRows,
        transactions: transactionRows,
        tasks: ((taskRows.data as TaskRecord[] | null) ?? []).map(mapTaskRecord),
      };
    } catch (error) {
      console.warn(
        'Supabase dashboard load failed:',
        toDataLayerError(error, 'Falha ao carregar os dados do dashboard.'),
      );
      return {
        clients: [] as Client[],
        projects: [] as Project[],
        transactions: [] as Transaction[],
        tasks: [] as Task[],
      };
    }
  }, [clientRepository, organizationId, projectRepository, supabase, transactionRepository]);

  const loadDashboard = useCallback(
    () => queryClient.fetchQuery({
      queryKey: dashboardQueryKey,
      queryFn: fetchDashboard,
    }),
    [dashboardQueryKey, fetchDashboard, queryClient],
  );

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: dashboardQueryKey,
    enabled: Boolean(organizationId && clientRepository && projectRepository && transactionRepository),
    queryFn: fetchDashboard,
  });
  const dashboardData = dashboardQuery.error ? undefined : dashboardQuery.data;
  const clients = useMemo(() => dashboardData?.clients ?? [], [dashboardData?.clients]);
  const projects = useMemo(() => dashboardData?.projects ?? [], [dashboardData?.projects]);
  const transactions = useMemo(() => dashboardData?.transactions ?? [], [dashboardData?.transactions]);
  const tasks = useMemo(() => dashboardData?.tasks ?? [], [dashboardData?.tasks]);

  if (dashboardQuery.error) {
    console.warn(
      'Supabase dashboard load failed:',
      toDataLayerError(dashboardQuery.error, 'Falha ao carregar os dados do dashboard.'),
    );
  }

  const summary = useMemo(() => {
    const now = Date.now();
    const { start, end } = getMonthBounds();
    const monthlyIncome = transactions
      .filter(
        (transaction) =>
          transaction.type === 'income' &&
          transaction.status === 'liquidated' &&
          new Date(transaction.date).getTime() >= start &&
          new Date(transaction.date).getTime() < end,
      )
      .reduce((total, transaction) => total + transaction.amount, 0);

    const activeClients = clients.filter((client) => client.status === 'active').length;
    const activeProjects = projects.filter((project) => ['ongoing', 'paused'].includes(project.status)).length;
    const overdueProjects = projects.filter(
      (project) => ['ongoing', 'paused'].includes(project.status) && new Date(project.deadline).getTime() < now,
    ).length;
    const pendingTasks = tasks.filter((task) => task.status !== 'done').length;
    const urgentTasks = tasks.filter((task) => {
      if (task.status === 'done') return false;
      if (task.priority === 'urgent') return true;
      return Boolean(task.dueDate && new Date(task.dueDate).getTime() < now);
    }).length;

    return {
      monthlyIncome,
      activeClients,
      activeProjects,
      overdueProjects,
      pendingTasks,
      urgentTasks,
    };
  }, [clients, projects, tasks, transactions]);

  const featuredProjects = useMemo(() => [...projects].sort(compareProjects).slice(0, 4), [projects]);
  const backlogTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'done').sort(compareTasks).slice(0, 6),
    [tasks],
  );

  return {
    loading: dashboardQuery.isLoading,
    summary,
    featuredProjects,
    backlogTasks,
    refreshDashboard: loadDashboard,
  };
}
