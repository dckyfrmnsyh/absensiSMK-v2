import React, { useEffect } from 'react';
import { Info, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export default function Toast({ toasts, removeToast }: ToastProps) {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-[90%] w-96 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgClass = 'bg-white text-slate-800 border-slate-250';
          let Icon = Info;
          let iconColor = 'text-cyan-600';

          if (toast.type === 'success') {
            bgClass = 'bg-white text-slate-800 border-emerald-200';
            Icon = CheckCircle;
            iconColor = 'text-emerald-600';
          } else if (toast.type === 'warning') {
            bgClass = 'bg-white text-slate-800 border-amber-200';
            Icon = AlertTriangle;
            iconColor = 'text-amber-600';
          } else if (toast.type === 'error') {
            bgClass = 'bg-white text-slate-800 border-red-200';
            Icon = AlertTriangle;
            iconColor = 'text-red-600';
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto border flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl ${bgClass}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
                <span className="text-xs font-bold leading-tight text-slate-850">{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
