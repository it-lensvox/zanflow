import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useMyWork } from './hooks/useMyWork';
import { FocusBlock } from './components/FocusBlock';
import { TodaysSchedule } from './components/TodaysSchedule';
import { AssignedToMe } from './components/AssignedToMe';
import { QuickStats } from './components/QuickStats';
import { RescheduleModal } from './components/RescheduleModal';
import { BLUE, INK, MUTED } from './myWorkConstants';

export function MyWork() {
  const navigate = useNavigate();
  const {
    today,
    myTasks,
    activeTask,
    focusProgress,
    scheduleItems,
    assignedToMe,
    isLoading,
    rescheduleEvent,
    setRescheduleEvent,
    rescheduleMutation,
  } = useMyWork();

 return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'hsl(var(--background))' }}>

      {/* ── Header ── */}
     <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40" style={{ position: 'sticky', top: 0, zIndex: 26, flexShrink: 0, background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))', paddingTop: 16, paddingBottom: 16 }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: INK, letterSpacing: '-.03em' }}>My Work</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          {!activeTask && (
            <button
              onClick={() => navigate('/taskboard')}
              style={{ height: 40, background: BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '0 18px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Plus size={15} /> Add focus block
            </button>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6 pb-8">

      {/* ── Focus Block ── */}
      {activeTask && <FocusBlock activeTask={activeTask} focusProgress={focusProgress} />}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TodaysSchedule
          scheduleItems={scheduleItems}
          isLoading={isLoading}
          onReschedule={setRescheduleEvent}
        />
        <AssignedToMe assignedToMe={assignedToMe} isLoading={isLoading} />
      </div>

      {/* ── Quick Stats ── */}
      <QuickStats myTasks={myTasks} />

      {/* ── Reschedule Modal ── */}
      {rescheduleEvent && (
        <RescheduleModal
          event={rescheduleEvent}
          onClose={() => setRescheduleEvent(null)}
          onSave={(id, start_time, end_time) => rescheduleMutation.mutate({ id, start_time, end_time })}
        />
      )}
      </div>
    </div>
  );
}

export default MyWork;