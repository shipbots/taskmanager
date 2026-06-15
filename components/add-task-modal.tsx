'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal, Button, inputClass, labelClass } from '@/components/ui';
import { PRIORITY_ORDER, PRIORITY_META } from '@/lib/types';
import type { ProjectView, TaskView, TemplateView, Priority } from '@/lib/types';
import { todayYMD } from '@/lib/dates';

function tomorrowYMD(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return todayYMD(t);
}

export function AddTaskModal({
  projects,
  defaultProjectId,
  onClose,
  onCreated,
}: {
  projects: ProjectView[];
  defaultProjectId?: string;
  onClose: () => void;
  onCreated: (task: TaskView) => void;
}) {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || projects[0]?.id || '');
  const [client, setClient] = useState('');
  const [dueDate, setDueDate] = useState(tomorrowYMD); // default: next day
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<TemplateView[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setTemplates(data))
      .catch(() => {});
  }, []);

  // Saved clients for the selected project (autocomplete suggestions).
  useEffect(() => {
    if (!projectId) {
      setClients([]);
      return;
    }
    fetch(`/api/clients?projectId=${projectId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setClients(d.map((c: { name: string }) => c.name)))
      .catch(() => {});
  }, [projectId]);

  const availableTemplates = templates.filter(
    (t) => t.projectId === null || t.projectId === projectId,
  );

  async function submit() {
    if (!name.trim() || !projectId || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          projectId,
          client: client.trim() || null,
          dueDate: dueDate || null,
          priority,
          description: description.trim() || null,
          templateId: templateId || null,
        }),
      });
      if (res.ok) {
        const task = await res.json();
        onCreated(task);
        onClose();
      } else {
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  }

  async function draft() {
    if (!notes.trim() || drafting) return;
    setDrafting(true);
    try {
      const res = await fetch('/api/tasks/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.name) setName(d.name);
        if (d.client) setClient(d.client);
        if (d.dueDate) setDueDate(d.dueDate);
        if (d.priority && (PRIORITY_ORDER as string[]).includes(d.priority)) setPriority(d.priority);
        if (d.description) setDescription(d.description);
      } else {
        const b = await res.json().catch(() => null);
        alert(b?.error ?? 'Could not draft a task from those notes');
      }
    } catch {
      alert('Could not draft a task from those notes');
    } finally {
      setDrafting(false);
    }
  }

  return (
    <Modal
      title="New task"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !projectId || saving}>
            {saving ? 'Creating…' : 'Create task'}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 p-2.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Smart notes — describe the task, I will fill the form
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="e.g. Call Acme about the renewal next Tuesday, high priority"
          />
          <div className="flex justify-end mt-1.5">
            <button
              type="button"
              onClick={draft}
              disabled={!notes.trim() || drafting}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" /> {drafting ? 'Thinking…' : 'Fill from notes'}
            </button>
          </div>
        </div>

        <div>
          <label className={labelClass}>Task name</label>
          <input
            autoFocus
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="What needs to be done?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Project</label>
            <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <select
              className={inputClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Client</label>
            <input
              className={inputClass}
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Optional"
              list="addtask-clients"
            />
            <datalist id="addtask-clients">
              {clients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Due date</label>
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Template (auto-creates subtasks)</label>
          <select
            className={inputClass}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">No template</option>
            {availableTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.items.length} subtasks)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details…"
          />
        </div>
      </div>
    </Modal>
  );
}
