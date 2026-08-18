import { useNavigate } from 'react-router-dom';
import { BLUE, formatDate } from '../myWorkConstants';

export function FocusBlock({ activeTask, focusProgress }: { activeTask: any; focusProgress: number }) {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'linear-gradient(135deg, #1a2340 0%, #1e2d4f 100%)', borderRadius: 14, padding: '22px 28px', marginBottom: 24, color: '#fff' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8DA8D8', letterSpacing: '.08em', marginBottom: 6 }}>FOCUS BLOCK · IN PROGRESS</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{activeTask.heading}</div>
      <div style={{ fontSize: 13, color: '#8DA8D8', marginBottom: 18 }}>
        {activeTask.end_date ? `Due ${formatDate(activeTask.end_date)}` : 'No due date'}
        {activeTask.project_details?.name ? ` · ${activeTask.project_details.name}` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.15)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${focusProgress}%`, height: '100%', background: BLUE, borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8DA8D8', whiteSpace: 'nowrap' }}>{focusProgress}% complete</span>
        <button onClick={() => navigate('/taskboard')} style={{ height: 36, padding: '0 18px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Resume</button>
        <button style={{ height: 36, padding: '0 18px', background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Pause</button>
      </div>
    </div>
  );
}