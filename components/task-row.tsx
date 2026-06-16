'use client';

import type { TaskView } from '@/lib/types';
import { PRIORITY_META, statusPillStyle } from '@/lib/types';
import { classifyUrgency, formatDueDate, urgencyTextClass } from '@/lib/dates';
import { importanceAccent } from '@/lib/sort';
import { Paperclip, Check } from 'lucide-react';

export function TaskRow({
  task,
  onClick,
  onToggleComplete,
  compact = false,
}: {
  task: TaskView;
  onClick: () => void;
  onToggleComplete?: () => void;
  compact?: boolean;
}) {
  const urgency = classifyUrgency(task.dueDate);
  const due = formatDueDate(task.dueDate);
  const completed = task.isDone;
  const canComplete = !!onToggleComplete && !task.readOnly;

  return (
    <div
      className="group flex items-center gap-2.5 px-2.5 py-2 bg-white rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-sm transition"
      style={{ borderLeft: `3px solid ${importanceAccent(task)}` }}
    >
      {canComplete && (
        <button
          onClick={onToggleComplete}
          title={completed ? 'Mark as not done' : 'Mark complete'}
          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
            completed
              ? 'bg-green-500 border-green-500'
              : 'border-slate-300 hover:border-green-500 hover:bg-green-50'
          }`}
        >
          {completed && <Check className="w-3 h-3 text-white" />}
        </button>
      )}

      <button onClick={onClick} className="min-w-0 flex-1 flex items-center gap-2.5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium truncate ${completed ? 'line-through text-slate-400' : 'text-slate-800'}`}
            >
              {task.name}
            </span>
            {task.source === 'shipbots' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 shrink-0">
                ShipBots
              </span>
            )}
          </div>
          {(task.client || task.subtaskCount > 0 || task.attachments.length > 0) && (
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              {task.client && <span className="truncate">{task.client}</span>}
              {task.subtaskCount > 0 && (
                <span className="shrink-0">
                  · {task.doneSubtaskCount}/{task.subtaskCount}
                </span>
              )}
              {task.attachments.length > 0 && (
                <span className="flex items-center gap-0.5 shrink-0">
                  <Paperclip className="w-3 h-3" />
                  {task.attachments.length}
                </span>
              )}
            </div>
          )}
        </div>

        {task.labels.length > 0 && (
          <span className="flex items-center gap-1 shrink-0">
            {task.labels.map((l) => (
              <span
                key={l.id}
                className="w-2 h-2 rounded-full"
                style={{ background: l.color }}
                title={l.name}
              />
            ))}
          </span>
        )}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_META[task.priority].dot}`}
          title={`${PRIORITY_META[task.priority].label} priority`}
        />
        {due && (
          <span className={`text-xs font-medium shrink-0 ${urgencyTextClass(urgency)}`}>{due}</span>
        )}
        {!compact && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium"
            style={statusPillStyle(task.statusColor)}
          >
            {task.status}
          </span>
        )}
      </button>
    </div>
  );
}
