import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActivityLog, Milestone, Project, Task } from '../../types';
import { createProjectRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

export function useSupabaseProjects() {
  const { supabase, organizationId } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(Boolean(organizationId));

  const loadProjects = useCallback(async () => {
    if (!repository) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setProjects(await repository.listProjects());
    } catch (error) {
      console.warn('Supabase projects load failed:', toDataLayerError(error, 'Falha ao carregar projetos.'));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const addProject = useCallback(
    async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>) => {
      if (!repository) return undefined;
      const projectId = await repository.createProject(project);
      await loadProjects();
      return projectId;
    },
    [loadProjects, repository],
  );

  const updateProject = useCallback(
    async (id: string, data: Partial<Project>) => {
      if (!repository) return;
      await repository.updateProject(id, data);
      await loadProjects();
    },
    [loadProjects, repository],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (!repository) return;
      await repository.softDeleteProject(id);
      await loadProjects();
    },
    [loadProjects, repository],
  );

  return { projects, loading, addProject, updateProject, deleteProject, refreshProjects: loadProjects };
}

export function useSupabaseMilestones(projectId: string | null) {
  const { supabase, organizationId } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(Boolean(projectId && organizationId));

  const loadMilestones = useCallback(async () => {
    if (!repository || !projectId) {
      setMilestones([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setMilestones(await repository.listMilestones(projectId));
    } catch (error) {
      console.warn(
        'Supabase milestones load failed:',
        toDataLayerError(error, 'Falha ao carregar etapas do projeto.'),
      );
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, repository]);

  useEffect(() => {
    void loadMilestones();
  }, [loadMilestones]);

  const addMilestone = useCallback(
    async (milestone: Omit<Milestone, 'id' | 'createdAt'>) => {
      if (!repository || !projectId) return;
      await repository.createMilestone(projectId, milestone);
      await loadMilestones();
    },
    [loadMilestones, projectId, repository],
  );

  const updateMilestone = useCallback(
    async (id: string, data: Partial<Milestone>) => {
      if (!repository || !projectId) return;
      await repository.updateMilestone(projectId, id, data);
      await loadMilestones();
    },
    [loadMilestones, projectId, repository],
  );

  return { milestones, loading, addMilestone, updateMilestone, refreshMilestones: loadMilestones };
}

export function useSupabaseTasks(projectId: string | null) {
  const { supabase, organizationId } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(Boolean(projectId && organizationId));

  const loadTasks = useCallback(async () => {
    if (!repository || !projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setTasks(await repository.listTasks(projectId));
    } catch (error) {
      console.warn('Supabase tasks load failed:', toDataLayerError(error, 'Falha ao carregar tarefas.'));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, repository]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const addTask = useCallback(
    async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!repository || !projectId) return;
      await repository.createTask(projectId, task);
      await loadTasks();
    },
    [loadTasks, projectId, repository],
  );

  const updateTask = useCallback(
    async (id: string, data: Partial<Task>) => {
      if (!repository || !projectId) return;
      await repository.updateTask(projectId, id, data);
      await loadTasks();
    },
    [loadTasks, projectId, repository],
  );

  return { tasks, loading, addTask, updateTask, refreshTasks: loadTasks };
}

export function useSupabaseProjectActivity(projectId: string | null) {
  const { supabase, organizationId, currentUserId, currentUserName } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProjectRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const loadActivities = useCallback(async () => {
    if (!repository || !projectId) {
      setActivities([]);
      return;
    }

    try {
      setActivities(await repository.listActivity(projectId));
    } catch (error) {
      console.warn(
        'Supabase project activity load failed:',
        toDataLayerError(error, 'Falha ao carregar a atividade do projeto.'),
      );
      setActivities([]);
    }
  }, [projectId, repository]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const addActivity = useCallback(
    async (action: string, details: string, userName?: string) => {
      if (!repository || !projectId) return;

      await repository.createActivity(projectId, {
        userId: currentUserId,
        userName: userName ?? currentUserName,
        action,
        details,
      });
      await loadActivities();
    },
    [currentUserId, currentUserName, loadActivities, projectId, repository],
  );

  return { activities, addActivity, refreshActivities: loadActivities };
}
