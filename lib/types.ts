// Client-safe types and UI metadata. No runtime imports from @prisma/client so
// this can be imported from client components. String unions mirror the Prisma
// enums exactly.

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskSource = 'native' | 'shipbots';

export type ActivityType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'FIELD_CHANGED'
  | 'DUE_DATE_CHANGED'
  | 'SUBTASK_ADDED'
  | 'SUBTASK_COMPLETED'
  | 'SUBTASK_REOPENED'
  | 'SUBTASK_REMOVED'
  | 'TEMPLATE_APPLIED'
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_REMOVED'
  | 'COMMENT';

export interface SubtaskView {
  id: string;
  name: string;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  sortOrder: number;
  isCurrent: boolean;
}

export interface AttachmentView {
  id: string;
  fileName: string;
  url: string;
  size: number;
  contentType: string | null;
  createdAt: string;
}

export interface ActivityView {
  id: string;
  type: ActivityType;
  message: string;
  meta: unknown;
  createdAt: string;
}

export interface TaskView {
  id: string;
  projectId: string;
  projectSlug: string | null;
  projectName: string | null;
  projectColor: string | null;
  name: string;
  description: string | null;
  client: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  manualDueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: SubtaskView[];
  attachments: AttachmentView[];
  activities: ActivityView[];
  subtaskCount: number;
  doneSubtaskCount: number;
  source: TaskSource;
  readOnly: boolean;
  externalUrl: string | null;
}

export interface ProjectView {
  id: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  pullsFromOnboarding: boolean;
}

export interface TemplateItemView {
  id: string;
  name: string;
  offsetDays: number | null;
  sortOrder: number;
}

export interface TemplateView {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  items: TemplateItemView[];
}

// ─── UI metadata ──────────────────────────────────────────────────────────────

export const STATUS_ORDER: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];

export const STATUS_META: Record<TaskStatus, { label: string; badge: string; dot: string }> = {
  PENDING: { label: 'Pending', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  BLOCKED: { label: 'Blocked', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  COMPLETED: { label: 'Completed', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

export const PRIORITY_ORDER: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; dot: string; rank: number }
> = {
  URGENT: { label: 'Urgent', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', rank: 0 },
  HIGH: { label: 'High', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', rank: 1 },
  MEDIUM: { label: 'Medium', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', rank: 2 },
  LOW: { label: 'Low', badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300', rank: 3 },
};

/** Sort key for "most important first": overdue/urgency handled by caller via dueDate. */
export function priorityRank(p: Priority): number {
  return PRIORITY_META[p].rank;
}
