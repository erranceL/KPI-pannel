import type { ReactNode } from 'react';

export function Card({ title, extra, children }: { title?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {(title || extra) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-700">{title}</div>
          <div>{extra}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

const BADGE_STYLE: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  violet: 'bg-violet-100 text-violet-700',
};

export function Badge({ color = 'slate', children }: { color?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLE[color] ?? BADGE_STYLE.slate}`}>
      {children}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-12" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} rounded-xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="font-semibold text-slate-800">{title}</div>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </label>
  );
}

// 不带宽度的基础样式;需要自定宽度时用 inputBase 拼接,避免与 w-full 冲突
export const inputBase =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export const inputCls = inputBase + ' w-full';

export const btnPrimary =
  'inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';

export const btnGhost =
  'inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50';

export const btnDanger =
  'inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50';

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{children}</div>
  );
}

export function Info({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">{children}</div>;
}

export function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="month" className={inputBase} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function EmptyHint({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-slate-400">{text}</div>;
}
