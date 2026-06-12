import { useEffect } from 'react';
import { useStore } from '../store';

/** 全局唯一 toast,支持「撤销」;5 秒自动消失 */
export default function Toaster() {
  const { toast, dismissToast } = useStore();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 5000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-900/95 py-2 pl-5 pr-3 text-sm text-white shadow-lg">
        <span>{toast.message}</span>
        {toast.undo && (
          <button
            className="rounded-full px-3 py-1 text-sm font-medium text-indigo-300 transition-colors hover:bg-white/10"
            onClick={() => {
              toast.undo?.();
              dismissToast();
            }}
          >
            撤销
          </button>
        )}
        <button
          className="rounded-full px-2 py-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          onClick={dismissToast}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
