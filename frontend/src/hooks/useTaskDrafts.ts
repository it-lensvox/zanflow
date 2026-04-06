import { useState, useCallback, useEffect, useRef } from 'react';

export interface TaskDraftData {
    draftId: string;
    heading: string;
    description: string;
    startDate: string;
    endDate: string;
    assignedToList: number[];
    selectedProjects: number[];
    status: string;
    priority: string;
    labels: string;
    selectedLabelIds: number[];
    linkInput: string;
    links: string[];
    duration: string;
    fixedProjectId?: number;
    isMinimized: boolean;
    createdAt: number;
}

const STORAGE_KEY = 'task_drafts_v1';
const AUTOSAVE_DELAY_MS = 600;
const isDraftBeingCreated = new Set<string>();

function loadDrafts(): TaskDraftData[] {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as TaskDraftData[]) : [];
    } catch {
        return [];
    }
}

function saveDrafts(drafts: TaskDraftData[]): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch {
        // Storage quota exceeded — silently ignore
    }
}

export function useTaskDrafts() {
    const [drafts, setDrafts] = useState<TaskDraftData[]>(loadDrafts);
    const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // Sync to sessionStorage whenever drafts change
    useEffect(() => {
        saveDrafts(drafts);
    }, [drafts]);

    const createDraft = useCallback((fixedProjectId?: number, initialProjectId?: number): string => {
        const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newDraft: TaskDraftData = {
            draftId,
            heading: '',
            description: '',
            startDate: '',
            endDate: '',
            assignedToList: [],
            selectedProjects: fixedProjectId
                ? [fixedProjectId]
                : initialProjectId
                    ? [initialProjectId]
                    : [],
            status: 'pending',
            priority: 'medium',
            labels: '',
            selectedLabelIds: [],
            linkInput: '',
            links: [],
            duration: '',
            fixedProjectId,
            isMinimized: false,
            createdAt: Date.now(),
        };
        setDrafts(prev => [...prev, newDraft]);
        return draftId;
    }, []);

    const updateDraft = useCallback((draftId: string, partial: Partial<TaskDraftData>) => {
        setDrafts(prev =>
            prev.map(d => (d.draftId === draftId ? { ...d, ...partial } : d))
        );
    }, []);

    /**
     * Debounced autosave — called on every keystroke in the form.
     * Clears the previous timer for this draft before setting a new one.
     */
    const autosaveDraft = useCallback((draftId: string, partial: Partial<TaskDraftData>) => {
        if (autosaveTimers.current[draftId]) {
            clearTimeout(autosaveTimers.current[draftId]);
        }
        autosaveTimers.current[draftId] = setTimeout(() => {
            setDrafts(prev =>
                prev.map(d => (d.draftId === draftId ? { ...d, ...partial } : d))
            );
            delete autosaveTimers.current[draftId];
        }, AUTOSAVE_DELAY_MS);
    }, []);

    const minimizeDraft = useCallback((draftId: string) => {
        setDrafts(prev =>
            prev.map(d => (d.draftId === draftId ? { ...d, isMinimized: true } : d))
        );
    }, []);

    const maximizeDraft = useCallback((draftId: string) => {
        setDrafts(prev =>
            prev.map(d => (d.draftId === draftId ? { ...d, isMinimized: false } : d))
        );
    }, []);

    const discardDraft = useCallback((draftId: string) => {
        if (autosaveTimers.current[draftId]) {
            clearTimeout(autosaveTimers.current[draftId]);
            delete autosaveTimers.current[draftId];
        }
        setDrafts(prev => prev.filter(d => d.draftId !== draftId));
    }, []);

    const getDraft = useCallback(
        (draftId: string) => drafts.find(d => d.draftId === draftId),
        [drafts]
    );

    const minimizedDrafts = drafts.filter(d => d.isMinimized);
    const activeDrafts = drafts.filter(d => !d.isMinimized);

    return {
        drafts,
        minimizedDrafts,
        activeDrafts,
        createDraft,
        updateDraft,
        autosaveDraft,
        minimizeDraft,
        maximizeDraft,
        discardDraft,
        getDraft,
    };
}

// ─── Singleton context so the same state is shared app-wide ─────────────────
import { createContext, useContext } from 'react';

export type TaskDraftsContextValue = ReturnType<typeof useTaskDrafts>;

export const TaskDraftsContext = createContext<TaskDraftsContextValue | null>(null);

export function useTaskDraftsContext(): TaskDraftsContextValue {
    const ctx = useContext(TaskDraftsContext);
    if (!ctx) throw new Error('useTaskDraftsContext must be used inside <TaskDraftsProvider>');
    return ctx;
}