import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityLog, Milestone, Project, ProjectTemplate, Task } from '../../types';
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
  approval_status: Milestone['approvalStatus'] | null;
  approval_url: string | null;
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
  responsible_id: string | null;
  checklist: Task['checklist'] | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type ChecklistItemRecord = {
  id: string;
  task_id: string;
  text: string;
  completed: boolean;
  sort_order: number;
};

type TimeEntryRecord = {
  id: string;
  project_id: string;
  task_id: string | null;
  user_id: string | null;
  started_at: string;
  stopped_at: string | null;
  duration_minutes: number | null;
  billable: boolean | null;
  hourly_rate: number | null;
  billed_amount: number | null;
  note: string | null;
  created_at: string;
};

type ProjectTemplateRecord = {
  id: string;
  name: string;
  description: string | null;
  estimated_days: number | null;
  default_budget: number | null;
  created_at: string;
};

type ProjectTemplateMilestoneRecord = {
  id: string;
  title: string;
  sort_order: number;
};

type ProjectTemplateTaskRecord = {
  id: string;
  template_milestone_id: string;
  title: string;
  description: string | null;
  priority: Task['priority'];
  sort_order: number;
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
    startDate: toIsoString(record.start_date),
    deadline: toIsoString(record.deadline),
    budget: Number(record.budget ?? 0),
    paymentStatus: record.payment_status,
    progress: record.progress ?? 0,
    financialBalance: record.financial_balance ?? undefined,
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
  };
}

function mapMilestoneRecord(record: MilestoneRecord): Milestone {
  return {
    id: record.id,
    projectId: record.project_id,
    title: record.title,
    order: record.sort_order,
    status: record.status,
    approvalStatus: record.approval_status ?? 'not_requested',
    approvalUrl: record.approval_url ?? undefined,
    createdAt: toIsoString(record.created_at),
  };
}

function mapTaskRecord(
  record: TaskRecord,
  checklistItems: ChecklistItemRecord[] = [],
  timeEntries: TimeEntryRecord[] = [],
  currentUserId?: string,
): Task {
  const taskChecklistItems = checklistItems.filter((item) => item.task_id === record.id);
  const taskTimeEntries = timeEntries.filter((entry) => entry.task_id === record.id);
  const timeSpentMinutes = taskTimeEntries.reduce((total, entry) => {
    if (entry.duration_minutes !== null) {
      return total + entry.duration_minutes;
    }

    if (!entry.stopped_at) {
      return total + Math.max(0, Math.ceil((Date.now() - new Date(entry.started_at).getTime()) / 60000));
    }

    return total;
  }, 0);
  const billableMinutes = taskTimeEntries.reduce((total, entry) => {
    if (entry.billable === false) return total;
    return total + (entry.duration_minutes ?? 0);
  }, 0);
  const billedAmount = taskTimeEntries.reduce((total, entry) => total + Number(entry.billed_amount ?? 0), 0);
  const activeTimeEntry = currentUserId
    ? taskTimeEntries.find((entry) => entry.user_id === currentUserId && !entry.stopped_at)
    : undefined;

  return {
    id: record.id,
    projectId: record.project_id,
    milestoneId: record.milestone_id,
    title: record.title,
    description: record.description ?? undefined,
    status: record.status,
    priority: record.priority,
    responsible: record.responsible,
    responsibleId: record.responsible_id ?? undefined,
    checklist: taskChecklistItems.length > 0
      ? taskChecklistItems
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => ({ id: item.id, text: item.text, completed: item.completed }))
      : Array.isArray(record.checklist) ? record.checklist : [],
    timeSpentMinutes,
    billableMinutes,
    billedAmount,
    activeTimeEntryId: activeTimeEntry?.id,
    dueDate: record.due_date ? toIsoString(record.due_date) : undefined,
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
  };
}

