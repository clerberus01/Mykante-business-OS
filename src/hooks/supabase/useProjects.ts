import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Milestone, Project, ProjectTemplate, Task } from '../../types';
import { createProjectRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';
import { queryKeys } from './queryKeys';

function getQueryError(error: unknown, fallbackMessage: string) {
  return error ? toDataLayerError(error, fallbackMessage) : null;
}

export function useSupabaseProjects() {
  const { supabase, organizationId } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const queryClient = useQueryClient();
  const projectsQueryKey = useMemo(() => queryKeys.projects.root(organizationId), [organizationId]);
  const projectsQuery = useQuery({
    queryKey: projectsQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listProjects();
    },
  });

  const loadProjects = useCallback(async () => {
    if (!repository) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: projectsQueryKey,
        queryFn: () => repository.listProjects(),
      });
    } catch (error) {
      console.warn('Supabase projects load failed:', toDataLayerError(error, 'Falha ao carregar projetos.'));
      return [];
    }
  }, [projectsQueryKey, queryClient, repository]);

  const templatesQueryKey = useMemo(() => queryKeys.projects.templates(organizationId), [organizationId]);
  const templatesQuery = useQuery({
    queryKey: templatesQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listProjectTemplates();
    },
  });

  const addProjectMutation = useMutation({
    mutationFn: async ({
      project,
      templateId,
    }: {
      project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>;
      templateId?: string;
    }) => {
      if (!repository) return undefined;
      return repository.createProjectFromTemplate(project, templateId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
      if (!repository) return;
      await repository.updateProject(id, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!repository) return;
      await repository.softDeleteProject(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const projectsError = getQueryError(projectsQuery.error, 'Falha ao carregar projetos.');
  const templatesError = getQueryError(templatesQuery.error, 'Falha ao carregar templates de projeto.');
  const projectListError = projectsError ?? templatesError;

  if (projectsError) {
    console.warn('Supabase projects load failed:', projectsError);
  }

  if (templatesError) {
    console.warn('Supabase project templates load failed:', templatesError);
  }

  return {
    projects: projectsQuery.data ?? [],
    templates: templatesQuery.data ?? [] as ProjectTemplate[],
    loading: projectsQuery.isLoading,
    error: projectListError,
    hasError: Boolean(projectListError),
    addProject: (
      project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>,
      templateId?: string,
    ) => addProjectMutation.mutateAsync({ project, templateId }),
    updateProject: (id: string, data: Partial<Project>) => updateProjectMutation.mutateAsync({ id, data }),
    deleteProject: deleteProjectMutation.mutateAsync,
    refreshProjects: loadProjects,
  };
}

export function useSupabaseMilestones(projectId: string | null) {
  const { supabase, organizationId } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const queryClient = useQueryClient();
  const milestonesQueryKey = useMemo(
    () => queryKeys.projects.milestones(organizationId, projectId),
    [organizationId, projectId],
  );
  const milestonesQuery = useQuery({
    queryKey: milestonesQueryKey,
    enabled: Boolean(repository && projectId),
    queryFn: async () => {
      if (!repository || !projectId) return [];
      return repository.listMilestones(projectId);
    },
  });

  const loadMilestones = useCallback(async () => {
    if (!repository || !projectId) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: milestonesQueryKey,
        queryFn: () => repository.listMilestones(projectId),
      });
    } catch (error) {
      console.warn(
        'Supabase milestones load failed:',
        toDataLayerError(error, 'Falha ao carregar etapas do projeto.'),
      );
      return [];
    }
  }, [milestonesQueryKey, projectId, queryClient, repository]);

  const addMilestoneMutation = useMutation({
    mutationFn: async (milestone: Omit<Milestone, 'id' | 'createdAt'>) => {
      if (!repository || !projectId) return;
      return repository.createMilestone(projectId, milestone);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milestonesQueryKey });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Milestone> }) => {
      if (!repository || !projectId) return;
      await repository.updateMilestone(projectId, id, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milestonesQueryKey });
    },
  });

  const requestMilestoneApprovalMutation = useMutation({
    mutationFn: async ({ id, approvalUrl }: { id: string; approvalUrl: string }) => {
      if (!repository || !projectId) return undefined;
      return repository.requestMilestoneApproval(projectId, id, approvalUrl);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milestonesQueryKey });
    },
  });

  const milestonesError = getQueryError(milestonesQuery.error, 'Falha ao carregar etapas do projeto.');

  if (milestonesError) {
    console.warn(
      'Supabase milestones load failed:',
      milestonesError,
    );
  }

  return {
    milestones: milestonesQuery.data ?? [],
    loading: milestonesQuery.isLoading,
    error: milestonesError,
    hasError: Boolean(milestonesError),
    addMilestone: addMilestoneMutation.mutateAsync,
    updateMilestone: (id: string, data: Partial<Milestone>) => updateMilestoneMutation.mutateAsync({ id, data }),
    requestMilestoneApproval: (id: string, approvalUrl: string) =>
      requestMilestoneApprovalMutation.mutateAsync({ id, approvalUrl }),
    refreshMilestones: loadMilestones,
  };
}

