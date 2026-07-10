// ── Types & interfaces for the TeamPerformance module ──────────────────────

export interface PerformanceMetrics {
  completed_tasks_count:  number;
  in_progress_tasks_count: number;
  pending_tasks_count:    number;
  total_tasks_count:      number;
  performance_score:      number;
}

export interface ProjectDistributionItem {
  project_name:        string;
  task_count:          number;
  total_project_tasks: number;
}

export interface RecentActivityItem {
  task_name:    string;
  project_name: string;
  status:       string;
  timestamp:    string;
}

export interface UserPerformance extends PerformanceMetrics {
  project_distribution: ProjectDistributionItem[];
  recent_activity:      RecentActivityItem[];
}

export interface TeamMember {
  id:         number;
  username:   string;
  first_name: string;
  last_name:  string;
  email:      string;
  role:       string;
  initials:   string;
  performance: UserPerformance | null;
}

export type PerformanceFetchState = 'idle' | 'loading' | 'success' | 'error';