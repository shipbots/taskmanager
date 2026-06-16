'use client';

import { useEffect, useRef, useState } from 'react';
import { Tag, Plus, Pencil, Trash2 } from 'lucide-react';
import type { LabelView } from '@/lib/types';

// Toolbar control: filter tasks by label, and manage labels (create / rename /
// recolor / delete). The auto "onboarding" label can be renamed/recolored but
// not deleted.
export function LabelFilter({
  projectId,
  labels,
  onLabelsChange,
  selected,
  onSelect,
}: {
  projectId: string;
  labels: LabelView[];
  onLabelsChange: (labels: LabelView[]) => void;
  selected: string;
  onSelect: (labelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#eab308');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    const res = await fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name, color: newColor }),
    });
    if (res.ok) {
      onLabelsChange([...labels, await res.json()]);
      setNewName('');
    } else alert((await res.json().catch(() => null))?.error ?? 'Could not create label');
  }
  async function rename(id: string) {
    const name = editName.trim();
    setEditingId(null);
    const old = labels.find((l) => l.id === id);
    if (!name || name === old?.name) return;
    const res = await fetch(`/api/labels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const u = await res.json();
      onLabelsChange(labels.map((l) => (l.id === id ? u : l)));
    }
  }
  async function recolor(id: string, color: string) {
    const res = await fetch(`/api/labels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    });
    if (res.ok) {
      const u = await res.json();
      onLabelsChange(labels.map((l) => (l.id === id ? u : l)));
    }
  }
  async function remove(id: string) {
    if (!confirm('Delete this label? It will be removed from its tasks.')) return;
    const res = await fetch(`/api/labels/${id}`, { method: 'DELETE' });
    if (res.ok) {
      onLabelsChange(labels.filter((l) => l.id !== id));
      if (selected === id) onSelect('');
    }
  }

  const selectedLabel = labels.find((l) => l.id === selected);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
      >
        <Tag className="w-4 h-4 text-slate-400" />
        {selectedLabel ? (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedLabel.color }} />
            {selectedLabel.name}
          </span>
        ) : (
          'Filter by label'
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-20 animate-fade-in">
          <button
            onClick={() => {
              onSelect('');
              setOpen(false);
            }}
            className={`w-full text-left text-sm px-2 py-1.5 rounded-lg ${!selected ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            All labels
          </button>
          <div className="my-1 h-px bg-slate-100" />
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {labels.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">No labels yet.</p>}
            {labels.map((l) => (
              <div key={l.id} className="group flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-50">
                <label className="relative cursor-pointer shrink-0" title="Change color">
                  <span className="block w-3.5 h-3.5 rounded-full" style={{ background: l.color }} />
                  <input
                    type="color"
                    defaultValue={l.color}
                    onChange={(e) => recolor(l.id, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
                {editingId === l.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => rename(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(l.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 text-sm border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-[var(--accent)]"
                  />
                ) : (
                  <button
                    onClick={() => {
                      onSelect(l.id);
                      setOpen(false);
                    }}
                    className={`flex-1 text-left text-sm truncate ${selected === l.id ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
                  >
                    {l.name}
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditName(l.name);
                    setEditingId(l.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-slate-600"
                  title="Rename"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {!l.auto && (
                  <button
                    onClick={() => remove(l.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <div className="flex items-center gap-1.5 px-1.5 py-1">
            <label className="relative cursor-pointer shrink-0" title="Pick color">
              <span className="block w-3.5 h-3.5 rounded-full" style={{ background: newColor }} />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="New label…"
              className="flex-1 text-sm border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={create}
              disabled={!newName.trim()}
              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
