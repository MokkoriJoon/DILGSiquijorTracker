import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X, AlertOctagon } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error': return <AlertOctagon className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-l-emerald-500';
      case 'error': return 'border-l-red-500';
      case 'warning': return 'border-l-amber-500';
      default: return 'border-l-blue-500';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`bg-white rounded-lg shadow-lg border border-slate-200 border-l-4 ${getBorderColor(toast.type)} p-4 animate-slide-in flex items-start gap-3`}
        >
          <div className="flex-shrink-0">{getIcon(toast.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{toast.title}</p>
            {toast.message && (
              <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