export function useSupabaseTasks(projectId: string | null) {
  const { supabase, organizationId, currentUserId, currentUserName } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const queryClient = useQueryClient();
  const tasksQueryKey = useMemo(
    () => queryKeys.projects.tasks(organizationId, projectId, currentUserId),
    [currentUserId, organizationId, projectId],
  );
  const tasksQuery = useQuery({
    queryKey: tasksQueryKey,
    enabled: Boolean(repository && projectId),
    queryFn: async () => {
      if (!repository || !projectId) return [];
      return repository.listTasks(projectId, currentUserId);
    },
  });

  const loadTasks = useCallback(async () => {
    if (!repository || !projectId) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: tasksQueryKey,
        queryFn: () => repository.listTasks(projectId, currentUserId),
      });
    } catch (error) {
      console.warn('Supabase tasks load failed:', toDataLayerError(error, 'Falha ao carregar tarefas.'));
      return [];
    }
  }, [currentUserId, projectId, queryClient, repository, tasksQueryKey]);

  const addTaskMutation = useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!repository || !projectId) return;
      return repository.createTask(projectId, {
        ...task,
        responsibleId: task.responsibleId ?? currentUserId,
        responsible: task.responsible || currentUserName,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.root(organizationId) }),
      ]);
      await queryClient.refetchQueries({ queryKey: tasksQueryKey });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      if (!repository || !projectId) return;
      await repository.updateTask(projectId, id, data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.root(organizationId) }),
      ]);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!repository || !projectId) return;
      await repository.deleteTask(projectId, id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey });
      const previousTasks = queryClient.getQueryData<Task[]>(tasksQueryKey);

      queryClient.setQueryData<Task[]>(tasksQueryKey, (current) =>
        (current ?? []).filter((task) => task.id !== id),
      );

      return { previousTasks };
    },
    onError: (_error, _id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(tasksQueryKey, context.previousTasks);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.root(organizationId) }),
      ]);
      await queryClient.refetchQueries({ queryKey: tasksQueryKey });
    },
  });

  const addChecklistItemMutation = useMutation({
    mutationFn: async ({ taskId, text }: { taskId: string; text: string }) => {
      if (!repository || !projectId) return;
      await repository.addChecklistItem(projectId, taskId, text, currentUserId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });

  const updateChecklistItemMutation = useMutation({
    mutationFn: async ({ taskId, itemId, completed }: { taskId: string; itemId: string; completed: boolean }) => {
      if (!repository || !projectId) return;
      await repository.updateChecklistItem(projectId, taskId, itemId, completed);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.root(organizationId) }),
      ]);
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!repository || !projectId) return;
      await repository.startTimeEntry(projectId, taskId, currentUserId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: async ({ entryId, hourlyRate }: { entryId: string; hourlyRate?: number }) => {
      if (!repository || !projectId) return;
      await repository.stopTimeEntry(projectId, entryId, hourlyRate);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.transactions(organizationId) }),
      ]);
    },
  });

  const tasksError = getQueryError(tasksQuery.error, 'Falha ao carregar tarefas.');

  if (tasksError) {
    console.warn('Supabase tasks load failed:', tasksError);
  }

  return {
    tasks: tasksQuery.data ?? [],
    loading: tasksQuery.isLoading,
    error: tasksError,
    hasError: Boolean(tasksError),
    addTask: addTaskMutation.mutateAsync,
    updateTask: (id: string, data: Partial<Task>) => updateTaskMutation.mutateAsync({ id, data }),
    deleteTask: deleteTaskMutation.mutateAsync,
    addChecklistItem: (taskId: string, text: string) => addChecklistItemMutation.mutateAsync({ taskId, text }),
    updateChecklistItem: (taskId: string, itemId: string, completed: boolean) =>
      updateChecklistItemMutation.mutateAsync({ taskId, itemId, completed }),
    startTimer: startTimerMutation.mutateAsync,
    stopTimer: (entryId: string, hourlyRate?: number) => stopTimerMutation.mutateAsync({ entryId, hourlyRate }),
    refreshTasks: loadTasks,
  };
}

export function useSupabaseProjectActivity(projectId: string | null) {
  const { supabase, organizationId, currentUserId, currentUserName } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const queryClient = useQueryClient();
  const activityQueryKey = useMemo(
    () => queryKeys.projects.activity(organizationId, projectId),
    [organizationId, projectId],
  );
  const activityQuery = useQuery({
    queryKey: activityQueryKey,
    enabled: Boolean(repository && projectId),
    queryFn: async () => {
      if (!repository || !projectId) return [];
      return repository.listActivity(projectId);
    },
  });

  const loadActivities = useCallback(async () => {
    if (!repository || !projectId) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: activityQueryKey,
        queryFn: () => repository.listActivity(projectId),
      });
    } catch (error) {
      console.warn(
        'Supabase project activity load failed:',
        toDataLayerError(error, 'Falha ao carregar a atividade do projeto.'),
      );
      return [];
    }
  }, [activityQueryKey, projectId, queryClient, repository]);

  const addActivityMutation = useMutation({
    mutationFn: async ({ action, details, userName }: { action: string; details: string; userName?: string }) => {
      if (!repository || !projectId) return;

      await repository.createActivity(projectId, {
        userId: currentUserId,
        userName: userName ?? currentUserName,
        action,
        details,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: activityQueryKey });
    },
  });

  const activityError = getQueryError(activityQuery.error, 'Falha ao carregar a atividade do projeto.');

  if (activityError) {
    console.warn(
      'Supabase project activity load failed:',
      activityError,
    );
  }

  return {
    activities: activityQuery.data ?? [],
    error: activityError,
    hasError: Boolean(activityError),
    addActivity: (action: string, details: string, userName?: string) =>
      addActivityMutation.mutateAsync({ action, details, userName }),
    refreshActivities: loadActivities,
  };
}
