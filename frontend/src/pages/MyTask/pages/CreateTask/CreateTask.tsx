import React from 'react';
import { Minus, Sparkles, AlertCircle, Type } from 'lucide-react';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { AITask } from '@/pages/MyTask/components/AITask';
import { Modal, ModalHeader } from '@/components/common/Modal';
import { useCreateTask } from './hooks/useCreateTask';
import { ProjectSelector } from './components/ProjectSelector';
import { AssigneeSelector } from './components/AssigneeSelector';
import { LabelSelector } from './components/LabelSelector';
import { StatusPriorityRow } from './components/StatusPriorityRow';
import { DateDurationRow } from './components/DateDurationRow';
import { AttachmentsLinks } from './components/AttachmentsLinks';
import { FormField } from './components/FormField';
import { BLUE, LINE, MUTED, BG, INPUT_STYLE, CARD_STYLE } from './createTaskConstants';
import type { Task } from '@/types';

interface CreateTaskProps {
  onClose?: () => void;
  onSuccess?: (task?: Task) => void;
  isModal?: boolean;
  fixedProjectId?: number;
  draftId?: string;
}

// ── AI refine button ──
function AIBtn({ loading, onClick, title }: { loading: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 6,
        border: '1px solid #e9d5ff', background: '#faf5ff',
        color: '#7c3aed', fontSize: 11, fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1, transition: 'all .15s',
      }}
    >
      {loading
        ? <div style={{ width: 11, height: 11, border: '1.5px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        : <Sparkles size={11} />
      }
      {loading ? 'Refining…' : ''}
    </button>
  );
}