function mapProjectTemplateRecord(record: ProjectTemplateRecord): ProjectTemplate {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    estimatedDays: record.estimated_days ?? 30,
    defaultBudget: record.default_budget ? Number(record.default_budget) : undefined,
    createdAt: toIsoString(record.created_at),
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
    timestamp: toIsoString(record.timestamp),
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

  async createProjectFromTemplate(
    project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>,
    templateId?: string,
    currentUserId?: string,
  ) {
    const projectId = await this.createProject(project);

    if (!projectId || !templateId) {
      return projectId;
    }

    const [templateMilestones, templateTasks] = await Promise.all([
      this.unwrap(
        this.supabase
          .from('project_template_milestones')
          .select('id, title, sort_order')
          .eq('template_id', templateId)
          .order('sort_order', { ascending: true }),
        'Nao foi possivel carregar as etapas do template.',
      ),
      this.unwrap(
        this.supabase
          .from('project_template_tasks')
          .select('id, template_milestone_id, title, description, priority, sort_order, project_template_milestones!inner(template_id)')
          .eq('project_template_milestones.template_id', templateId)
          .order('sort_order', { ascending: true }),
        'Nao foi possivel carregar as tarefas do template.',
      ),
    ]);

    const milestoneRows = templateMilestones as ProjectTemplateMilestoneRecord[];
    const taskRows = templateTasks as ProjectTemplateTaskRecord[];
    const createdMilestones = await this.unwrap(
      this.supabase
        .from('milestones')
        .insert(milestoneRows.map((milestone) => ({
          organization_id: this.organizationId,
          project_id: projectId,
          title: milestone.title,
          sort_order: milestone.sort_order,
          status: 'pending',
        })))
        .select('id, title, sort_order'),
      'Nao foi possivel criar as etapas do template.',
    );
    const createdByOrder = new Map((createdMilestones as Array<{ id: string; sort_order: number }>).map((row) => [row.sort_order, row.id]));

    const taskPayload = taskRows
      .map((task) => {
        const sourceMilestone = milestoneRows.find((milestone) => milestone.id === task.template_milestone_id);
        const milestoneId = sourceMilestone ? createdByOrder.get(sourceMilestone.sort_order) : undefined;

        if (!milestoneId) return null;

        return {
          organization_id: this.organizationId,
          project_id: projectId,
          milestone_id: milestoneId,
          title: task.title,
          description: task.description,
          status: 'todo',
          priority: task.priority,
          responsible: 'Operador',
          responsible_id: currentUserId ?? null,
          checklist: [],
        };
      })
      .filter(Boolean);

    if (taskPayload.length > 0) {
      await this.unwrap(
        this.supabase.from('tasks').insert(taskPayload).select('id'),
        'Nao foi possivel criar as tarefas do template.',
      );
    }

    await this.createActivity(projectId, {
      userId: currentUserId ?? 'system',
      userName: 'Operador',
      action: 'Template Aplicado',
      details: `Projeto criado a partir de template com ${milestoneRows.length} etapas e ${taskPayload.length} tarefas.`,
    });

    return projectId;
  }

  async listProjectTemplates() {
    const rows = await this.unwrap(
      this.supabase
        .from('project_templates')
        .select('id, name, description, estimated_days, default_budget, created_at')
        .order('created_at', { ascending: true }),
      'Nao foi possivel carregar os templates de projeto.',
    );

    return (rows as ProjectTemplateRecord[]).map(mapProjectTemplateRecord);
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

  async softDeleteProject(id: string) {
    await this.unwrap(
      this.supabase
        .from('projects')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('organization_id', this.organizationId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel excluir o projeto.',
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
    const rows = await this.unwrap(
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

    return (rows as Array<{ id: string }>)[0]?.id;
  }

  async updateMilestone(projectId: string, id: string, data: Partial<Milestone>) {
    const payload: Record<string, unknown> = {};

    if (data.title !== undefined) payload.title = data.title;
    if (data.order !== undefined) payload.sort_order = data.order;
    if (data.status !== undefined) payload.status = data.status;
    if (data.approvalStatus !== undefined) payload.approval_status = data.approvalStatus;
    if (data.approvalUrl !== undefined) payload.approval_url = data.approvalUrl;

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

  async requestMilestoneApproval(projectId: string, id: string, approvalUrl: string) {
    const token = crypto.randomUUID();

    await this.unwrap(
      this.supabase
        .from('milestones')
        .update({
          approval_status: 'requested',
          approval_token: token,
          approval_url: approvalUrl,
          approval_requested_at: new Date().toISOString(),
        })
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel solicitar aprovacao da etapa.',
    );

    return token;
  }

  async listTasks(projectId: string, currentUserId?: string) {
    const [taskRows, checklistRows] = await Promise.all([
      this.unwrap(
        this.supabase
          .from('tasks')
          .select('*')
          .eq('organization_id', this.organizationId)
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),
        'Nao foi possivel carregar as tarefas do projeto.',
      ),
      this.unwrap(
        this.supabase
          .from('task_checklist_items')
          .select('id, task_id, text, completed, sort_order')
          .eq('organization_id', this.organizationId)
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true }),
        'Nao foi possivel carregar o checklist das tarefas.',
      ),
    ]);
    let timeRows: unknown[] = [];

    try {
      timeRows = await this.unwrap(
        this.supabase
          .from('project_time_entries')
          .select('id, project_id, task_id, user_id, started_at, stopped_at, duration_minutes, billable, hourly_rate, billed_amount, note, created_at')
          .eq('organization_id', this.organizationId)
          .eq('project_id', projectId),
        'Nao foi possivel carregar o apontamento de horas.',
      ) as unknown[];
    } catch (error) {
      timeRows = await this.unwrap(
        this.supabase
          .from('project_time_entries')
          .select('id, project_id, task_id, user_id, started_at, stopped_at, duration_minutes, note, created_at')
          .eq('organization_id', this.organizationId)
          .eq('project_id', projectId),
        'Nao foi possivel carregar o apontamento de horas.',
      ) as unknown[];
    }

    return (taskRows as TaskRecord[]).map((task) =>
      mapTaskRecord(task, checklistRows as ChecklistItemRecord[], timeRows as TimeEntryRecord[], currentUserId),
    );
  }

  async createTask(projectId: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    const rows = await this.unwrap(
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
          responsible_id: task.responsibleId ?? null,
          checklist: task.checklist,
          due_date: task.dueDate ? toIsoString(task.dueDate) : null,
        })
        .select('id')
        .limit(1),
      'Nao foi possivel criar a tarefa do projeto.',
    );

    const taskId = (rows as Array<{ id: string }>)[0]?.id;

    if (taskId && task.checklist.length > 0) {
      await this.replaceChecklistItems(projectId, taskId, task.checklist);
    }

    return taskId;
  }

  async updateTask(projectId: string, id: string, data: Partial<Task>) {
    const payload: Record<string, unknown> = {};

    if (data.milestoneId !== undefined) payload.milestone_id = data.milestoneId;
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.description = data.description ?? null;
    if (data.status !== undefined) payload.status = data.status;
    if (data.priority !== undefined) payload.priority = data.priority;
    if (data.responsible !== undefined) payload.responsible = data.responsible;
    if (data.responsibleId !== undefined) payload.responsible_id = data.responsibleId ?? null;
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

    if (data.checklist !== undefined) {
      await this.replaceChecklistItems(projectId, id, data.checklist);
    }
  }

  async deleteTask(projectId: string, id: string) {
    await this.unwrap(
      this.supabase
        .from('tasks')
        .delete()
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel excluir a tarefa do projeto.',
    );
  }

  async replaceChecklistItems(projectId: string, taskId: string, checklist: Task['checklist']) {
    await this.unwrap(
      this.supabase
        .from('task_checklist_items')
        .delete()
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .eq('task_id', taskId)
        .select('id'),
      'Nao foi possivel substituir o checklist da tarefa.',
    );

    if (checklist.length === 0) return;

    await this.unwrap(
      this.supabase
        .from('task_checklist_items')
        .insert(checklist.map((item, index) => ({
          id: item.id,
          organization_id: this.organizationId,
          project_id: projectId,
          task_id: taskId,
          text: item.text,
          completed: item.completed,
          sort_order: index,
        })))
        .select('id'),
      'Nao foi possivel gravar os itens de checklist.',
    );
  }

  async addChecklistItem(projectId: string, taskId: string, text: string, createdBy: string) {
    await this.unwrap(
      this.supabase
        .from('task_checklist_items')
        .insert({
          organization_id: this.organizationId,
          project_id: projectId,
          task_id: taskId,
          text,
          created_by: createdBy,
        })
        .select('id'),
      'Nao foi possivel criar o item de checklist.',
    );
  }

  async updateChecklistItem(projectId: string, taskId: string, itemId: string, completed: boolean) {
    await this.unwrap(
      this.supabase
        .from('task_checklist_items')
        .update({ completed })
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .eq('task_id', taskId)
        .eq('id', itemId)
        .select('id'),
      'Nao foi possivel atualizar o item de checklist.',
    );
  }

  async startTimeEntry(projectId: string, taskId: string, userId: string) {
    await this.unwrap(
      this.supabase
        .from('project_time_entries')
        .insert({
          organization_id: this.organizationId,
          project_id: projectId,
          task_id: taskId,
          user_id: userId,
        })
        .select('id'),
      'Nao foi possivel iniciar o apontamento de tempo.',
    );
  }

  async stopTimeEntry(projectId: string, entryId: string, hourlyRate?: number) {
    await this.unwrap(
      this.supabase
        .from('project_time_entries')
        .update({
          stopped_at: new Date().toISOString(),
          billable: true,
          hourly_rate: hourlyRate ?? null,
        })
        .eq('organization_id', this.organizationId)
        .eq('project_id', projectId)
        .eq('id', entryId)
        .is('stopped_at', null)
        .select('id'),
      'Nao foi possivel encerrar o apontamento de tempo.',
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
