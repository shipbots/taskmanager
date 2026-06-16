import type { TaskView, ProjectView, StatusView } from '@/lib/types';
import { parseDateInput } from '@/lib/dates';
import { fetchAllSubitems, hasMondayKey } from '@/lib/monday';

// Reads ShipBots onboarding subitems straight from Monday.com (via lib/monday).
// Tasks are editable; writes go back to Monday through /api/shipbots/tasks/[id].

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

export async function fetchShipbotsTasks(
  project: ProjectView,
  statuses: StatusView[],
): Promise<TaskView[]> {
  if (!hasMondayKey()) return [];
  const byName = new Map(statuses.map((s) => [s.name, s]));
  const externalUrl = process.env.ONBOARDING_API_BASE?.replace(/\/$/, '') || null;

  try {
    const subs = await fetchAllSubitems();
    const mine = myAssigneeEmails();
    // Show unassigned tasks and tasks assigned to me; hide ones assigned to others.
    const visible = subs.filter((s) => {
      const emails = s.assigneeEmails.map((e) => e.toLowerCase());
      return emails.length === 0 || emails.some((e) => mine.has(e));
    });

    return visible.map((s): TaskView => {
      const due = s.dueDate ? parseDateInput(s.dueDate).toISOString() : null;
      const statusName = s.status || (statuses[0]?.name ?? 'Pending');
      const st = byName.get(statusName);
      const isDone = st?.isDone ?? /done|complete|finished|delivered/i.test(statusName);
      return {
        id: `shipbots:${s.id}`,
        externalId: s.id,
        projectId: project.id,
        projectSlug: project.slug,
        projectName: project.name,
        projectColor: project.color,
        name: s.name,
        description: s.assignee ? `Assigned in Monday: ${s.assignee}` : null,
        client: s.parentItemName ?? null,
        status: statusName,
        statusColor: st?.color ?? '#94a3b8',
        isDone,
        priority: 'MEDIUM',
        dueDate: due,
        manualDueDate: due,
        completedAt: isDone ? due : null,
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
        readOnly: false,
        externalUrl,
      };
    });
  } catch (e) {
    console.warn('ShipBots Monday fetch failed:', e);
    return [];
  }
}
