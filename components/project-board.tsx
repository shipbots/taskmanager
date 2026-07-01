'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  Plus,
  LayoutList,
  KanbanSquare,
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
} from 'lucide-react';
import type { ProjectView, StatusView, TaskView, LabelView } from '@/lib/types';
import { LabelFilter } from '@/components/label-filter';
import { TaskRow } from '@/components/task-row';
import { TaskCard } from '@/components/task-card';
import { TaskDrawer } from '@/components/task-drawer';
import { AddTaskModal } from '@/components/add-task-modal';
import { Button } from '@/components/ui';
import { sortByUrgency, orderStatuses } from '@/lib/sort';
import { dateBucket, bucketTargetYMD, type DateBucket } from '@/lib/dates';

// The Kanban board is organized by due date, not by manual status. Columns are
// fixed and a task's column is computed automatically (see `dateBucket`).
const DATE_COLUMNS: { id: DateBucket; label: string; color: string }[] = [
  { id: 'late', label: 'Late', color: '#dc2626' },
  { id: 'today', label: 'Today', color: '#2563eb' },
  { id: 'tomorrow', label: 'Tomorrow', color: '#f59e0b' },
  { id: 'later', label: 'Later', color: '#64748b' },
  { id: 'done', label: 'Done', color: '#16a34a' },
];