// ── Form body 
function CreateTaskContent({ f, fixedProjectId }: { f: ReturnType<typeof useCreateTask>; fixedProjectId?: number }) {
  return (
    <>
      <ModalHeader
        title="Create task"
        subtitle="Fill in the details below to create a new task"
        onClose={f.handleClose}
        actions={
          <>
            {/* Create task */}
            <button
              type="submit"
              form="create-task-form"
              disabled={f.loading}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: f.loading ? '#94a3b8' : BLUE,
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: f.loading ? 'not-allowed' : 'pointer',
                transition: 'background .15s', whiteSpace: 'nowrap',
              }}
            >
              {f.loading ? 'Creating…' : 'Create task'}
            </button>

            {/* AI Generate */}
            <button
              type="button"
              onClick={() => f.setShowAIModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid #e9d5ff', background: '#faf5ff',
                color: '#7c3aed', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3e8ff'; e.currentTarget.style.borderColor = '#d8b4fe'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#faf5ff'; e.currentTarget.style.borderColor = '#e9d5ff'; }}
            >
              <Sparkles size={13} />
              Generate with AI
            </button>

            {/* Minimize */}
            <button
              type="button"
              onClick={f.handleMinimize}
              title="Minimize"
              style={{ width: 36, height: 36, borderRadius: 7, border: `1px solid ${LINE}`, background: 'hsl(var(--card))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, transition: 'all .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'hsl(var(--card))')}
            >
              <Minus size={14} />
            </button>
          </>
        }
      />

      {/* ── Form ── */}
      <form
        id="create-task-form"
        onSubmit={f.handleSubmit}
        className="p-4 space-y-4"
        style={{ background: BG, fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}
      >

        {/* Error banner */}
        {f.error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 16px', borderRadius: 10,
            background: '#fef2f2', border: '1px solid #fecaca',
          }}>
            <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', margin: 0 }}>Error</p>
              <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>{f.error}</p>
            </div>
          </div>
        )}

        {/* ── Section 1: Core info ─── */}
        <div style={{ ...CARD_STYLE, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <ProjectSelector
            selectedProjects={f.selectedProjects}
            setSelectedProjects={f.setSelectedProjects}
            projectDropdownOpen={f.projectDropdownOpen}
            setProjectDropdownOpen={f.setProjectDropdownOpen}
            projectSearchInput={f.projectSearchInput}
            setProjectSearchInput={f.setProjectSearchInput}
            projectSearchInputRef={f.projectSearchInputRef}
            filteredProjectOptions={f.filteredProjectOptions}
            allProjectOptions={f.allProjectOptions}
            projectsLoading={f.projectsLoading}
            fixedProjectId={fixedProjectId}
          />

          <FormField
            label="Task title"
            icon={<Type size={13} />}
            required
            action={<AIBtn loading={f.isTitleRefining} onClick={f.handleRefineTitle} title="Optimize title with AI" />}
          >
            <input
              type="text"
              value={f.heading}
              onChange={e => f.setHeading(e.target.value)}
              placeholder="Enter a concise task title…"
              required
              style={INPUT_STYLE}
              onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </FormField>

          <FormField
            label="Description"
            action={<AIBtn loading={f.isDescRefining} onClick={f.handleRefineDescription} title="Refine or generate description with AI" />}
          >
            <RichTextEditor
              value={f.description}
              onChange={f.setDescription}
              placeholder="Type @ to mention a teammate…"
              minHeight="180px"
              maxHeight="360px"
              features={{
                bold: true, italic: true, underline: true, strikethrough: true,
                code: true, codeBlock: true, link: true,
                bulletList: true, orderedList: true, blockquote: true,
                horizontalRule: true, table: true, image: true,
                heading: true, textAlign: true,
              }}
            />
          </FormField>
        </div>

        {/* ── Section 2: Metadata ───*/}
        <div style={{ ...CARD_STYLE, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StatusPriorityRow
            status={f.status} setStatus={f.setStatus}
            priority={f.priority} setPriority={f.setPriority}
            statusDropdownOpen={f.statusDropdownOpen} setStatusDropdownOpen={f.setStatusDropdownOpen}
            priorityDropdownOpen={f.priorityDropdownOpen} setPriorityDropdownOpen={f.setPriorityDropdownOpen}
          />
          <DateDurationRow
            startDate={f.startDate} setStartDate={f.setStartDate}
            endDate={f.endDate} setEndDate={f.setEndDate}
            duration={f.duration} handleDurationChange={f.handleDurationChange}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="sm:grid-cols-2 grid-cols-1">
            <AssigneeSelector
              assignedToList={f.assignedToList} setAssignedToList={f.setAssignedToList}
              dropdownOpen={f.dropdownOpen} setDropdownOpen={f.setDropdownOpen}
              assigneeSearchInput={f.assigneeSearchInput} setAssigneeSearchInput={f.setAssigneeSearchInput}
              highlightedUserIndex={f.highlightedUserIndex} setHighlightedUserIndex={f.setHighlightedUserIndex}
              filteredUserOptions={f.filteredUserOptions} allUserOptions={f.allUserOptions}
              usersLoading={f.usersLoading}
            />
            <LabelSelector
              selectedLabelIds={f.selectedLabelIds} setSelectedLabelIds={f.setSelectedLabelIds}
              labelDropdownOpen={f.labelDropdownOpen} setLabelDropdownOpen={f.setLabelDropdownOpen}
              projectLabels={f.projectLabels} selectedProjects={f.selectedProjects}
            />
          </div>
        </div>

        {/* ── Section 3: Attachments & Links ──*/}
        <div style={{ ...CARD_STYLE, padding: 20 }}>
          <AttachmentsLinks
            attachments={f.attachments}
            handleFileChange={f.handleFileChange}
            removeAttachment={f.removeAttachment}
            linkInput={f.linkInput}
            setLinkInput={f.setLinkInput}
            links={f.links}
            handleAddLink={f.handleAddLink}
            removeLink={f.removeLink}
          />
        </div>

      </form>

      {/* ── AI modal ─── */}
      {f.showAIModal && (
        <AITask
          onClose={() => f.setShowAIModal(false)}
          fixedProjectId={fixedProjectId || (f.selectedProjects.length > 0 ? f.selectedProjects[0] : undefined)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── Public component ──
export const CreateTask: React.FC<CreateTaskProps> = (props) => {
  const f = useCreateTask(props);
  const { fixedProjectId } = props;

  if (f.showSuccessView) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ background: '#16a34a', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,.15)' }}>
          Task created successfully
        </div>
      </div>
    );
  }

  return (
    <Modal isOpen onClose={f.handleClose} maxWidth="max-w-4xl">
      <CreateTaskContent f={f} fixedProjectId={fixedProjectId} />
    </Modal>
  );
};