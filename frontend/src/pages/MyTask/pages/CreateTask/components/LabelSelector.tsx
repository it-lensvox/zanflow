import React from 'react';
import { Tag } from 'lucide-react';
import { FormField } from './FormField';
import { LINE, MUTED, TEXT } from '../createTaskConstants';

interface LabelSelectorProps {
  selectedLabelIds: number[];
  setSelectedLabelIds: (v: number[]) => void;
  labelDropdownOpen: boolean;
  setLabelDropdownOpen: (v: boolean) => void;
  projectLabels: any[];
  selectedProjects: number[];
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0,
  background: 'hsl(var(--popover))', border: `1px solid ${LINE}`, borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,.18)', maxHeight: 220, overflowY: 'auto',
};

export function LabelSelector({
  selectedLabelIds, setSelectedLabelIds,
  labelDropdownOpen, setLabelDropdownOpen,
  projectLabels, selectedProjects,
}: LabelSelectorProps) {
  const isDisabled = selectedProjects.length === 0;

  return (
    <div style={{ position: 'relative' }} data-dropdown="label">
      <FormField label="Labels" icon={<Tag size={13} />}>
        <div
          style={{
            width: '100%', minHeight: 38, padding: '4px 10px',
            border: `1px solid ${LINE}`, borderRadius: 8,
            background: isDisabled ? 'hsl(var(--muted))' : 'hsl(var(--input))',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
          }}
          onClick={() => !isDisabled && setLabelDropdownOpen(!labelDropdownOpen)}
        >
          {selectedLabelIds.length === 0 ? (
            <span style={{ fontSize: 13, color: MUTED }}>
              {isDisabled ? 'Select a project first' : 'Select labels'}
            </span>
          ) : (
            selectedLabelIds.map(labelId => {
              const label = projectLabels.find((l: any) => l.id === labelId);
              if (!label) return null;
              return (
                <span
                  key={labelId}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 6,
                    background: label.color, color: '#fff',
                    fontSize: 12, fontWeight: 500,
                  }}
                >
                  {label.name}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setSelectedLabelIds(selectedLabelIds.filter(id => id !== labelId)); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 14, opacity: 0.8 }}
                  >×</button>
                </span>
              );
            })
          )}
        </div>
      </FormField>

      {labelDropdownOpen && (
        <div style={dropdownStyle}>
          {projectLabels.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 13, color: MUTED, textAlign: 'center' }}>
              No labels for this project
            </div>
          ) : (
            <>
              {projectLabels.filter((l: any) => !selectedLabelIds.includes(l.id)).map((label: any) => (
                <div
                  key={label.id}
                  style={{ padding: '9px 14px', fontSize: 13, color: TEXT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setSelectedLabelIds([...selectedLabelIds, label.id])}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: label.color, flexShrink: 0 }} />
                  {label.name}
                </div>
              ))}
              {projectLabels.filter((l: any) => !selectedLabelIds.includes(l.id)).length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: 13, color: MUTED, textAlign: 'center' }}>
                  All labels selected
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}