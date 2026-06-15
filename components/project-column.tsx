'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, ChevronRight, ChevronDown } from 'lucide-react';
import type { ProjectView, TaskView } from '@/lib/types';
import { TaskRow } from '@/components/task-row';
import { sortByUrgency } from '@/lib/sort';

export function ProjectColumn({
  project,
  tasks,
  onAddTask,
  onOpenTask,
  onToggleComplete,
  onRename,
}: {
  project: ProjectView;
  tasks: TaskView[];
  onAddTask: () => void;
  onOpenTask: (task: TaskView) => void;
  onToggleComplete: (task: TaskView) => void;
  onRename: (project: ProjectView) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);

  const open = sortByUrgency(tasks.filter((t) => !t.isDone));
  const completed = sortByUrgency(tasks.filter((t) => t.isDone));

  async function saveName() {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) {
      setName(project.name);
      return;
    }
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) onRename(await res.json());
    else setName(project.name);
  }

  return (
    <section className="bg-slate-50/70 rounded-2xl border border-slate-100 p-3 flex flex-col">
      <div className="flex items-center gap-2 px-1 mb-2.5">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: project.color }} />
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') {
                setName(project.name);
                setEditing(false);
              }
            }}
            className="font-semibold text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-sm min-w-0 flex-1 focus:outline-none focus:border-[var(--accent)]"
          />
        ) : (
          <Link
            href={`/p/${project.slug}`}
            className="font-semibold text-slate-900 hover:underline truncate"
          >
            {project.name}
          </Link>
        )}
        <span className="text-xs text-slate-400 shrink-0">{open.length}</span>
        {!editing && (
          <button
            onClick={() => {
              setName(project.name);
              setEditing(true);
            }}
            className="p-1 rounded hover:bg-slate-200 text-slate-300 hover:text-slate-600 shrink-0"
            title="Rename project"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onAddTask}
          className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 shrink-0"
          title={`Add task to ${project.name}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5 flex-1">
        {open.length === 0 ? (
          <p className="px-2 py-3 text-sm text-slate-400">All clear 🎉</p>
        ) : (
          open.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              compact
              onClick={() => onOpenTask(task)}
              onToggleComplete={() => onToggleComplete(task)}
            />
          ))
        )}
      </div>

      {completed.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
          <button
            onClick={() => setShowCompleted((s) => !s)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-1"
          >
            {showCompleted ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            {completed.length} completed
          </button>
          {showCompleted && (
            <div className="space-y-1.5 mt-1.5">
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  compact
                  onClick={() => onOpenTask(task)}
                  onToggleComplete={() => onToggleComplete(task)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
