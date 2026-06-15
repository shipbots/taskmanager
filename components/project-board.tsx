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
import type { ProjectView, StatusView, TaskView } from '@/lib/types';
import { TaskRow } from '@/components/task-row';
import { TaskCard } from '@/components/task-card';
import { TaskDrawer } from '@/components/task-drawer';
import { AddTaskModal } from '@/components/add-task-modal';
import { Button } from '@/components/ui';
import { sortByUrgency, groupByStatus, orderStatuses } from '@/lib/sort';

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
  const [statuses, setStatuses] = useState(initialStatuses);
  const [view, setView] = useState<'list' | 'kanban' | 'clients'>('list');
  const [open, setOpen] = useState<TaskView | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientSearch, setClientSearch] = useState('');

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
      if (q && !(t.name.toLowerCase().includes(q) || (t.client ?? '').toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [tasks, search, clientFilter]);
  const listTasks = useMemo(() => sortByUrgency(filtered), [filtered]);
  const columns = useMemo(() => groupByStatus(filtered, statuses), [filtered, statuses]);
  const nonDoneCount = statuses.filter((s) => !s.isDone).length;
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
    if (task.status === statusName || task.readOnly) return;
    const target = statuses.find((s) => s.name === statusName);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: statusName, statusColor: target?.color ?? t.statusColor, isDone: target?.isDone ?? false }
          : t,
      ),
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
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

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overName = e.over?.id as string | undefined;
    const task = tasks.find((t) => t.id === e.active.id);
    if (task && overName && statuses.some((s) => s.name === overName)) move(task, overName);
  }

  // ── Column CRUD ──
  async function addColumn(name: string) {
    const res = await fetch('/api/statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, name }),
    });
    if (res.ok) {
      const created = await res.json();
      setStatuses((prev) => [...prev, created]);
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.error ?? 'Could not add column');
    }
  }
  async function renameColumn(id: string, name: string) {
    const old = statuses.find((s) => s.id === id);
    const res = await fetch(`/api/statuses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setStatuses((prev) => prev.map((s) => (s.id === id ? updated : s)));
      if (old) setTasks((prev) => prev.map((t) => (t.status === old.name ? { ...t, status: updated.name } : t)));
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.error ?? 'Could not rename column');
    }
  }
  async function deleteColumn(id: string) {
    const st = statuses.find((s) => s.id === id);
    if (!st || !confirm(`Delete the "${st.name}" column? Its tasks move to the first column.`)) return;
    const res = await fetch(`/api/statuses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const remaining = statuses.filter((s) => s.id !== id);
      setStatuses(remaining);
      const first = orderStatuses(remaining)[0];
      if (first)
        setTasks((prev) =>
          prev.map((t) =>
            t.status === st.name
              ? { ...t, status: first.name, statusColor: first.color, isDone: first.isDone }
              : t,
          ),
        );
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.error ?? 'Could not delete column');
    }
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
        {(search || clientFilter) && (
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
            {columns.map(({ status, tasks: colTasks }) => (
              <Column
                key={status.id}
                status={status}
                tasks={colTasks}
                collapsed={status.isDone && !showCompleted}
                onToggleCollapse={status.isDone ? () => setShowCompleted((s) => !s) : undefined}
                canDelete={!status.isDone && nonDoneCount > 1}
                onRename={renameColumn}
                onDelete={deleteColumn}
                onOpen={setOpen}
              />
            ))}
            <AddColumn onAdd={addColumn} />
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

function Column({
  status,
  tasks,
  collapsed,
  onToggleCollapse,
  canDelete,
  onRename,
  onDelete,
  onOpen,
}: {
  status: StatusView;
  tasks: TaskView[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  canDelete: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpen: (task: TaskView) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.name });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(status.name);

  function save() {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== status.name) onRename(status.id, trimmed);
    else setName(status.name);
  }

  return (
    <div className="w-72 shrink-0">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-2 group/col">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: status.color }} />
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') {
                setName(status.name);
                setEditing(false);
              }
            }}
            className="text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-0.5 min-w-0 flex-1 focus:outline-none focus:border-[var(--accent)]"
          />
        ) : (
          <>
            <span className="text-sm font-semibold text-slate-700">{status.name}</span>
            <span className="text-xs text-slate-400">{tasks.length}</span>
            <button
              onClick={() => {
                setName(status.name);
                setEditing(true);
              }}
              className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded text-slate-300 hover:text-slate-600"
              title="Rename column"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {canDelete && (
              <button
                onClick={() => onDelete(status.id)}
                className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded text-slate-300 hover:text-red-500"
                title="Delete column"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onToggleCollapse && (
              <button onClick={onToggleCollapse} className="ml-auto p-0.5 text-slate-400">
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`rounded-xl p-2 transition-colors ${isOver ? 'bg-indigo-50' : 'bg-slate-50/60'} ${collapsed ? 'min-h-[44px]' : 'min-h-[120px] space-y-2'}`}
      >
        {collapsed ? (
          <div className="text-xs text-slate-400 px-1 py-1">{tasks.length} done — drop here to complete</div>
        ) : (
          <>
            {tasks.map((task) => (
              <DraggableCard key={task.id} task={task} onOpen={() => onOpen(task)} />
            ))}
            {tasks.length === 0 && <div className="h-16" />}
          </>
        )}
      </div>
    </div>
  );
}

function AddColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  function save() {
    const trimmed = name.trim();
    if (trimmed) onAdd(trimmed);
    setName('');
    setAdding(false);
  }
  return (
    <div className="w-56 shrink-0">
      {adding ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setName('');
              setAdding(false);
            }
          }}
          placeholder="Column name…"
          className="w-full text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)]"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-400 hover:text-slate-700 hover:border-slate-400"
        >
          <Plus className="w-4 h-4" /> Add column
        </button>
      )}
    </div>
  );
}

function DraggableCard({ task, onOpen }: { task: TaskView; onOpen: () => void }) {
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
      <TaskCard task={task} />
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
