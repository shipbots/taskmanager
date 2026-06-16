'use client';

import type { TaskView } from '@/lib/types';
import { PRIORITY_META } from '@/lib/types';
import { classifyUrgency, formatDueDate, urgencyTextClass } from '@/lib/dates';
import { importanceAccent } from '@/lib/sort';
import { Paperclip, ListChecks, Check } from 'lucide-react';

export function TaskCard({
  task,
  onToggleComplete,
}: {
  task: TaskView;
  onToggleComplete?: () => void;
}) {
  const urgency = classifyUrgency(task.dueDate);
  const due = formatDueDate(task.dueDate);
  const completed = task.isDone;

  return (
    <div
      className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5 hover:border-slate-300 transition"
      style={{ borderLeft: `3px solid ${importanceAccent(task)}` }}
    >
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {task.labels.map((l) => (
            <span
              key={l.id}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: l.color }}
              title={l.name}
            />
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        {onToggleComplete && !task.readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title={completed ? 'Mark as not done' : 'Mark complete'}
            className={`mt-0.5 w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${completed ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-500 hover:bg-green-50'}`}
          >
            {completed && <Check className="w-3 h-3 text-white" />}
          </button>
        )}
        <span
          className={`text-sm font-medium leading-snug ${completed ? 'line-through text-slate-400' : 'text-slate-800'}`}
        >
          {task.name}
        </span>
      </div>

      {task.client && <div className="mt-1 text-xs text-slate-400 truncate">{task.client}</div>}

      <div className="flex items-center gap-2 mt-2">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_META[task.priority].dot}`}
          title={`${PRIORITY_META[task.priority].label} priority`}
        />
        {due && <span className={`text-xs font-medium ${urgencyTextClass(urgency)}`}>{due}</span>}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          {task.subtaskCount > 0 && (
            <span className="flex items-center gap-0.5">
              <ListChecks className="w-3 h-3" />
              {task.doneSubtaskCount}/{task.subtaskCount}
            </span>
          )}
          {task.attachments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="w-3 h-3" />
              {task.attachments.length}
            </span>
          )}
          {task.source === 'shipbots' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600">SB</span>
          )}
        </div>
      </div>
    </div>
  );
}
