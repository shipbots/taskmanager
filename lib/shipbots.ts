import type { TaskView, ProjectView, StatusView } from '@/lib/types';
import { parseDateInput } from '@/lib/dates';
import { orderStatuses } from '@/lib/sort';

// Read-only mirror of the ShipBots Onboarding Dashboard. Each onboarding subitem
// (action item) is surfaced as a task labeled with its parent client, mapped
// onto the ShipBots project's own status columns.

interface OnboardingSubItem {
  id: string;
  name: string;
  status: string;
  assignee?: string;
  assigneeEmails?: string[];
  dueDate?: string;
  parentItemName?: string;
}

// "My" emails — onboarding tasks assigned to anyone outside this set (and not
// unassigned) are hidden. Falls back to ALLOWED_EMAILS.
function myAssigneeEmails(): Set<string> {
  const raw = process.env.SHIPBOTS_MY_EMAILS || process.env.ALLOWED_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function pickStatus(mondayStatus: string, statuses: StatusView[]): StatusView | undefined {
  const v = (mondayStatus || '').toLowerCase();
  const has = (kw: string) => statuses.find((s) => s.name.toLowerCase().includes(kw));
  if (/(done|complete|finished|delivered)/.test(v)) return statuses.find((s) => s.isDone) ?? has('done');
  if (/(progress|working|doing|wip|active)/.test(v)) return has('progress');
  if (/(stuck|block|hold|wait)/.test(v)) return has('block');
  return undefined;
}

export async function fetchShipbotsTasks(
  project: ProjectView,
  statuses: StatusView[],
): Promise<TaskView[]> {
  const base = process.env.ONBOARDING_API_BASE?.replace(/\/$/, '');
  if (!base) return [];
  const ordered = orderStatuses(statuses);
  const firstStatus = ordered[0];

  try {
    const res = await fetch(`${base}/api/subitems`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const items = (await res.json()) as OnboardingSubItem[];
    if (!Array.isArray(items)) return [];

    // Show unassigned tasks and tasks assigned to me; hide ones assigned to others.
    const mine = myAssigneeEmails();
    const visible = items.filter((it) => {
      const emails = (it.assigneeEmails ?? []).map((e) => e.toLowerCase());
      return emails.length === 0 || emails.some((e) => mine.has(e));
    });

    return visible.map((it): TaskView => {
      const due = it.dueDate ? parseDateInput(it.dueDate).toISOString() : null;
      const st = pickStatus(it.status, ordered) ?? firstStatus;
      return {
        id: `shipbots:${it.id}`,
        projectId: project.id,
        projectSlug: project.slug,
        projectName: project.name,
        projectColor: project.color,
        name: it.name,
        description: it.status ? `Onboarding status: ${it.status}` : null,
        client: it.parentItemName ?? null,
        status: st?.name ?? 'Pending',
        statusColor: st?.color ?? '#94a3b8',
        isDone: st?.isDone ?? false,
        priority: 'MEDIUM',
        dueDate: due,
        manualDueDate: due,
        completedAt: st?.isDone ? due : null,
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
