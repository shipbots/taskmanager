// Date helpers. Due dates are stored at noon UTC so the calendar day is stable
// across the timezones this app is used in. Urgency is classified against the
// viewer's LOCAL day, so these run correctly on the client.

export type Urgency = 'overdue' | 'today' | 'future' | 'none';

/** Build a Date for a 'YYYY-MM-DD' input, anchored at noon UTC. */
export function parseDateInput(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

/** Coerce a date input (YYYY-MM-DD, possibly with time) to a stored Date or null. */
export function dueDateFromInput(input: string | null | undefined): Date | null {
  if (!input) return null;
  const ymd = String(input).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return parseDateInput(ymd);
}

/** Calendar day (YYYY-MM-DD) of a stored due date — read from its UTC parts. */
export function toYMD(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const iso = typeof value === 'string' ? value : value.toISOString();
  return iso.slice(0, 10);
}

/** Today's calendar day in the viewer's local timezone. */
export function todayYMD(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function classifyUrgency(
  due: string | Date | null | undefined,
  now: Date = new Date(),
): Urgency {
  const ymd = toYMD(due);
  if (!ymd) return 'none';
  const today = todayYMD(now);
  if (ymd < today) return 'overdue';
  if (ymd === today) return 'today';
  return 'future';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Friendly label: "Today", "Tomorrow", "Yesterday", or "Jun 20" / "Jun 20, 2027". */
export function formatDueDate(
  due: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const ymd = toYMD(due);
  if (!ymd) return '';
  const today = todayYMD(now);
  if (ymd === today) return 'Today';

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (ymd === todayYMD(tomorrow)) return 'Tomorrow';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (ymd === todayYMD(yesterday)) return 'Yesterday';

  const [y, m, d] = ymd.split('-').map(Number);
  const label = `${MONTHS[m - 1]} ${d}`;
  return y === now.getFullYear() ? label : `${label}, ${y}`;
}

/** Compact relative time for the activity timeline. */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return formatDueDate(d, now);
}

// ── Kanban date buckets ──────────────────────────────────────────────────────
// The Kanban board groups tasks into fixed, due-date-driven columns. Placement
// is automatic: done tasks go to "done"; a task with no due date sits in "today"
// indefinitely until it's completed.
export type DateBucket = 'late' | 'today' | 'tomorrow' | 'later' | 'done';

export function dateBucket(
  due: string | Date | null | undefined,
  isDone: boolean,
  now: Date = new Date(),
): DateBucket {
  if (isDone) return 'done';
  const ymd = toYMD(due);
  if (!ymd) return 'today'; // no date → Today, indefinitely
  const today = todayYMD(now);
  if (ymd < today) return 'late';
  if (ymd === today) return 'today';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (ymd === todayYMD(tomorrow)) return 'tomorrow';
  return 'later';
}

/** The due date (YYYY-MM-DD) a card receives when dropped on a date column. */
export function bucketTargetYMD(
  bucket: 'today' | 'tomorrow' | 'later',
  now: Date = new Date(),
): string {
  const d = new Date(now);
  if (bucket === 'tomorrow') d.setDate(now.getDate() + 1);
  else if (bucket === 'later') d.setDate(now.getDate() + 7); // a week out
  return todayYMD(d);
}

/** Tailwind text color class per spec: overdue=red, today=blue, later=normal. */
export function urgencyTextClass(u: Urgency): string {
  switch (u) {
    case 'overdue':
      return 'text-red-600';
    case 'today':
      return 'text-blue-600';
    default:
      return 'text-slate-700';
  }
}
