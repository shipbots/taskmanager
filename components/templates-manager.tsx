'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, ListChecks, GripVertical } from 'lucide-react';
import { Modal, Button, inputClass, labelClass } from '@/components/ui';
import type { ProjectView, TemplateView } from '@/lib/types';

interface EditItem {
  name: string;
  offsetDays: string;
}

export function TemplatesManager({
  initialTemplates,
  projects,
}: {
  initialTemplates: TemplateView[];
  projects: ProjectView[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<TemplateView | 'new' | null>(null);

  const projectName = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? 'Project') : 'All projects';

  function onSaved(tpl: TemplateView) {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === tpl.id);
      if (idx === -1) return [...prev, tpl];
      const next = [...prev];
      next[idx] = tpl;
      return next;
    });
  }

  async function remove(id: string) {
    if (!confirm('Delete this template?')) return;
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
        <Button className="ml-auto" onClick={() => setEditing('new')}>
          <span className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New template
          </span>
        </Button>
      </div>
      <p className="text-sm text-slate-400 mb-5">
        Reusable subtask checklists. Pick one when creating a task to auto-generate its steps.
      </p>

      {templates.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No templates yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-800">{t.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {projectName(t.projectId)} · {t.items.length} subtask
                  {t.items.length === 1 ? '' : 's'}
                </div>
              </div>
              <button
                onClick={() => setEditing(t)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(t.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            onSaved(t);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  projects,
  onClose,
  onSaved,
}: {
  template: TemplateView | null;
  projects: ProjectView[];
  onClose: () => void;
  onSaved: (t: TemplateView) => void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [projectId, setProjectId] = useState(template?.projectId ?? '');
  const [items, setItems] = useState<EditItem[]>(
    template?.items.map((i) => ({ name: i.name, offsetDays: i.offsetDays?.toString() ?? '' })) ?? [
      { name: '', offsetDays: '' },
    ],
  );
  const [saving, setSaving] = useState(false);

  function setItem(i: number, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { name: '', offsetDays: '' }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      projectId: projectId || null,
      items: items
        .filter((it) => it.name.trim())
        .map((it) => ({ name: it.name.trim(), offsetDays: it.offsetDays === '' ? null : Number(it.offsetDays) })),
    };
    const res = await fetch(template ? `/api/templates/${template.id}` : '/api/templates', {
      method: template ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) onSaved(await res.json());
    else setSaving(false);
  }

  return (
    <Modal
      title={template ? 'Edit template' : 'New template'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : 'Save template'}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Template name</label>
            <input
              autoFocus
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New client onboarding"
            />
          </div>
          <div>
            <label className={labelClass}>Available in</label>
            <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelClass + ' mb-0'}>Subtasks</label>
            <span className="text-[11px] text-slate-400">Days = due offset from task creation</span>
          </div>
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                <input
                  className={inputClass}
                  value={it.name}
                  onChange={(e) => setItem(i, { name: e.target.value })}
                  placeholder={`Step ${i + 1}`}
                />
                <input
                  type="number"
                  className="w-20 px-2 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[var(--accent)]"
                  value={it.offsetDays}
                  onChange={(e) => setItem(i, { offsetDays: e.target.value })}
                  placeholder="days"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addItem}
            className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <Plus className="w-4 h-4" /> Add subtask
          </button>
        </div>
      </div>
    </Modal>
  );
}
