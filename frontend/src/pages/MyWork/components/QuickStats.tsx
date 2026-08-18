import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { BLUE, GREEN, YELLOW, RED, MUTED, INK, card, isOverdue } from '../myWorkConstants';

export function QuickStats({ myTasks }: { myTasks: any[] }) {
  const stats = [
    { label: 'In Progress', value: myTasks.filter((t: any) => t.status === 'in_progress').length, color: BLUE, icon: <Clock size={16} color={BLUE} /> },
    { label: 'Pending', value: myTasks.filter((t: any) => t.status === 'pending' || t.status === 'backlog').length, color: YELLOW, icon: <Clock size={16} color={YELLOW} /> },
    { label: 'Completed', value: myTasks.filter((t: any) => t.status === 'completed' || t.status === 'deployed').length, color: GREEN, icon: <CheckCircle size={16} color={GREEN} /> },
    { label: 'Overdue', value: myTasks.filter((t: any) => isOverdue(t)).length, color: RED, icon: <AlertCircle size={16} color={RED} /> },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ marginTop: 20 }}>
      {stats.map((s, i) => (
        <div key={i} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {s.icon}
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}