'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string };
type Ctx = { toast: (t: Omit<Toast, 'id'>) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error('useToast must be used inside ToastProvider');
  return c;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, ...t }]);
    setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 2500);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 no-print">
        {items.map(t => (
          <div key={t.id}
            className={`px-4 py-2.5 rounded-lg shadow-lift text-sm font-medium border animate-slideUp
              ${t.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                t.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
                'bg-brand-50 text-brand-700 border-brand-100'}`}>
            <div className="flex items-center gap-2">
              <span>
                {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
              </span>
              {t.message}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
