import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityLog, Milestone, Project, Task } from '../../types';
import { SupabaseRepository } from '../shared/supabaseRepository';
import { toIsoString, toUnixTimestamp } from '../shared/mappers';

type ProjectRecord = {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: Project['status'];
  start_date: string;
  deadline: string;
  budget: number | null;
  payment_status: Project['paymentStatus'];
  progress: number | null;
  financial_balance: number | null;
  created_at: string;
  updated_at: string;
};

type MilestoneRecord = {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  sort_order: number;
  status: Milestone['status'];
  created_at: string;
};

type TaskRecord = {
  id: string;
  organization_id: string;
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

type ActivityRecord = {
  id: string;
  organization_id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  action: string;
  details: string;
  timestamp: string;
};

function mapProjectRecord(record: ProjectRecord): Project {
  return {
    id: record.id,
    name: record.name,
    clientId: record.client_id,
    description: record.description ?? '',
    status: record.status,
    startDate: toUnixTimestamp(record.start_date),
    deadline: toUnixTimestamp(record.deadline),
    budget: Number(record.budget ?? 0),
    paymentStatus: record.payment_status,
    progress: record.progress ?? 0,
    financialBalance: record.financial_balance ?? undefined,
    createdAt: toUnixTimestamp(record.created_at),
    updatedAt: toUnixTimestamp(record.updated_at),
  };
}

function mapMilestoneRecord(record: MilestoneRecord): Milestone {
  return {
    id: record.id,
    projectId: record.project_id,
    title: record.title,
    order: record.sort_order,
    status: record.status,
    createdAt: toUnixTimestamp(record.created_at),
  };
}

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
    dueDate: record.due_date ? toUnixTimestamp(record.due_date) : undefined,
    createdAt: toUnixTimestamp(record.created_at),
    updatedAt: toUnixTimestamp(record.updated_at),
  };
}

function mapActivityRecord(record: ActivityRecord): ActivityLog {
  return {
    id: record.id,
    projectId: record.project_id,
    userId: record.user_id,
    userName: record.user_name,
    action: record.action,
    details: record.details,
    timestamp: toUnixTimestamp(record.timestamp),
  };
}

export class SupabaseProjectRepository extends SupabaseRepository {
  constructor(supabase: SupabaseClient, organizationId: string) {
    super(supabase, organizationId);
  }

  async listProjects() {
    const rows = await this.unwrap(
      this.supabase
        .from('projects')
        .select('*')
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      'Nao foi possivel carregar os projetos.',
    );

    return (rows as ProjectRecord[]).map(mapProjectRecord);
  }

  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>) {
    const rows = await this.unwrap(
      this.supabase
        .from('projects')
        .insert({
          organization_id: this.organizationId,
          client_id: project.clientId,
          name: project.name,
          description: project.description,
          status: project.status,
          start_date: toIsoString(project.startDate),
          deadline: toIsoString(project.deadline),
          budget: project.budget,
          payment_status: project.paymentStatus,
          progress: 0,
        })
        .select('id')
        .limit(1),
      'Nao foi possivel criar o projeto.',
    );

    return (rows as Array<{ id: string }>)[0]?.id;
  }

  async updateProject(id: string, data: Partial<Project>) {
    const payload: Record<string, unknown> = {};

    if (data.clientId !== undefined) payload.client_id = data.clientId;
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.status !== undefined) payload.status = data.status;
    if (data.startDate !== undefined) payload.start_date = toIsoString(data.startDate);
    if (data.deadline !== undefined) payload.deadline = toIsoString(data.deadline);
    if (data.budget !== undefined) payload.budget = data.budget;
    if (data.paymentStatus !== undefined) payload.payment_status = data.paymentStatus;
    if (data.progress !== undefined) payload.progress = data.progress;
    if (data.financialBalance !== undefined) payload.financial_balance = data.financialBalance;

    await this.unwrap(
      this.supabase
        .from('projects')
        .update(payload)
        .eq('organization_id', this.organizationId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel atualizar o projeto.',
    );
  }

  async listMilestones(projectId: string) {
    const rows = await this.unwrap(
      this.supabase
        .from('milestones')
        .select('*')
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true }),
      'Nao foi possivel carregar as etapas do projeto.',
    );

    return (rows as MilestoneRecord[]).map(mapMilestoneRecord);
  }

  async createMilestone(projectId: string, milestone: Omit<Milestone, 'id' | 'createdAt'>) {
    await this.unwrap(
      this.supabase
        .from('milestones')
        .insert({
          organization_id: this.organizationId,
          project_id: projectId,
          title: milestone.title,
          sort_order: milestone.order,
          status: milestone.status,
        })
        .select('id'),
      'Nao foi possivel criar a etapa do projeto.',
    );
  }

  async updateMilestone(projectId: string, id: string, data: Partial<Milestone>) {
    const payload: Record<string, unknown> = {};

    if (data.title !== undefined) payload.title = data.title;
    if (data.order !== undefined) payload.sort_order = data.order;
    if (data.status !== undefined) payload.status = data.status;

    await this.unwrap(
      this.supabase
        .from('milestones')
        .update(payload)
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel atualizar a etapa do projeto.',
    );
  }

  async listTasks(projectId: string) {
    const rows = await this.unwrap(
      this.supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      'Nao foi possivel carregar as tarefas do projeto.',
    );

    return (rows as TaskRecord[]).map(mapTaskRecord);
  }

  async createTask(projectId: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    await this.unwrap(
      this.supabase
        .from('tasks')
        .insert({
          organization_id: this.organizationId,
          project_id: projectId,
          milestone_id: task.milestoneId,
          title: task.title,
          description: task.description ?? null,
          status: task.status,
          priority: task.priority,
          responsible: task.responsible,
          checklist: task.checklist,
          due_date: task.dueDate ? toIsoString(task.dueDate) : null,
        })
        .select('id'),
      'Nao foi possivel criar a tarefa do projeto.',
    );
  }

  async updateTask(projectId: string, id: string, data: Partial<Task>) {
    const payload: Record<string, unknown> = {};

    if (data.milestoneId !== undefined) payload.milestone_id = data.milestoneId;
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.description = data.description ?? null;
    if (data.status !== undefined) payload.status = data.status;
    if (data.priority !== undefined) payload.priority = data.priority;
    if (data.responsible !== undefined) payload.responsible = data.responsible;
    if (data.checklist !== undefined) payload.checklist = data.checklist;
    if (data.dueDate !== undefined) payload.due_date = data.dueDate ? toIsoString(data.dueDate) : null;

    await this.unwrap(
      this.supabase
        .from('tasks')
        .update(payload)
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel atualizar a tarefa do projeto.',
    );
  }

  async listActivity(projectId: string) {
    const rows = await this.unwrap(
      this.supabase
        .from('project_activity')
        .select('*')
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(50),
      'Nao foi possivel carregar a atividade do projeto.',
    );

    return (rows as ActivityRecord[]).map(mapActivityRecord);
  }

  async createActivity(projectId: string, activity: Omit<ActivityLog, 'id' | 'projectId' | 'timestamp'>) {
    await this.unwrap(
      this.supabase
        .from('project_activity')
        .insert({
          organization_id: this.organizationId,
          project_id: projectId,
          user_id: activity.userId,
          user_name: activity.userName,
          action: activity.action,
          details: activity.details,
        })
        .select('id'),
      'Nao foi possivel registrar a atividade do projeto.',
    );
  }
}

export function createProjectRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseProjectRepository(supabase, organizationId);
}
