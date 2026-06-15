'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TaskView } from '@/lib/types';
import { statusPillStyle } from '@/lib/types';
import { toYMD, todayYMD } from '@/lib/dates';

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

type Mode = 'month' | '3day' | 'day';

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function shortDate(d: Date): string {
  return `${MONTHS_FULL[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function CalendarView({
  tasks,
  onSelect,
}: {
  tasks: TaskView[];
  onSelect: (task: TaskView) => void;
}) {
  const now = new Date();
  const today = todayYMD(now);
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());

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

  function dayTasks(date: Date): TaskView[] {
    return (byDay.get(todayYMD(date)) ?? [])
      .slice()
      .sort((a, b) => Number(a.isDone) - Number(b.isDone) || a.name.localeCompare(b.name));
  }

  const monthCells = useMemo(() => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const days3 = [anchor, addDays(anchor, 1), addDays(anchor, 2)];

  function shift(delta: number) {
    if (mode === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
    else if (mode === '3day') setAnchor(addDays(anchor, delta * 3));
    else setAnchor(addDays(anchor, delta));
  }

  const title =
    mode === 'month'
      ? `${MONTHS_FULL[anchor.getMonth()]} ${anchor.getFullYear()}`
      : mode === '3day'
        ? `${shortDate(days3[0])} – ${shortDate(days3[2])}`
        : todayYMD(anchor) === today
          ? `Today · ${shortDate(anchor)}`
          : `${WEEKDAYS_FULL[anchor.getDay()]}, ${shortDate(anchor)}`;

  const modeBtn = (m: Mode, label: string) => (
    <button
      onClick={() => setMode(m)}
      className={`px-2.5 py-1 rounded-md text-sm font-medium ${mode === m ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          {modeBtn('month', 'Month')}
          {modeBtn('3day', '3 Days')}
          {modeBtn('day', 'Day')}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setAnchor(new Date())}
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

      {mode === 'month' && (
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 pb-1">
              {d}
            </div>
          ))}
          {monthCells.map((d, i) => {
            const ymd = todayYMD(d);
            const inMonth = d.getMonth() === anchor.getMonth();
            const list = byDay.get(ymd) ?? [];
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
                  {list.slice(0, 3).map((t) => (
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
                  {list.length > 3 && (
                    <div className="text-[10px] text-slate-400 pl-1.5">+{list.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode !== 'month' && (
        <div className={`grid gap-3 ${mode === '3day' ? 'sm:grid-cols-3' : 'grid-cols-1'}`}>
          {(mode === '3day' ? days3 : [anchor]).map((d, i) => (
            <DayPanel key={i} date={d} tasks={dayTasks(d)} today={today} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayPanel({
  date,
  tasks,
  today,
  onSelect,
}: {
  date: Date;
  tasks: TaskView[];
  today: string;
  onSelect: (task: TaskView) => void;
}) {
  const isToday = todayYMD(date) === today;
  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden">
      <div
        className={`px-3 py-2 border-b border-slate-100 flex items-center gap-2 ${isToday ? 'bg-[var(--accent)]/10' : 'bg-slate-50'}`}
      >
        <span className="text-xs font-medium text-slate-400">{WEEKDAYS[date.getDay()]}</span>
        <span
          className={`text-sm font-semibold ${isToday ? 'text-[var(--accent)]' : 'text-slate-800'}`}
        >
          {shortDate(date)}
        </span>
        {isToday && <span className="text-[10px] text-[var(--accent)] font-medium">Today</span>}
        <span className="ml-auto text-xs text-slate-400">{tasks.length}</span>
      </div>
      <div className="p-2 space-y-1.5 min-h-[120px] max-h-[60vh] overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-300 px-1 py-2">Nothing due</p>
        ) : (
          tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="w-full text-left px-2 py-1.5 rounded-lg border border-slate-100 hover:border-slate-300 hover:shadow-sm transition flex items-center gap-2"
              style={{ borderLeft: `3px solid ${t.projectColor ?? '#94a3b8'}` }}
            >
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm truncate ${t.isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}
                >
                  {t.name}
                </div>
                {t.client && <div className="text-xs text-slate-400 truncate">{t.client}</div>}
              </div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                style={statusPillStyle(t.statusColor)}
              >
                {t.status}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
