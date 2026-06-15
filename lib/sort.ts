import type { TaskView, StatusView } from '@/lib/types';
import { PRIORITY_META } from '@/lib/types';
import { classifyUrgency } from '@/lib/dates';

/** Order by urgency: done tasks sink, then by due date (earliest first), then priority. */
export function sortByUrgency(tasks: TaskView[]): TaskView[] {
  return [...tasks].sort((a, b) => {
    const ac = a.isDone ? 1 : 0;
    const bc = b.isDone ? 1 : 0;
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

export function orderStatuses(statuses: StatusView[]): StatusView[] {
  return [...statuses].sort(
    (a, b) =>
      Number(a.isDone) - Number(b.isDone) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  );
}

export interface StatusColumn {
  status: StatusView;
  tasks: TaskView[];
}

/**
 * Group tasks into the project's columns (ordered, Done last). Tasks whose
 * status name doesn't match any column fall into the first column.
 */
export function groupByStatus(tasks: TaskView[], statuses: StatusView[]): StatusColumn[] {
  const ordered = orderStatuses(statuses);
  const map = new Map<string, TaskView[]>();
  for (const s of ordered) map.set(s.name, []);
  const fallback = ordered[0]?.name ?? '';
  for (const t of tasks) {
    (map.get(t.status) ?? map.get(fallback))?.push(t);
  }
  return ordered.map((s) => ({ status: s, tasks: sortByUrgency(map.get(s.name) ?? []) }));
}

/** Left-border accent reflecting importance (urgency first, then priority). */
export function importanceAccent(task: TaskView): string {
  if (task.isDone) return '#cbd5e1';
  const u = classifyUrgency(task.dueDate);
  if (u === 'overdue') return '#dc2626';
  if (u === 'today') return '#2563eb';
  if (task.priority === 'URGENT') return '#dc2626';
  if (task.priority === 'HIGH') return '#f97316';
  return '#e2e8f0';
}

export function openTaskCount(tasks: TaskView[]): number {
  return tasks.filter((t) => !t.isDone).length;
}
