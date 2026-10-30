import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  toasts: Toast[];
  show(tone: ToastTone, title: string, description?: string): void;
  dismiss(id: number): void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DURATIONS: Record<ToastTone, number> = { success: 3500, info: 4000, warning: 6000, error: 7000 };
const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const show = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-(MAX_TOASTS - 1)), { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), DURATIONS[tone]);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToasts must be used inside <ToastProvider>.');
  return context;
}
