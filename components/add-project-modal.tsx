'use client';

import { useState } from 'react';
import { Modal, Button, inputClass, labelClass } from '@/components/ui';
import type { ProjectView } from '@/lib/types';

const SWATCHES = ['#0ea5e9', '#8b5cf6', '#f97316', '#10b981', '#ef4444', '#eab308', '#ec4899', '#6366f1'];

export function AddProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: ProjectView) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[3]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (res.ok) {
        onCreated(await res.json());
        onClose();
      } else setSaving(false);
    } catch {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New project"
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || saving}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Project name</label>
          <input
            autoFocus
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. Stiefel"
          />
        </div>
        <div>
          <label className={labelClass}>Color</label>
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
