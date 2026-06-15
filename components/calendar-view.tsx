'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TaskView } from '@/lib/types';
import { toYMD, todayYMD } from '@/lib/dates';

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView({
  tasks,
  onSelect,
}: {
  tasks: TaskView[];
  onSelect: (task: TaskView) => void;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const today = todayYMD(now);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const t of tasks) {
      const ymd = toYMD(t.dueDate);
      if (!ymd) continue;
      const arr = map.get(ymd) ?? [];
      arr.push(t);
      map.set(ymd, arr);
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => {
    const start = new Date(cursor.y, cursor.m, 1);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  function shift(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {MONTHS_FULL[cursor.m]} {cursor.y}
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}
            className="px-2.5 py-1 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 pb-1">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const ymd = todayYMD(d);
          const inMonth = d.getMonth() === cursor.m;
          const dayTasks = byDay.get(ymd) ?? [];
          const isToday = ymd === today;
          return (
            <div
              key={i}
              className={`min-h-[92px] rounded-lg border p-1.5 ${inMonth ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-transparent'}`}
            >
              <div
                className={`text-xs mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[var(--accent)] text-white font-semibold' : inMonth ? 'text-slate-500' : 'text-slate-300'}`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t)}
                    className={`w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded truncate ${t.isDone ? 'line-through opacity-50' : ''}`}
                    style={{ background: `${t.projectColor ?? '#64748b'}1a`, color: t.projectColor ?? '#475569' }}
                    title={`${t.name}${t.client ? ` · ${t.client}` : ''}`}
                  >
                    {t.name}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-slate-400 pl-1.5">+{dayTasks.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
