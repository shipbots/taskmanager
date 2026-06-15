import type { TaskView, TaskStatus } from '@/lib/types';
import { parseDateInput } from '@/lib/dates';

// Read-only mirror of the ShipBots Onboarding Dashboard. Each onboarding subitem
// (action item) is surfaced as a task labeled with its parent client.

interface OnboardingSubItem {
  id: string;
  name: string;
  status: string;
  assignee?: string;
  assigneeEmails?: string[];
  dueDate?: string;
  parentItemId?: string;
  parentItemName?: string;
}

interface ProjectRef {
  id: string;
  slug: string;
  name: string;
  color: string;
}

function mapStatus(s: string): TaskStatus {
  const v = (s || '').toLowerCase();
  if (/(done|complete|finished|delivered)/.test(v)) return 'COMPLETED';
  if (/(progress|working|doing|wip|active)/.test(v)) return 'IN_PROGRESS';
  if (/(stuck|block|hold|wait|pending review)/.test(v)) return 'BLOCKED';
  return 'PENDING';
}

export async function fetchShipbotsTasks(project: ProjectRef): Promise<TaskView[]> {
  const base = process.env.ONBOARDING_API_BASE?.replace(/\/$/, '');
  if (!base) return [];
  try {
    const res = await fetch(`${base}/api/subitems`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const items = (await res.json()) as OnboardingSubItem[];
    if (!Array.isArray(items)) return [];

    return items.map((it): TaskView => {
      const due = it.dueDate ? parseDateInput(it.dueDate).toISOString() : null;
      const status = mapStatus(it.status);
      return {
        id: `shipbots:${it.id}`,
        projectId: project.id,
        projectSlug: project.slug,
        projectName: project.name,
        projectColor: project.color,
        name: it.name,
        description: it.status ? `Onboarding status: ${it.status}` : null,
        client: it.parentItemName ?? null,
        status,
        priority: 'MEDIUM',
        dueDate: due,
        manualDueDate: due,
        completedAt: status === 'COMPLETED' ? due : null,
        sortOrder: 0,
        templateId: null,
        createdAt: '',
        updatedAt: '',
        subtasks: [],
        attachments: [],
        activities: [],
        subtaskCount: 0,
        doneSubtaskCount: 0,
        source: 'shipbots',
        readOnly: true,
        externalUrl: base,
      };
    });
  } catch (e) {
    console.warn('ShipBots mirror fetch failed:', e);
    return [];
  }
}
