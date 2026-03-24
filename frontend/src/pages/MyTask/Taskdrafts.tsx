import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronUp, ClipboardList } from 'lucide-react';
import { TaskDraftsContext, useTaskDrafts, useTaskDraftsContext } from '@/hooks/useTaskDrafts';

// Provider

export function TaskDraftsProvider({ children }: { children: React.ReactNode }) {
    const value = useTaskDrafts();
    return (
        <TaskDraftsContext.Provider value={value}>
            {children}
        </TaskDraftsContext.Provider>
    );
}

// ─── Minimized Draft Bar 

export function TaskDraftBar() {
    const { minimizedDrafts, maximizeDraft, discardDraft } = useTaskDraftsContext();
    const navigate = useNavigate();

    if (minimizedDrafts.length === 0) return null;

    const handleMaximize = (draftId: string) => {
        maximizeDraft(draftId);
        navigate('/taskboard/create', { state: { draftId } });
    };

    return (
        <div
            className="fixed bottom-0 right-20 z-[200] flex flex-row-reverse items-end gap-1"
            aria-label="Task drafts"
        >
            {minimizedDrafts.map((draft) => (
                <div
                    key={draft.draftId}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-t-lg shadow-lg px-3 py-2 w-52 cursor-pointer hover:bg-gray-50 transition-colors group"
                    onClick={() => handleMaximize(draft.draftId)}
                    title={draft.heading || 'Untitled Task'}
                >
                    <ClipboardList className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="flex-1 text-xs font-medium text-gray-700 truncate">
                        {draft.heading.trim() || 'Untitled Task'}
                    </span>
                    <ChevronUp className="w-3 h-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                    <button
                        type="button"
                        aria-label="Discard draft"
                        className="flex-shrink-0 p-0.5 rounded hover:bg-red-100 hover:text-red-600 text-gray-400 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            discardDraft(draft.draftId);
                        }}
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            ))}
        </div>
    );
}