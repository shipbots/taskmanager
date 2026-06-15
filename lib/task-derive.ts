// Pure derivation logic shared by API routes. Kept free of Prisma queries so it
// is easy to reason about and test.

export interface StatusLite {
  name: string;
  isDone: boolean;
  sortOrder: number;
}

export interface DeriveSubtask {
  done: boolean;
  dueDate: Date | null;
  sortOrder: number;
}

/**
 * Effective due date = the NEXT unfinished subtask's due date (the nearest thing
 * actually due). Falls back to the task's manual due date when there are no
 * unfinished subtasks with dates.
 */
export function effectiveDueDate(
  subtasks: DeriveSubtask[],
  manualDueDate: Date | null,
): Date | null {
  const pending = subtasks
    .filter((s) => !s.done && s.dueDate)
    .map((s) => s.dueDate as Date);
  if (pending.length) {
    return pending.reduce((min, d) => (d < min ? d : min));
  }
  return manualDueDate ?? null;
}

/**
 * Auto-advance status from subtask completion against a project's columns:
 *  - no subtasks         → keep whatever the user set (fully manual)
 *  - all subtasks done   → the Done column
 *  - reopened (was Done, not all done) → the first column
 *  - otherwise           → keep current (manual column choices are preserved)
 */
export function deriveStatus(
  statuses: StatusLite[],
  current: string,
  subtasks: { done: boolean }[],
): string {
  if (subtasks.length === 0) return current;
  const ordered = [...statuses].sort(
    (a, b) => Number(a.isDone) - Number(b.isDone) || a.sortOrder - b.sortOrder,
  );
  const done = ordered.find((s) => s.isDone);
  const first = ordered[0];
  if (subtasks.every((s) => s.done)) return done?.name ?? current;
  if (done && current === done.name) return first?.name ?? current;
  return current;
}

/** Index of the active subtask = first not-done in sort order, or -1. */
export function currentSubtaskIndex(subtasks: { done: boolean; sortOrder: number }[]): number {
  const ordered = [...subtasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const found = ordered.find((s) => !s.done);
  if (!found) return -1;
  return subtasks.indexOf(found);
}
