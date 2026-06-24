import React from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  isOpen:   boolean;
  type:     'success' | 'error';
  message:  string;
  onClose:  () => void;
}

export function Toast({ isOpen, type, message, onClose }: ToastProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 rounded-lg shadow-2xl" style={{ padding: '16px 20px', background: '#fff', border: `1px solid ${type === 'success' ? '#10B981' : '#EF4444'}`, minWidth: 320, maxWidth: 500 }}>
        <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, background: type === 'success' ? '#D1FAE5' : '#FEE2E2' }}>
          {type === 'success'
            ? <svg className="w-5 h-5" fill="none" stroke="#10B981" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            : <X className="w-5 h-5" style={{ color: '#EF4444' }} />
          }
        </div>
        <p className="flex-1" style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{message}</p>
        <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}