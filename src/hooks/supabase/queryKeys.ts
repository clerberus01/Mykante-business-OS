export const queryKeys = {
  crm: {
    root: (organizationId: string | null) => ['crm', organizationId] as const,
    clients: (organizationId: string | null) => ['crm', organizationId, 'clients'] as const,
    clientEvents: (organizationId: string | null, clientId: string | null) =>
      ['crm', organizationId, 'clients', clientId, 'events'] as const,
    pipelineStages: (organizationId: string | null) => ['crm', organizationId, 'pipeline-stages'] as const,
    deals: (organizationId: string | null) => ['crm', organizationId, 'deals'] as const,
    proposals: (organizationId: string | null) => ['crm', organizationId, 'proposals'] as const,
    transactions: (organizationId: string | null) => ['crm', organizationId, 'transactions'] as const,
  },
  projects: {
    root: (organizationId: string | null) => ['projects', organizationId] as const,
    templates: (organizationId: string | null) => ['projects', organizationId, 'templates'] as const,
    milestones: (organizationId: string | null, projectId: string | null) =>
      ['projects', organizationId, 'milestones', projectId] as const,
    tasks: (organizationId: string | null, projectId: string | null, userId: string) =>
      ['projects', organizationId, 'tasks', projectId, userId] as const,
    team: (organizationId: string | null, projectId: string | null) =>
      ['projects', organizationId, 'team', projectId] as const,
    activity: (organizationId: string | null, projectId: string | null) =>
      ['projects', organizationId, 'activity', projectId] as const,
  },
  finance: {
    categories: (organizationId: string | null) => ['finance', organizationId, 'categories'] as const,
    costCenters: (organizationId: string | null) => ['finance', organizationId, 'cost-centers'] as const,
    bankLines: (organizationId: string | null) => ['finance', organizationId, 'bank-lines'] as const,
  },
  documents: {
    root: (organizationId: string | null) => ['documents', organizationId] as const,
  },
  dashboard: {
    root: (organizationId: string | null) => ['dashboard', organizationId] as const,
  },
  whatsapp: {
    conversations: (organizationId: string | null) => ['whatsapp', organizationId, 'conversations'] as const,
    templates: (organizationId: string | null) => ['whatsapp', organizationId, 'templates'] as const,
    messages: (organizationId: string | null, conversationId: string) =>
      ['whatsapp', organizationId, 'messages', conversationId] as const,
  },
  notifications: {
    root: (organizationId: string | null, userId: string) => ['notifications', organizationId, userId] as const,
  },
  privacy: {
    root: (organizationId: string | null, userId: string) => ['privacy', organizationId, userId] as const,
  },
  calendar: {
    root: (organizationId: string | null) => ['calendar', organizationId] as const,
    mfa: (userId: string) => ['settings', userId, 'mfa'] as const,
    apiHealth: (organizationId: string | null) => ['settings', organizationId, 'api-health'] as const,
  },
  automations: {
    rules: (organizationId: string | null) => ['automations', organizationId, 'rules'] as const,
    runs: (organizationId: string | null) => ['automations', organizationId, 'runs'] as const,
  },
};
