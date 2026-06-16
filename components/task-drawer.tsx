'use client';

import { useEffect, useRef, useState } from 'react';
import { Drawer, inputClass, labelClass } from '@/components/ui';
import type { TaskView, TemplateView, Priority, ActivityType, StatusView } from '@/lib/types';
import { PRIORITY_ORDER, PRIORITY_META, statusPillStyle } from '@/lib/types';
import { formatDueDate, timeAgo, toYMD, parseDateInput } from '@/lib/dates';
import {
  X,
  Trash2,
  Plus,
  Check,
  Calendar,
  Paperclip,
  Download,
  ExternalLink,
  MessageSquare,
  Flag,
  Pencil,
  ListPlus,
  CheckCircle2,
  RotateCcw,
  LayoutTemplate,
  Sparkles,
} from 'lucide-react';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const ACTIVITY_ICON: Record<ActivityType, typeof Flag> = {
  CREATED: Sparkles,
  STATUS_CHANGED: Flag,
  FIELD_CHANGED: Pencil,
  DUE_DATE_CHANGED: Calendar,
  SUBTASK_ADDED: ListPlus,
  SUBTASK_COMPLETED: CheckCircle2,
  SUBTASK_REOPENED: RotateCcw,
  SUBTASK_REMOVED: Trash2,
  TEMPLATE_APPLIED: LayoutTemplate,
  ATTACHMENT_ADDED: Paperclip,
  ATTACHMENT_REMOVED: Paperclip,
  COMMENT: MessageSquare,
};

