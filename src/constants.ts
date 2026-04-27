import { Project, Task } from './types';

const daysFromNow = (days: number) => new Date(Date.now() + 86400000 * days).toISOString();
const nowIso = () => new Date().toISOString();

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'E-commerce Redesign',
    clientId: 'c1',
    description: 'Modernização completa da plataforma de vendas com foco em performance e UX/UI minimalista.',
    status: 'ongoing',
    startDate: daysFromNow(-10),
    deadline: daysFromNow(30),
    budget: 15000,
    paymentStatus: 'pending',
    progress: 35,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: '2',
    name: 'Brand Identity',
    clientId: 'c2',
    description: 'Desenvolvimento de nova identidade visual corporativa, manual de marca e assets digitais.',
    status: 'draft',
    startDate: daysFromNow(5),
    deadline: daysFromNow(45),
    budget: 8500,
    paymentStatus: 'pending',
    progress: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: '3',
    name: 'Mobile App Development',
    clientId: 'c3',
    description: 'Criação de aplicativo nativo para gestão de inventário em tempo real.',
    status: 'completed',
    startDate: daysFromNow(-30),
    deadline: daysFromNow(-1),
    budget: 22000,
    paymentStatus: 'paid',
    progress: 100,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
];

export const mockTasks: Task[] = [
  {
    id: 't1',
    projectId: '1',
    milestoneId: 'm1',
    title: 'Finalizar protótipo de alta fidelidade',
    description: 'Concluir todas as telas do checkout',
    status: 'todo',
    priority: 'high',
    responsible: 'Clerberus',
    checklist: [{ id: '1', text: 'Tela de pagamento', completed: false }],
    dueDate: daysFromNow(2),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 't2',
    projectId: '1',
    milestoneId: 'm1',
    title: 'Aprovação de paleta de cores',
    description: 'Validar com o cliente a nova paleta',
    status: 'done',
    priority: 'medium',
    responsible: 'João',
    checklist: [],
    dueDate: daysFromNow(-1),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
];
