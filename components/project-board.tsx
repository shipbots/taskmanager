'use client';

import { useMemo, useState } from 'react';
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
import { Plus, LayoutList, KanbanSquare, ChevronDown, ChevronRight } from 'lucide-react';
import type { ProjectView, TaskView, TaskStatus } from '@/lib/types';
import { STATUS_ORDER, STATUS_META } from '@/lib/types';
import { TaskRow } from '@/components/task-row';
import { TaskCard } from '@/components/task-card';
import { TaskDrawer } from '@/components/task-drawer';
import { AddTaskModal } from '@/components/add-task-modal';
import { Button } from '@/components/ui';
import { sortByUrgency, groupByStatus } from '@/lib/sort';

export function ProjectBoard({
  project,
  tasks: initialTasks,
  projects,
}: {
  project: ProjectView;
  tasks: TaskView[];
  projects: ProjectView[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [open, setOpen] = useState<TaskView | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const listTasks = useMemo(() => sortByUrgency(tasks), [tasks]);
  const grouped = useMemo(() => groupByStatus(tasks), [tasks]);
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

  async function move(task: TaskView, status: TaskStatus) {
    if (task.status === status || task.readOnly) return;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
      }
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
    }
  }

  function toggleComplete(task: TaskView) {
    const target =
      task.status === 'COMPLETED' ? (task.subtaskCount > 0 ? 'IN_PROGRESS' : 'PENDING') : 'COMPLETED';
    move(task, target);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id as TaskStatus | undefined;
    const task = tasks.find((t) => t.id === e.active.id);
    if (task && overId && STATUS_ORDER.includes(overId)) move(task, overId);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-3.5 h-3.5 rounded-full" style={{ background: project.color }} />
        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
        {project.pullsFromOnboarding && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-600">
            mirrors Onboarding Dashboard
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
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
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <span className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New task
            </span>
          </Button>
        </div>
      </div>

      {view === 'list' ? (
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
          <div className="flex gap-3 overflow-x-auto pb-2">
            {STATUS_ORDER.map((status) => (
              <Column
                key={status}
                status={status}
                tasks={grouped[status]}
                collapsed={status === 'COMPLETED' && !showCompleted}
                onToggleCollapse={status === 'COMPLETED' ? () => setShowCompleted((s) => !s) : undefined}
                onOpen={(t) => setOpen(t)}
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

function Column({
  status,
  tasks,
  collapsed,
  onToggleCollapse,
  onOpen,
}: {
  status: TaskStatus;
  tasks: TaskView[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpen: (task: TaskView) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="w-72 shrink-0">
      <button
        onClick={onToggleCollapse}
        disabled={!onToggleCollapse}
        className="w-full flex items-center gap-2 px-2 py-1.5 mb-2"
      >
        <span className={`w-2 h-2 rounded-full ${STATUS_META[status].dot}`} />
        <span className="text-sm font-semibold text-slate-700">{STATUS_META[status].label}</span>
        <span className="text-xs text-slate-400">{tasks.length}</span>
        {onToggleCollapse &&
          (collapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
          ))}
      </button>
      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`space-y-2 min-h-[120px] rounded-xl p-2 transition-colors ${isOver ? 'bg-indigo-50' : 'bg-slate-50/60'}`}
        >
          {tasks.map((task) => (
            <DraggableCard key={task.id} task={task} onOpen={() => onOpen(task)} />
          ))}
          {tasks.length === 0 && <div className="h-16" />}
        </div>
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
