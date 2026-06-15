'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[8vh] animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        className={`w-full ${width} bg-white rounded-2xl shadow-2xl animate-slide-in-up flex flex-col max-h-[84vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  onClose,
  children,
  width = 'max-w-xl',
}: {
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 animate-fade-in" onMouseDown={onClose}>
      <div
        className={`w-full ${width} bg-white h-full shadow-2xl animate-slide-in overflow-y-auto`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
}) {
  const styles: Record<string, string> = {
    primary: 'bg-[var(--accent)] text-white hover:opacity-90',
    ghost: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
    subtle: 'text-slate-500 hover:bg-slate-100',
    danger: 'text-red-600 hover:bg-red-50',
  };
  return (
    <button
      {...props}
      className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]';

export const labelClass = 'block text-xs font-medium text-slate-500 mb-1';
