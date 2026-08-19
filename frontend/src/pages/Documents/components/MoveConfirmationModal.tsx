import { Move } from 'lucide-react';
import { Card, CardContent } from '@/components/common';

interface MoveConfirmationModalProps {
  isOpen:        boolean;
  onClose:       () => void;
  onConfirm:     () => void;
  documentCount: number;
  targetName:    string;
  isMoving:      boolean;
}

export function MoveConfirmationModal({ isOpen, onClose, onConfirm, documentCount, targetName, isMoving }: MoveConfirmationModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={onClose} />
      <Card className="relative w-full max-w-[450px] shadow-2xl animate-in fade-in zoom-in duration-300">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 rounded-full" style={{ background: '#DBEAFE' }}><Move className="h-6 w-6" style={{ color: '#2563EB' }} /></div>
            <div className="space-y-2">
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Move {documentCount} Document{documentCount !== 1 ? 's' : ''}?</h3>
              <p style={{ fontSize: 14, color: '#6b7280' }}>Moving to: <strong style={{ color: '#4169FF' }}>{targetName}</strong></p>
            </div>
            <div className="flex w-full gap-4 pt-4">
              <button className="flex-1 py-2.5 rounded-lg font-semibold" style={{ background: '#fff', color: '#1a1a1a', border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={onClose} disabled={isMoving}>Cancel</button>
              <button className="flex-1 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2"
                style={{ background: isMoving ? '#a5b4fc' : '#4169FF', color: '#fff', border: 'none', cursor: isMoving ? 'not-allowed' : 'pointer' }}
                onClick={onConfirm} disabled={isMoving}>
                {isMoving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Moving...</> : <><Move className="w-4 h-4" />Move</>}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}