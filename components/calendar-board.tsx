'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ProjectView, TaskView } from '@/lib/types';
import { CalendarView } from '@/components/calendar-view';
import { TaskDrawer } from '@/components/task-drawer';
import { AddTaskModal } from '@/components/add-task-modal';
import { Button } from '@/components/ui';

export function CalendarBoard({
  tasks: initialTasks,
  projects,
}: {
  tasks: TaskView[];
  projects: ProjectView[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState<TaskView | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function upsertTask(task: TaskView) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx === -1) return [task, ...prev];
      const next = [...prev];
      next[idx] = task;
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <span className="text-sm text-slate-400 hidden sm:inline">Everything, by due date</span>
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <span className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New task
          </span>
        </Button>
      </div>

      <CalendarView tasks={tasks} onSelect={(t) => setOpen(t)} />

      {open && (
        <TaskDrawer
          taskId={open.id}
          initialTask={open}
          onUpdated={upsertTask}
          onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
          onClose={() => setOpen(null)}
        />
      )}
      {addOpen && (
        <AddTaskModal projects={projects} onClose={() => setAddOpen(false)} onCreated={upsertTask} />
      )}
    </div>
  );
}
