import React from 'react';
import { Briefcase } from 'lucide-react';
import { FormField } from './FormField';
import { LINE, MUTED, TEXT } from '../createTaskConstants';
import type { ProjectMinimal } from '@/types';

interface ProjectSelectorProps {
  selectedProjects: number[];
  setSelectedProjects: (v: number[]) => void;
  projectDropdownOpen: boolean;
  setProjectDropdownOpen: (v: boolean) => void;
  projectSearchInput: string;
  setProjectSearchInput: (v: string) => void;
  projectSearchInputRef: React.RefObject<HTMLInputElement>;
  filteredProjectOptions: ProjectMinimal[];
  allProjectOptions: ProjectMinimal[];
  projectsLoading: boolean;
  fixedProjectId?: number;
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px', borderRadius: 6,
  background: '#eef3ff', color: '#1663f6',
  fontSize: 12, fontWeight: 500,
  border: '1px solid #c7d7fd',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0,
  background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10,
  boxShadow: '0 8px 24px rgba(16,24,40,.1)', maxHeight: 220, overflowY: 'auto',
};

export function ProjectSelector({
  selectedProjects, setSelectedProjects,
  projectDropdownOpen, setProjectDropdownOpen,
  projectSearchInput, setProjectSearchInput,
  projectSearchInputRef, filteredProjectOptions, allProjectOptions,
  projectsLoading, fixedProjectId,
}: ProjectSelectorProps) {
  const triggerStyle: React.CSSProperties = {
    width: '100%', minHeight: 38, padding: '4px 10px',
    border: `1px solid ${LINE}`, borderRadius: 8,
    background: fixedProjectId ? '#f9fafb' : '#fff',
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
    cursor: fixedProjectId ? 'not-allowed' : 'pointer',
    transition: 'border-color .15s',
  };

  return (
    <div style={{ position: 'relative' }} data-dropdown="project">
      <FormField label="Project" icon={<Briefcase size={13} />} required>
        <div
          style={triggerStyle}
          onClick={() => {
            if (fixedProjectId) return;
            setProjectDropdownOpen(true);
            setTimeout(() => projectSearchInputRef.current?.focus(), 0);
          }}
        >
          {projectsLoading ? (
            <span style={{ fontSize: 13, color: MUTED, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, border: '2px solid #1663f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Loading…
            </span>
          ) : selectedProjects.length === 0 ? (
            !projectDropdownOpen ? (
              <span style={{ fontSize: 13, color: MUTED }}>Select project</span>
            ) : (
              <input
                ref={projectSearchInputRef}
                value={projectSearchInput}
                onChange={e => setProjectSearchInput(e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="Search project…"
                style={{ border: 'none', outline: 'none', fontSize: 13, color: TEXT, background: 'transparent', flex: 1, minWidth: 120 }}
              />
            )
          ) : (
            <>
              {selectedProjects.map(id => {
                const project = allProjectOptions.find(p => p.id === id);
                if (!project) return null;
                return (
                  <span key={id} style={chipStyle}>
                    {project.name}
                    {!fixedProjectId && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setSelectedProjects([]); setProjectSearchInput(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 14 }}
                      >×</button>
                    )}
                  </span>
                );
              })}
              {!fixedProjectId && projectDropdownOpen && (
                <input
                  ref={projectSearchInputRef}
                  value={projectSearchInput}
                  onChange={e => setProjectSearchInput(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="Search…"
                  style={{ border: 'none', outline: 'none', fontSize: 13, color: TEXT, background: 'transparent', flex: 1, minWidth: 100 }}
                />
              )}
            </>
          )}
        </div>
      </FormField>

      {projectDropdownOpen && !fixedProjectId && (
        <div style={dropdownStyle}>
          {filteredProjectOptions.length > 0 ? (
            filteredProjectOptions.map(p => (
              <div
                key={p.id}
                style={{ padding: '9px 14px', fontSize: 13, color: TEXT, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f7f8fb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { setSelectedProjects([p.id]); setProjectDropdownOpen(false); setProjectSearchInput(''); }}
              >
                {p.name}
              </div>
            ))
          ) : (
            <div style={{ padding: '10px 14px', fontSize: 13, color: MUTED, textAlign: 'center' }}>No projects found</div>
          )}
        </div>
      )}
    </div>
  );
}