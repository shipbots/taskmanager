import type { TaskView, TaskStatus } from '@/lib/types';
import { PRIORITY_META, STATUS_ORDER } from '@/lib/types';
import { classifyUrgency } from '@/lib/dates';

/** Order by urgency: completed sink, then by due date (earliest first), then priority. */
export function sortByUrgency(tasks: TaskView[]): TaskView[] {
  return [...tasks].sort((a, b) => {
    const ac = a.status === 'COMPLETED' ? 1 : 0;
    const bc = b.status === 'COMPLETED' ? 1 : 0;
    if (ac !== bc) return ac - bc;

    const ad = a.dueDate;
    const bd = b.dueDate;
    if (ad && bd) {
      if (ad !== bd) return ad < bd ? -1 : 1;
    } else if (ad) return -1;
    else if (bd) return 1;

    const pr = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
    if (pr !== 0) return pr;
    return a.name.localeCompare(b.name);
  });
}

export function groupByStatus(tasks: TaskView[]): Record<TaskStatus, TaskView[]> {
  const groups: Record<TaskStatus, TaskView[]> = {
    PENDING: [],
    IN_PROGRESS: [],
    BLOCKED: [],
    COMPLETED: [],
  };
  for (const t of tasks) groups[t.status].push(t);
  for (const k of STATUS_ORDER) groups[k] = sortByUrgency(groups[k]);
  return groups;
}

/** Left-border accent reflecting importance (urgency first, then priority). */
export function importanceAccent(task: TaskView): string {
  if (task.status === 'COMPLETED') return '#cbd5e1';
  const u = classifyUrgency(task.dueDate);
  if (u === 'overdue') return '#dc2626';
  if (u === 'today') return '#2563eb';
  if (task.priority === 'URGENT') return '#dc2626';
  if (task.priority === 'HIGH') return '#f97316';
  return '#e2e8f0';
}

export function openTaskCount(tasks: TaskView[]): number {
  return tasks.filter((t) => t.status !== 'COMPLETED').length;
}
