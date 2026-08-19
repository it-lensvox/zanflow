import { useState, useEffect, useCallback } from 'react';
import { customDashboardsApi } from '@/services/api';
import type { CustomDashboard, WidgetConfig, WidgetType, WidgetSize } from '@/types';

const TEMPLATE_WIDGETS: Record<string, Omit<WidgetConfig, 'id'>[]> = {
  blank: [],
  overview: [
    { type: 'stat_projects',   size: 'sm', order: 0 },
    { type: 'stat_tasks',      size: 'sm', order: 1 },
    { type: 'stat_completed',  size: 'sm', order: 2 },
    { type: 'stat_overdue',    size: 'sm', order: 3 },
    { type: 'donut_chart',     size: 'md', order: 4 },
    { type: 'line_chart',      size: 'md', order: 5 },
    { type: 'my_tasks',        size: 'md', order: 6 },
    { type: 'recent_activity', size: 'md', order: 7 },
    { type: 'projects_table',  size: 'lg', order: 8 },
  ],
  tasks: [
    { type: 'stat_tasks',      size: 'sm', order: 0 },
    { type: 'stat_completed',  size: 'sm', order: 1 },
    { type: 'stat_overdue',    size: 'sm', order: 2 },
    { type: 'my_tasks',        size: 'lg', order: 3 },
    { type: 'donut_chart',     size: 'md', order: 4 },
  ],
};

function generateWidgetId(): string {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useCustomDashboards() {
  const [dashboards, setDashboards] = useState<CustomDashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load on mount
  useEffect(() => {
    customDashboardsApi.getAll()
      .then(data => setDashboards(Array.isArray(data) ? data : []))
      .catch(() => setDashboards([]))
      .finally(() => setIsLoading(false));
  }, []);

  // ── Create
  const createDashboard = useCallback(async (name: string, template: string): Promise<CustomDashboard> => {
    const baseWidgets = TEMPLATE_WIDGETS[template] ?? [];
    const widgets: WidgetConfig[] = baseWidgets.map(w => ({ ...w, id: generateWidgetId() }));
    const isFirst = dashboards.length === 0;
    const created = await customDashboardsApi.create({
      name: name.trim() || 'My Dashboard',
      is_default: isFirst,
      widgets,
    });
    setDashboards(prev => [...prev, created]);
    return created;
  }, [dashboards.length]);

  // ── Rename
  const renameDashboard = useCallback(async (id: number, name: string) => {
    const updated = await customDashboardsApi.update(id, { name: name.trim() || 'My Dashboard' });
    setDashboards(prev => prev.map(d => d.id === id ? updated : d));
  }, []);

  // ── Delete
  const deleteDashboard = useCallback(async (id: number) => {
    await customDashboardsApi.remove(id);
    setDashboards(prev => prev.filter(d => d.id !== id));
  }, []);

  // ── Set default — backend handles resetting others
  const setDefaultDashboard = useCallback(async (id: number) => {
    await customDashboardsApi.update(id, { is_default: true });
    // Re-fetch all so is_default states are in sync with backend
    const all = await customDashboardsApi.getAll();
    setDashboards(all);
  }, []);

  // ── Add widget
  const addWidget = useCallback(async (dashboardId: number, type: WidgetType, size: WidgetSize = 'md') => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (!dashboard) return;
    const newWidget: WidgetConfig = {
      id: generateWidgetId(),
      type,
      size,
      order: dashboard.widgets.length,
    };
    const updated = await customDashboardsApi.update(dashboardId, {
      widgets: [...dashboard.widgets, newWidget],
    });
    setDashboards(prev => prev.map(d => d.id === dashboardId ? updated : d));
  }, [dashboards]);

  // ── Remove widget
  const removeWidget = useCallback(async (dashboardId: number, widgetId: string) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (!dashboard) return;
    const updated = await customDashboardsApi.update(dashboardId, {
      widgets: dashboard.widgets
        .filter(w => w.id !== widgetId)
        .map((w, i) => ({ ...w, order: i })),
    });
    setDashboards(prev => prev.map(d => d.id === dashboardId ? updated : d));
  }, [dashboards]);

  // ── Reorder widgets
  const reorderWidgets = useCallback(async (dashboardId: number, widgets: WidgetConfig[]) => {
    const updated = await customDashboardsApi.update(dashboardId, { widgets });
    setDashboards(prev => prev.map(d => d.id === dashboardId ? updated : d));
  }, []);

  // ── Resize widget
  const resizeWidget = useCallback(async (dashboardId: number, widgetId: string, size: WidgetSize) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (!dashboard) return;
    const updated = await customDashboardsApi.update(dashboardId, {
      widgets: dashboard.widgets.map(w => w.id === widgetId ? { ...w, size } : w),
    });
    setDashboards(prev => prev.map(d => d.id === dashboardId ? updated : d));
  }, [dashboards]);

  const defaultDashboard = dashboards.find(d => d.is_default) ?? dashboards[0] ?? null;

  return {
    dashboards,
    isLoading,
    defaultDashboard,
    createDashboard,
    renameDashboard,
    deleteDashboard,
    setDefaultDashboard,
    addWidget,
    removeWidget,
    reorderWidgets,
    resizeWidget,
  };
}