export function TaskDrawer({
  taskId,
  initialTask,
  onUpdated,
  onDeleted,
  onClose,
}: {
  taskId: string;
  initialTask?: TaskView;
  onUpdated: (task: TaskView) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const isShipbots = initialTask?.source === 'shipbots' || taskId.startsWith('shipbots:');
  const externalId = initialTask?.externalId ?? taskId.replace(/^shipbots:/, '');
  const readOnly = !!initialTask?.readOnly; // ShipBots is editable but writes to Monday
  const [task, setTask] = useState<TaskView | null>(initialTask ?? null);
  const [templates, setTemplates] = useState<TemplateView[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<StatusView[]>([]);
  const [newSub, setNewSub] = useState('');
  const [newSubDate, setNewSubDate] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load full detail for native tasks (subtasks/attachments/timeline).
  useEffect(() => {
    const pid = initialTask?.projectId;
    // ShipBots tasks live in Monday, not our DB — only load the status options.
    if (isShipbots) {
      if (pid)
        fetch(`/api/statuses?projectId=${pid}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => Array.isArray(d) && setStatuses(d))
          .catch(() => {});
      return;
    }
    if (readOnly) return;
    fetch(`/api/tasks/${taskId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setTask(data))
      .catch(() => {});
    fetch('/api/templates')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setTemplates(d))
      .catch(() => {});
    if (pid) {
      fetch(`/api/clients?projectId=${pid}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => Array.isArray(d) && setClients(d.map((c: { name: string }) => c.name)))
        .catch(() => {});
      fetch(`/api/statuses?projectId=${pid}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => Array.isArray(d) && setStatuses(d))
        .catch(() => {});
    }
  }, [taskId, readOnly, isShipbots, initialTask?.projectId]);

  function apply(updated: TaskView) {
    setTask(updated);
    onUpdated(updated);
  }

  async function patchTask(body: Record<string, unknown>) {
    // ShipBots tasks are Monday subitems — write back to Monday, update locally.
    if (isShipbots) {
      if (!task) return;
      const res = await fetch(`/api/shipbots/tasks/${externalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const updated: TaskView = { ...task };
      if (typeof body.name === 'string') updated.name = body.name;
      if (typeof body.status === 'string') {
        const st = statuses.find((s) => s.name === body.status);
        updated.status = body.status;
        updated.statusColor = st?.color ?? updated.statusColor;
        updated.isDone = st?.isDone ?? /done|complete|finished|delivered/i.test(body.status);
        updated.completedAt = updated.isDone ? updated.dueDate : null;
      }
      if (body.dueDate !== undefined) {
        const ymd = body.dueDate ? String(body.dueDate).slice(0, 10) : '';
        updated.dueDate = ymd ? parseDateInput(ymd).toISOString() : null;
        updated.manualDueDate = updated.dueDate;
      }
      apply(updated);
      return;
    }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) apply(await res.json());
  }

  async function toggleSub(subId: string, done: boolean) {
    const res = await fetch(`/api/subtasks/${subId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    });
    if (res.ok) apply(await res.json());
  }

  async function setSubDate(subId: string, dueDate: string) {
    const res = await fetch(`/api/subtasks/${subId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate: dueDate || null }),
    });
    if (res.ok) apply(await res.json());
  }

  async function deleteSub(subId: string) {
    const res = await fetch(`/api/subtasks/${subId}`, { method: 'DELETE' });
    if (res.ok) apply(await res.json());
  }

  async function addSub() {
    if (!newSub.trim()) return;
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSub.trim(), dueDate: newSubDate || null }),
    });
    if (res.ok) {
      apply(await res.json());
      setNewSub('');
      setNewSubDate('');
    }
  }

  async function applyTemplate(templateId: string) {
    if (!templateId) return;
    const res = await fetch(`/api/tasks/${taskId}/apply-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId }),
    });
    if (res.ok) apply(await res.json());
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: fd });
      if (res.ok) apply(await res.json());
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function removeAttachment(id: string) {
    const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    if (res.ok) apply(await res.json());
  }

  async function addComment() {
    if (!comment.trim() || !task) return;
    const res = await fetch(`/api/tasks/${taskId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: comment.trim() }),
    });
    if (res.ok) {
      const activity = await res.json();
      const updated = { ...task, activities: [activity, ...task.activities] };
      setTask(updated);
      setComment('');
    }
  }

  async function deleteTask() {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      onDeleted(taskId);
      onClose();
    }
  }

  if (!task) {
    return (
      <Drawer onClose={onClose}>
        <div className="p-6 text-sm text-slate-400">Loading…</div>
      </Drawer>
    );
  }

  return (
    <Drawer onClose={onClose}>
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: task.projectColor ?? '#94a3b8' }}
        />
        <span className="text-xs font-medium text-slate-500">{task.projectName}</span>
        {task.source === 'shipbots' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600">ShipBots · synced with Monday</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!readOnly && !isShipbots && (
            <button onClick={deleteTask} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Name */}
        {readOnly ? (
          <h1 className="text-lg font-semibold text-slate-900">{task.name}</h1>
        ) : (
          <input
            defaultValue={task.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== task.name && patchTask({ name: e.target.value.trim() })}
            className="w-full text-lg font-semibold text-slate-900 border-0 border-b border-transparent hover:border-slate-200 focus:border-[var(--accent)] focus:outline-none pb-1"
          />
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Status</label>
            {readOnly ? (
              <span
                className="inline-block text-xs px-2 py-1 rounded-full font-medium"
                style={statusPillStyle(task.statusColor)}
              >
                {task.status}
              </span>
            ) : (
              <select
                className={inputClass}
                value={task.status}
                onChange={(e) => patchTask({ status: e.target.value })}
              >
                {!statuses.some((s) => s.name === task.status) && (
                  <option value={task.status}>{task.status}</option>
                )}
                {statuses.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            {readOnly || isShipbots ? (
              <span className={`inline-block text-xs px-2 py-1 rounded-full ${PRIORITY_META[task.priority].badge}`}>
                {PRIORITY_META[task.priority].label}
              </span>
            ) : (
              <select
                className={inputClass}
                value={task.priority}
                onChange={(e) => patchTask({ priority: e.target.value as Priority })}
              >
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className={labelClass}>Client</label>
            {readOnly || isShipbots ? (
              <div className="text-sm text-slate-700">{task.client || '—'}</div>
            ) : (
              <>
                <input
                  defaultValue={task.client ?? ''}
                  onBlur={(e) => e.target.value !== (task.client ?? '') && patchTask({ client: e.target.value })}
                  className={inputClass}
                  placeholder="Client"
                  list="drawer-clients"
                />
                <datalist id="drawer-clients">
                  {clients.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </div>
          <div>
            <label className={labelClass}>
              Due date {task.subtaskCount > 0 && <span className="text-slate-300">(from subtasks)</span>}
            </label>
            {readOnly ? (
              <div className="text-sm text-slate-700">{formatDueDate(task.dueDate) || '—'}</div>
            ) : (
              <input
                type="date"
                value={toYMD(task.manualDueDate) ?? ''}
                onChange={(e) => patchTask({ dueDate: e.target.value || null })}
                className={inputClass}
              />
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          {readOnly || isShipbots ? (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{task.description || '—'}</p>
          ) : (
            <textarea
              defaultValue={task.description ?? ''}
              onBlur={(e) => e.target.value !== (task.description ?? '') && patchTask({ description: e.target.value })}
              rows={3}
              className={inputClass}
              placeholder="Add details…"
            />
          )}
        </div>

        {isShipbots && task.externalUrl && (
          <a
            href={task.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-sky-600 hover:underline"
          >
            <ExternalLink className="w-4 h-4" /> Open in Onboarding Dashboard
          </a>
        )}

        {/* Subtasks */}
        {!readOnly && !isShipbots && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>
                Subtasks{' '}
                {task.subtaskCount > 0 && (
                  <span className="text-slate-400">
                    · {task.doneSubtaskCount}/{task.subtaskCount}
                  </span>
                )}
              </label>
              {templates.length > 0 && task.subtaskCount === 0 && (
                <select
                  className="text-xs text-slate-500 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                  defaultValue=""
                  onChange={(e) => {
                    applyTemplate(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">Apply template…</option>
                  {templates
                    .filter((t) => t.projectId === null || t.projectId === task.projectId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              )}
            </div>

            {task.subtaskCount > 0 && (
              <div className="mb-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${(task.doneSubtaskCount / task.subtaskCount) * 100}%` }}
                />
              </div>
            )}

            <div className="space-y-1">
              {task.subtasks.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg ${s.isCurrent && !s.done ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                >
                  <button
                    onClick={() => toggleSub(s.id, !s.done)}
                    className={`w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 ${s.done ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-slate-300 hover:border-[var(--accent)]'}`}
                  >
                    {s.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`text-sm flex-1 ${s.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {s.name}
                    {s.isCurrent && !s.done && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">
                        current
                      </span>
                    )}
                  </span>
                  <input
                    type="date"
                    value={toYMD(s.dueDate) ?? ''}
                    onChange={(e) => setSubDate(s.id, e.target.value)}
                    className="text-xs text-slate-500 border border-transparent group-hover:border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    onClick={() => deleteSub(s.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSub()}
                placeholder="Add a subtask…"
                className={inputClass}
              />
              <input
                type="date"
                value={newSubDate}
                onChange={(e) => setNewSubDate(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-2 text-slate-500 focus:outline-none"
              />
              <button
                onClick={addSub}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Attachments */}
        {!readOnly && !isShipbots && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Attachments</label>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                <Paperclip className="w-3.5 h-3.5" /> {busy ? 'Uploading…' : 'Add file'}
              </button>
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
            </div>
            <div className="space-y-1">
              {task.attachments.length === 0 && (
                <p className="text-xs text-slate-400">No files attached.</p>
              )}
              {task.attachments.map((a) => (
                <div
                  key={a.id}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sm"
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-slate-700 hover:underline">
                    {a.fileName}
                  </a>
                  <span className="text-xs text-slate-400">{formatBytes(a.size)}</span>
                  <a href={a.url} target="_blank" rel="noreferrer" download className="p-1 text-slate-300 hover:text-slate-600">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {!readOnly && !isShipbots && (
          <div>
            <label className={labelClass}>Timeline</label>
            <div className="flex items-center gap-2 mb-3">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addComment()}
                placeholder="Add a note…"
                className={inputClass}
              />
              <button
                onClick={addComment}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2.5">
              {task.activities.map((a) => {
                const Icon = ACTIVITY_ICON[a.type] ?? Pencil;
                return (
                  <li key={a.id} className="flex gap-2.5 text-sm">
                    <span className="mt-0.5 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-slate-500" />
                    </span>
                    <div className="min-w-0">
                      <span className={a.type === 'COMMENT' ? 'text-slate-800' : 'text-slate-600'}>
                        {a.message}
                      </span>
                      <span className="ml-2 text-xs text-slate-300">{timeAgo(a.createdAt)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </Drawer>
  );
}
