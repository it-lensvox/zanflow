import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/common';

interface ConfirmationModalProps {
  isOpen:     boolean;
  onClose:    () => void;
  onConfirm:  () => void;
  title:      string;
}

export function ConfirmationModal({ isOpen, onClose, onConfirm, title }: ConfirmationModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={onClose} />
      <Card className="relative w-full max-w-[400px] shadow-2xl animate-in fade-in zoom-in duration-300">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 rounded-full" style={{ background: '#FEE2E2' }}><FileText className="h-6 w-6" style={{ color: '#EF4444' }} /></div>
            <div className="space-y-2">
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Confirm Deletion</h3>
              <p style={{ fontSize: 14, color: '#6b7280' }}>{title}</p>
            </div>
            <div className="flex w-full gap-4 pt-4">
              <button className="flex-1 py-2.5 rounded-lg font-semibold" style={{ background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer' }} onClick={onConfirm}>Yes</button>
              <button className="flex-1 py-2.5 rounded-lg font-semibold" style={{ background: '#fff', color: '#1a1a1a', border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={onClose}>No</button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}