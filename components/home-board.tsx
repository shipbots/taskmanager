'use client';

import { useState } from 'react';
import { Plus, FolderPlus, LayoutList, CalendarDays } from 'lucide-react';
import type { ProjectView, TaskView, StatusView } from '@/lib/types';
import type { ProjectSection } from '@/lib/load';

// Optimistic columns for a just-created project (server seeds the real ones).
const DEFAULT_COLUMNS: StatusView[] = [
  { id: 'pending', name: 'Pending', color: '#94a3b8', sortOrder: 0, isDone: false },
  { id: 'in-progress', name: 'In Progress', color: '#3b82f6', sortOrder: 1, isDone: false },
  { id: 'blocked', name: 'Blocked', color: '#f59e0b', sortOrder: 2, isDone: false },
  { id: 'done', name: 'Done', color: '#22c55e', sortOrder: 3, isDone: true },
];
import { ProjectColumn } from '@/components/project-column';
import { TaskDrawer } from '@/components/task-drawer';
import { AddTaskModal } from '@/components/add-task-modal';
import { AddProjectModal } from '@/components/add-project-modal';
import { CalendarView } from '@/components/calendar-view';
import { Button } from '@/components/ui';
import { orderStatuses } from '@/lib/sort';

export function HomeBoard({
  sections: initialSections,
  projects: initialProjects,
}: {
  sections: ProjectSection[];
  projects: ProjectView[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [projects, setProjects] = useState(initialProjects);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [open, setOpen] = useState<TaskView | null>(null);
  const [addTaskFor, setAddTaskFor] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  const allTasks = sections.flatMap((s) => s.tasks);

  function upsertTask(task: TaskView) {
    setSections((prev) =>
      prev.map((s) =>
        s.project.id === task.projectId
          ? { ...s, tasks: mergeTask(s.tasks, task) }
          : { ...s, tasks: s.tasks.filter((t) => t.id !== task.id) },
      ),
    );
  }
  function removeTask(id: string) {
    setSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })));
  }

  async function toggleComplete(task: TaskView) {
    if (task.readOnly) return;
    const statuses = sections.find((s) => s.project.id === task.projectId)?.statuses ?? [];
    const done = statuses.find((s) => s.isDone);
    const first = orderStatuses(statuses)[0];
    const target = task.isDone ? first?.name : done?.name;
    if (!target || target === task.status) return;
    upsertTask({ ...task, status: target, isDone: !task.isDone }); // optimistic
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target }),
      });
      upsertTask(res.ok ? await res.json() : task);
    } catch {
      upsertTask(task);
    }
  }

  function renameProject(updated: ProjectView) {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSections((prev) =>
      prev.map((s) => (s.project.id === updated.id ? { ...s, project: updated } : s)),
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Home</h1>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <LayoutList className="w-4 h-4" /> Board
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${view === 'calendar' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <CalendarDays className="w-4 h-4" /> Calendar
            </button>
          </div>
          <Button variant="ghost" onClick={() => setAddProjectOpen(true)}>
            <span className="flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4" /> Project
            </span>
          </Button>
          <Button
            onClick={() => {
              setAddTaskFor(null);
              setAddTaskOpen(true);
            }}
          >
            <span className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New task
            </span>
          </Button>
        </div>
      </div>

      {view === 'calendar' ? (
        <CalendarView tasks={allTasks} onSelect={(t) => setOpen(t)} />
      ) : (
        <div
          className="grid gap-4 items-start"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
        >
          {sections.map(({ project, tasks }) => (
            <ProjectColumn
              key={project.id}
              project={project}
              tasks={tasks}
              onAddTask={() => {
                setAddTaskFor(project.id);
                setAddTaskOpen(true);
              }}
              onOpenTask={(t) => setOpen(t)}
              onToggleComplete={toggleComplete}
              onRename={renameProject}
            />
          ))}
        </div>
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
      {addTaskOpen && (
        <AddTaskModal
          projects={projects}
          defaultProjectId={addTaskFor ?? undefined}
          onClose={() => setAddTaskOpen(false)}
          onCreated={upsertTask}
        />
      )}
      {addProjectOpen && (
        <AddProjectModal
          onClose={() => setAddProjectOpen(false)}
          onCreated={(p) => {
            setProjects((prev) => [...prev, p]);
            setSections((prev) => [...prev, { project: p, statuses: DEFAULT_COLUMNS, tasks: [] }]);
          }}
        />
      )}
    </div>
  );
}

function mergeTask(tasks: TaskView[], task: TaskView): TaskView[] {
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx === -1) return [task, ...tasks];
  const next = [...tasks];
  next[idx] = task;
  return next;
}
