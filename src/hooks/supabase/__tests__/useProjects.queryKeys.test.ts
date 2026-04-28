import { describe, expect, it } from 'vitest';
import { queryKeys } from '../queryKeys';

describe('project query keys', () => {
  it('keeps project data scoped by organization and project', () => {
    expect(queryKeys.projects.root('org-1')).toEqual(['projects', 'org-1']);
    expect(queryKeys.projects.milestones('org-1', 'project-1')).toEqual([
      'projects',
      'org-1',
      'milestones',
      'project-1',
    ]);
    expect(queryKeys.projects.tasks('org-1', 'project-1', 'user-1')).toEqual([
      'projects',
      'org-1',
      'tasks',
      'project-1',
      'user-1',
    ]);
    expect(queryKeys.projects.activity('org-1', 'project-1')).toEqual([
      'projects',
      'org-1',
      'activity',
      'project-1',
    ]);
  });
});
