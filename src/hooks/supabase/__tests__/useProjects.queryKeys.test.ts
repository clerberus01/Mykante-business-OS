import { describe, expect, it } from 'vitest';

const buildProjectQueryKeys = (organizationId: string | null, projectId?: string | null, userId?: string) => ({
  projects: ['projects', organizationId],
  milestones: ['projects', organizationId, 'milestones', projectId],
  tasks: ['projects', organizationId, 'tasks', projectId, userId],
  activity: ['projects', organizationId, 'activity', projectId],
});

describe('project query keys', () => {
  it('keeps project data scoped by organization and project', () => {
    expect(buildProjectQueryKeys('org-1', 'project-1', 'user-1')).toEqual({
      projects: ['projects', 'org-1'],
      milestones: ['projects', 'org-1', 'milestones', 'project-1'],
      tasks: ['projects', 'org-1', 'tasks', 'project-1', 'user-1'],
      activity: ['projects', 'org-1', 'activity', 'project-1'],
    });
  });
});
