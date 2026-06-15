import { TaskStatus } from '@prisma/client';

// Pure derivation logic shared by API routes. Kept free of Prisma queries so it
// is easy to reason about and test.

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
 * Auto-advance status from subtask completion:
 *  - no subtasks            → status stays whatever the user set (fully manual)
 *  - all subtasks done      → COMPLETED
 *  - manual BLOCKED         → stays BLOCKED until everything is done
 *  - some done (not all)    → IN_PROGRESS
 *  - none done              → PENDING
 */
export function deriveStatus(
  current: TaskStatus,
  subtasks: { done: boolean }[],
): TaskStatus {
  if (subtasks.length === 0) return current;
  if (subtasks.every((s) => s.done)) return TaskStatus.COMPLETED;
  if (current === TaskStatus.BLOCKED) return TaskStatus.BLOCKED;
  return subtasks.some((s) => s.done) ? TaskStatus.IN_PROGRESS : TaskStatus.PENDING;
}

/** Index of the active subtask = first not-done in sort order, or -1. */
export function currentSubtaskIndex(subtasks: { done: boolean; sortOrder: number }[]): number {
  const ordered = [...subtasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const found = ordered.find((s) => !s.done);
  if (!found) return -1;
  return subtasks.indexOf(found);
}
