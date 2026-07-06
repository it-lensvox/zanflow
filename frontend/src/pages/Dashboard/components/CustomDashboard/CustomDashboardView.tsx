import { useState, useRef } from 'react';
import { Plus, Pencil, Check, X, Settings2 } from 'lucide-react';
import { WidgetRenderer } from './WidgetRenderer';
import { WidgetPicker } from './WidgetPicker';
import { BLUE, LINE, TEXT, MUTED, BG } from '../../index';
import type { CustomDashboard, WidgetConfig, WidgetType, WidgetSize } from '@/types';

// Size → CSS column span (12-col grid)
const SIZE_COLS: Record<WidgetSize, string> = {
  sm: 'col-span-12 sm:col-span-6 lg:col-span-3',
  md: 'col-span-12 sm:col-span-6 lg:col-span-6',
  lg: 'col-span-12',   
};

interface Props {
  dashboard: CustomDashboard;
  db: any;
  onAddWidget: (type: WidgetType, size: WidgetSize) => void;
  onRemoveWidget: (widgetId: string) => void;
  onReorderWidgets: (widgets: WidgetConfig[]) => void;
  onResizeWidget: (widgetId: string, size: WidgetSize) => void;
  onRename: (name: string) => void;
}

export function CustomDashboardView({
  dashboard, db,
  onAddWidget, onRemoveWidget, onReorderWidgets, onResizeWidget, onRename,
}: Props) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(dashboard.name);
  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const existingTypes = dashboard.widgets.map(w => w.type);
  const widgets = [...dashboard.widgets].sort((a, b) => a.order - b.order);

  // ── Drag handlers 
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const reordered = [...widgets];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onReorderWidgets(reordered.map((w, i) => ({ ...w, order: i })));
    setDragIndex(null); setDragOverIndex(null);
  };

  const handleRenameCommit = () => {
    if (renameVal.trim()) onRename(renameVal.trim());
    else setRenameVal(dashboard.name);
    setIsRenaming(false);
  };

  const handleEnterEditMode = () => {
    setIsEditMode(true);
    setRenameVal(dashboard.name);
  };

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setShowPicker(false);
    setIsRenaming(false);
  };

  return (
    <div style={{ width: '100%', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>
      {/* ── Edit mode toolbar */}
      {isEditMode && (
        <div style={{
          background: '#EEF4FF', borderBottom: `1px solid #C7D7FD`,
          padding: '8px 20px', display: 'flex', alignItems: 'center',
          gap: 10, flexWrap: 'wrap',
        }}>
          {/* Dashboard name  */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            {isRenaming ? (
              <>
                <input
                  ref={renameRef}
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameCommit();
                    if (e.key === 'Escape') { setRenameVal(dashboard.name); setIsRenaming(false); }
                  }}
                  autoFocus
                  maxLength={60}
                  style={{
                    height: 30, padding: '0 10px', borderRadius: 7,
                    border: `1.5px solid ${BLUE}`, fontSize: 13,
                    fontWeight: 600, color: TEXT, outline: 'none',
                    fontFamily: 'inherit', minWidth: 160,
                  }}
                />
                <button onClick={handleRenameCommit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BLUE, display: 'flex' }}><Check size={14} /></button>
                <button onClick={() => { setRenameVal(dashboard.name); setIsRenaming(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={14} /></button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1663F6' }}>{dashboard.name}</span>
                <button onClick={() => setIsRenaming(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex', padding: 2 }}><Pencil size={12} /></button>
              </>
            )}
          </div>

          <span style={{ fontSize: 12, color: '#4A6FA5', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Settings2 size={12} /> Drag widgets to rearrange
          </span>

          {/* Add widget button */}
          <button
            onClick={() => setShowPicker(true)}
            style={{
              height: 30, padding: '0 12px', borderRadius: 7,
              border: `1px solid ${BLUE}`, background: '#fff',
              fontSize: 12, fontWeight: 600, color: BLUE,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
            }}
          >
            <Plus size={13} /> Add widget
          </button>

          {/* Done editing */}
          <button
            onClick={handleExitEditMode}
            style={{
              height: 30, padding: '0 14px', borderRadius: 7,
              border: 'none', background: BLUE,
              fontSize: 12, fontWeight: 600, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* ── Dashboard header row */}
      <div
        className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
        style={{ paddingTop: 20, paddingBottom: 20, borderBottom: `1px solid ${LINE}`, background: BG }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>
              {dashboard.name}
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>
              {widgets.length} widget{widgets.length !== 1 ? 's' : ''} · Custom dashboard
            </div>
          </div>
          {/* Customise button  */}
          {!isEditMode && (
            <button
              onClick={handleEnterEditMode}
              style={{
                height: 34, padding: '0 14px', borderRadius: 8,
                border: `1px solid ${LINE}`, background: '#fff',
                fontSize: 13, fontWeight: 600, color: TEXT,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              <Settings2 size={14} color={MUTED} /> Customise
            </button>
          )}
        </div>
      </div>

      {/* ── Widget grid */}
      <div
        className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6"
        style={{ paddingBottom: 24 }}
      >
        {widgets.length === 0 ? (
          /* Empty state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 80, paddingBottom: 80, gap: 12,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: '#EEF4FF', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={24} color={BLUE} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>No widgets yet</div>
            <div style={{ fontSize: 14, color: MUTED }}>Add your first widget to get started</div>
            <button
              onClick={() => { handleEnterEditMode(); setShowPicker(true); }}
              style={{
                marginTop: 4, height: 36, padding: '0 20px', borderRadius: 8,
                border: 'none', background: BLUE,
                fontSize: 13, fontWeight: 600, color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Add widgets
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {widgets.map((widget, index) => (
              <div
                key={widget.id}
                className={SIZE_COLS[widget.size]}
                draggable={isEditMode}
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={e => handleDrop(e, index)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                style={{
                  outline: isEditMode && dragOverIndex === index && dragIndex !== index
                    ? `2px dashed ${BLUE}` : 'none',
                  borderRadius: 12,
                  transition: 'outline 0.1s',
                }}
              >
                <WidgetRenderer
                  widget={widget}
                  isEditMode={isEditMode}
                  isDragging={dragIndex === index}
                  db={db}
                  onRemove={onRemoveWidget}
                  onResize={onResizeWidget}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Widget picker panel */}
      {showPicker && (
        <WidgetPicker
          existingTypes={existingTypes}
          onAdd={(type, size) => { onAddWidget(type, size); }}
          onRemove={(type) => {
            const widget = dashboard.widgets.find(w => w.type === type);
            if (widget) onRemoveWidget(widget.id);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}