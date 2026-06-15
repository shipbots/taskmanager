import type {
  Task,
  Subtask,
  Attachment,
  Activity,
  Project,
  Template,
  TemplateSubtask,
  Status,
} from '@prisma/client';
import { currentSubtaskIndex } from '@/lib/task-derive';
import type {
  TaskView,
  SubtaskView,
  AttachmentView,
  ActivityView,
  ProjectView,
  TemplateView,
  StatusView,
  ActivityType,
} from '@/lib/types';

type TaskWithRelations = Task & {
  subtasks?: Subtask[];
  attachments?: Attachment[];
  activities?: Activity[];
  project?: (Project & { statuses?: Status[] }) | null;
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function serializeSubtasks(subtasks: Subtask[]): SubtaskView[] {
  const sorted = [...subtasks].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const currentIdx = currentSubtaskIndex(
    sorted.map((s) => ({ done: s.done, sortOrder: s.sortOrder })),
  );
  return sorted.map((s, i) => ({
    id: s.id,
    name: s.name,
    dueDate: iso(s.dueDate),
    done: s.done,
    completedAt: iso(s.completedAt),
    sortOrder: s.sortOrder,
    isCurrent: i === currentIdx,
  }));
}

export function serializeAttachment(a: Attachment): AttachmentView {
  return {
    id: a.id,
    fileName: a.fileName,
    url: a.url,
    size: a.size,
    contentType: a.contentType,
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializeActivity(a: Activity): ActivityView {
  return {
    id: a.id,
    type: a.type as ActivityType,
    message: a.message,
    meta: a.meta,
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializeTask(task: TaskWithRelations): TaskView {
  const subtasks = task.subtasks ? serializeSubtasks(task.subtasks) : [];
  const attachments = task.attachments ? task.attachments.map(serializeAttachment) : [];
  const activities = task.activities ? task.activities.map(serializeActivity) : [];
  const st = (task.project?.statuses ?? []).find((s) => s.name === task.status);
  return {
    id: task.id,
    projectId: task.projectId,
    projectSlug: task.project?.slug ?? null,
    projectName: task.project?.name ?? null,
    projectColor: task.project?.color ?? null,
    name: task.name,
    description: task.description,
    client: task.client,
    status: task.status,
    statusColor: st?.color ?? '#94a3b8',
    isDone: st?.isDone ?? false,
    priority: task.priority,
    dueDate: iso(task.dueDate),
    manualDueDate: iso(task.manualDueDate),
    completedAt: iso(task.completedAt),
    sortOrder: task.sortOrder,
    templateId: task.templateId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    subtasks,
    attachments,
    activities,
    subtaskCount: subtasks.length,
    doneSubtaskCount: subtasks.filter((s) => s.done).length,
    source: 'native',
    readOnly: false,
    externalUrl: null,
  };
}

export function serializeStatus(s: Status): StatusView {
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    sortOrder: s.sortOrder,
    isDone: s.isDone,
  };
}

export function serializeProject(p: Project): ProjectView {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    color: p.color,
    sortOrder: p.sortOrder,
    pullsFromOnboarding: p.pullsFromOnboarding,
  };
}

export function serializeTemplate(
  t: Template & { items?: TemplateSubtask[] },
): TemplateView {
  const items = (t.items ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({
      id: i.id,
      name: i.name,
      offsetDays: i.offsetDays,
      sortOrder: i.sortOrder,
    }));
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    projectId: t.projectId,
    items,
  };
}