export function ProjectBoard({
  project,
  statuses: initialStatuses,
  tasks: initialTasks,
  projects,
}: {
  project: ProjectView;
  statuses: StatusView[];
  tasks: TaskView[];
  projects: ProjectView[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  // Statuses still drive completion (the isDone column) and ShipBots↔Monday sync,
  // but they're no longer Kanban columns, so the list is read-only here.
  const [statuses] = useState(initialStatuses);
  const [view, setView] = useState<'list' | 'kanban' | 'clients'>('kanban');
  const [open, setOpen] = useState<TaskView | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [labels, setLabels] = useState<LabelView[]>([]);
  const [labelFilter, setLabelFilter] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ShipBots pulls its client list from the Monday Clients board; native projects
  // use their own saved clients.
  const loadClients = useCallback(async () => {
    const url = project.pullsFromOnboarding
      ? '/api/shipbots/clients'
      : `/api/clients?projectId=${project.id}`;
    try {
      const res = await fetch(url);
      const data = res.ok ? await res.json() : [];
      if (Array.isArray(data)) setClients(data);
    } catch {
      /* ignore */
    }
  }, [project.id, project.pullsFromOnboarding]);
  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const loadLabels = useCallback(async () => {
    try {
      const res = await fetch(`/api/labels?projectId=${project.id}`);
      const d = res.ok ? await res.json() : [];
      if (Array.isArray(d)) setLabels(d);
    } catch {
      /* ignore */
    }
  }, [project.id]);
  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const clientCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) if (t.client) m.set(t.client, (m.get(t.client) ?? 0) + 1);
    return m;
  }, [tasks]);

  async function renameClient(id: string, oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      alert('Could not rename client');
      return;
    }
    setTasks((prev) => prev.map((t) => (t.client === oldName ? { ...t, client: trimmed } : t)));
    loadClients();
  }

  function openClient(name: string) {
    setClientFilter(name);
    setView('list');
  }

  const clientOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.client).filter((c): c is string => !!c))).sort(),
    [tasks],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (clientFilter && t.client !== clientFilter) return false;
      if (labelFilter && !t.labels.some((l) => l.id === labelFilter)) return false;
      if (q && !(t.name.toLowerCase().includes(q) || (t.client ?? '').toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [tasks, search, clientFilter, labelFilter]);
  const listTasks = useMemo(() => sortByUrgency(filtered), [filtered]);
  const dateColumns = useMemo(() => {
    const map: Record<DateBucket, TaskView[]> = {
      late: [],
      today: [],
      tomorrow: [],
      later: [],
      done: [],
    };
    for (const t of filtered) map[dateBucket(t.dueDate, t.isDone)].push(t);
    return DATE_COLUMNS.map((c) => ({ ...c, tasks: sortByUrgency(map[c.id]) }));
  }, [filtered]);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function upsertTask(task: TaskView) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx === -1) return [task, ...prev];
      const next = [...prev];
      next[idx] = task;
      return next;
    });
  }
  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function move(task: TaskView, statusName: string) {
    if (task.status === statusName) return;
    const target = statuses.find((s) => s.name === statusName);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: statusName, statusColor: target?.color ?? t.statusColor, isDone: target?.isDone ?? false }
          : t,
      ),
    );
    try {
      // ShipBots tasks are Monday subitems — write status back to Monday.
      const url =
        task.source === 'shipbots'
          ? `/api/shipbots/tasks/${task.externalId}`
          : `/api/tasks/${task.id}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusName }),
      });
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      } else if (task.source !== 'shipbots') {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
  }

  function toggleComplete(task: TaskView) {
    const done = statuses.find((s) => s.isDone);
    const first = orderStatuses(statuses)[0];
    const target = task.isDone ? first?.name : done?.name;
    if (target) move(task, target);
  }

  // Drop on Done → complete. Drop on a date column → reschedule the due date to
  // match that column (and reopen if it was done). "Late" isn't a drop target.
  async function reschedule(task: TaskView, bucket: 'today' | 'tomorrow' | 'later') {
    const reopening = task.isDone;
    const ymd = bucketTargetYMD(bucket);
    const firstOpen = orderStatuses(statuses).find((s) => !s.isDone);
    const snapshot = task;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              dueDate: `${ymd}T12:00:00.000Z`,
              ...(reopening && firstOpen
                ? { isDone: false, status: firstOpen.name, statusColor: firstOpen.color }
                : {}),
            }
          : t,
      ),
    );

    try {
      const url =
        task.source === 'shipbots'
          ? `/api/shipbots/tasks/${task.externalId}`
          : `/api/tasks/${task.id}`;
      const payload: Record<string, unknown> = { dueDate: ymd, rescheduleMode: 'kanban' };
      if (reopening && firstOpen) payload.status = firstOpen.name;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? snapshot : t)));
      } else if (task.source !== 'shipbots') {
        // Native PATCH returns the canonical task (its due date may follow a subtask).
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? snapshot : t)));
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const over = e.over?.id as DateBucket | undefined;
    const task = tasks.find((t) => t.id === e.active.id);
    if (!task || !over || over === 'late') return;
    if (dateBucket(task.dueDate, task.isDone) === over) return; // already in this column
    if (over === 'done') {
      toggleComplete(task); // task isn't done here, so this completes it
      return;
    }
    reschedule(task, over);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="w-3.5 h-3.5 rounded-full" style={{ background: project.color }} />
        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
        {project.pullsFromOnboarding && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-600">
            mirrors Onboarding Dashboard
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <LayoutList className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${view === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <KanbanSquare className="w-4 h-4" /> Kanban
            </button>
            <button
              onClick={() => setView('clients')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${view === 'clients' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <Users className="w-4 h-4" /> Clients
            </button>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <span className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New task
            </span>
          </Button>
        </div>
      </div>

      {view !== 'clients' && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or clients…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        {clientOptions.length > 0 && (
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All clients</option>
            {clientOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <LabelFilter
          projectId={project.id}
          labels={labels}
          onLabelsChange={setLabels}
          selected={labelFilter}
          onSelect={setLabelFilter}
        />
        {(search || clientFilter || labelFilter) && (
          <span className="text-xs text-slate-400">
            {filtered.length} match{filtered.length === 1 ? '' : 'es'}
          </span>
        )}
        </div>
      )}

      {view === 'clients' ? (
        <ClientsPanel
          clients={clients}
          counts={clientCounts}
          editable={!project.pullsFromOnboarding}
          search={clientSearch}
          onSearch={setClientSearch}
          onRename={renameClient}
          onOpen={openClient}
        />
      ) : view === 'list' ? (
        <div className="space-y-1.5">
          {listTasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No tasks yet. Create your first one.</p>
          ) : (
            listTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onClick={() => setOpen(task)}
                onToggleComplete={() => toggleComplete(task)}
              />
            ))
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-2 items-start">
            {dateColumns.map((col) => (
              <DateColumn
                key={col.id}
                column={col}
                droppable={col.id !== 'late'}
                collapsed={col.id === 'done' && !showCompleted}
                onToggleCollapse={col.id === 'done' ? () => setShowCompleted((s) => !s) : undefined}
                onOpen={setOpen}
                onToggleComplete={toggleComplete}
              />
            ))}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
        </DndContext>
      )}

      {open && (
        <TaskDrawer
          taskId={open.id}
          initialTask={open}
          onUpdated={upsertTask}
          onDeleted={removeTask}
          onClose={() => setOpen(null)}
        />
      )}
      {addOpen && (
        <AddTaskModal
          projects={projects}
          defaultProjectId={project.id}
          onClose={() => setAddOpen(false)}
          onCreated={upsertTask}
        />
      )}
    </div>
  );
}

function DateColumn({
  column,
  droppable,
  collapsed,
  onToggleCollapse,
  onOpen,
  onToggleComplete,
}: {
  column: { id: DateBucket; label: string; color: string; tasks: TaskView[] };
  droppable: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpen: (task: TaskView) => void;
  onToggleComplete: (task: TaskView) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !droppable });

  return (
    <div className="w-72 shrink-0">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: column.color }} />
        <span className="text-sm font-semibold text-slate-700">{column.label}</span>
        <span className="text-xs text-slate-400">{column.tasks.length}</span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="ml-auto p-0.5 text-slate-400"
            title={collapsed ? 'Show done' : 'Hide done'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`rounded-xl p-2 transition-colors ${isOver ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-slate-50/60'} ${collapsed ? 'min-h-[44px]' : 'min-h-[120px] space-y-2'}`}
      >
        {collapsed ? (
          <div className="text-xs text-slate-400 px-1 py-1">{column.tasks.length} done</div>
        ) : (
          <>
            {column.tasks.map((task) => (
              <DraggableCard
                key={task.id}
                task={task}
                onOpen={() => onOpen(task)}
                onToggleComplete={() => onToggleComplete(task)}
              />
            ))}
            {column.tasks.length === 0 && (
              <div className="text-xs text-slate-300 px-1 py-4 text-center select-none">
                {droppable ? 'Drop here' : '—'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  onOpen,
  onToggleComplete,
}: {
  task: TaskView;
  onOpen: () => void;
  onToggleComplete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: task.readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-pointer ${isDragging ? 'opacity-40' : ''}`}
    >
      <TaskCard task={task} onToggleComplete={onToggleComplete} />
    </div>
  );
}

function ClientsPanel({
  clients,
  counts,
  editable,
  search,
  onSearch,
  onRename,
  onOpen,
}: {
  clients: { id: string; name: string }[];
  counts: Map<string, number>;
  editable: boolean;
  search: string;
  onSearch: (s: string) => void;
  onRename: (id: string, oldName: string, newName: string) => void;
  onOpen: (name: string) => void;
}) {
  const q = search.trim().toLowerCase();
  const rows = clients
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .map((c) => ({ ...c, count: counts.get(c.name) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative max-w-xs mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search clients…"
          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div className="space-y-1.5">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No clients yet.</p>
        ) : (
          rows.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              editable={editable}
              onRename={onRename}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ClientRow({
  client,
  editable,
  onRename,
  onOpen,
}: {
  client: { id: string; name: string; count: number };
  editable: boolean;
  onRename: (id: string, oldName: string, newName: string) => void;
  onOpen: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);

  function save() {
    setEditing(false);
    if (name.trim() && name.trim() !== client.name) onRename(client.id, client.name, name.trim());
    else setName(client.name);
  }

  return (
    <div className="group flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-3 py-2.5 hover:border-slate-300 transition">
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setName(client.name);
              setEditing(false);
            }
          }}
          className="flex-1 text-sm border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-[var(--accent)]"
        />
      ) : (
        <button
          onClick={() => onOpen(client.name)}
          className="flex-1 text-left text-sm font-medium text-slate-800 hover:text-[var(--accent)] truncate"
        >
          {client.name}
        </button>
      )}
      <span className="text-xs text-slate-400 shrink-0">
        {client.count} task{client.count === 1 ? '' : 's'}
      </span>
      {editable && !editing && (
        <button
          onClick={() => {
            setName(client.name);
            setEditing(true);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-slate-600 shrink-0"
          title="Rename client"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
