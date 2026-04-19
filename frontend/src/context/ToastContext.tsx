import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type ShowToast = (message: string, type?: ToastType) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const DURATION: Record<ToastType, number> = {
  success: 4000,
  error: 6500,
  warning: 5000,
  info: 4000,
};

const STYLES: Record<ToastType, { border: string; icon: string; iconBg: string; label: string }> = {
  success: { border: 'border-l-emerald-500', icon: '✓', iconBg: 'bg-emerald-100 text-emerald-700', label: 'Éxito' },
  error:   { border: 'border-l-red-500',     icon: '✕', iconBg: 'bg-red-100 text-red-700',       label: 'Error' },
  warning: { border: 'border-l-amber-400',   icon: '⚠', iconBg: 'bg-amber-100 text-amber-700',   label: 'Aviso' },
  info:    { border: 'border-l-blue-500',    icon: 'ℹ', iconBg: 'bg-blue-100 text-blue-700',     label: 'Info'  },
};

function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const s = STYLES[toast.type];
  return (
    <div className={`flex items-start gap-3 p-4 pr-3 bg-white rounded-xl shadow-xl border border-slate-100 border-l-4 ${s.border} w-[340px] max-w-[calc(100vw-3rem)]`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${s.iconBg}`}>
        {s.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">{s.label}</p>
        <p className="text-sm text-slate-700 font-medium leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 p-1 -mr-1 rounded"
        aria-label="Cerrar"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback<ShowToast>((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-2), { id, message, type }]);
    timers.current[id] = setTimeout(() => remove(id), DURATION[type]);
  }, [remove]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
