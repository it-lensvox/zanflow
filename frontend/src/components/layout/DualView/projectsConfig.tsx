import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { TablePopover } from '@/components/common';
import { formatRelativeTime, getProjectTypeColor } from '@/lib/utils';
import type { Project } from '@/types';
import type { TableColumn } from '../DualView';

const ProjectMembersList = ({ project }: { project: Project }) => {
  const trigger = (
    <div className="flex -space-x-1.5 items-center cursor-pointer hover:opacity-80">
      {project.members && project.members.length > 0 ? (
        <>
          {project.members.slice(0, 3).map((member: any) => (
            <div
              key={member.id}
              className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-500 ring-1 ring-border z-10"
              title={member.user?.full_name || 'User'}
            >
              {member.user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
          ))}
          {project.members.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-muted-foreground/60 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-border z-0">
              +{project.members.length - 3}
            </div>
          )}
        </>
      ) : (
        <span className="text-muted-foreground/40 text-[11px] pl-1">—</span>
      )}
    </div>
  );

  return (
    <TablePopover trigger={trigger}>
      <div className="p-2 border-b border-border flex justify-between items-center bg-muted rounded-t-lg">
        <span className="text-xs font-semibold text-foreground">Project Members</span>
        <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground">
          {project.members?.length || 0}
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {project.members?.map((member) => (
          <div key={member.id} className="flex items-center gap-2 p-1.5 hover:bg-accent rounded">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-500 shrink-0">
              {member.user.full_name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground truncate">{member.user.full_name}</p>
              <p className="text-[10px] text-muted-foreground truncate capitalize">{member.role.replace('_', ' ')}</p>
            </div>
          </div>
        ))}
      </div>
    </TablePopover>
  );
};

// projectsConfig.tsx
export const getProjectsTableColumns = (
  onToggleFavorite: (e: React.MouseEvent, project: Project) => void
): TableColumn<Project>[] => [
    {
      key: 'name',
      label: 'Project',
      render: (project: any) => (
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] ${getProjectTypeColor(project.task_type)}`}>
            {project.name?.slice(0, 1)?.toUpperCase()}
          </div>
          <span className="font-semibold text-[13px] text-foreground">{project.name}</span>
        </div>
      ),
    },
    {
      key: 'document_count',
      label: <span className="text-[14px] font-bold tracking-wide text-foreground">Documents</span>,
      width: '15%',
      render: (project: any) => (
        <span className="text-foreground font-medium text-[13px]">{project.document_count || 0} docs</span>
      ),
    },
    {
      key: 'members',
      label: <span className="text-[14px] font-bold tracking-wide text-foreground">Members</span>,
      width: '15%',
      render: (project: Project) => <ProjectMembersList project={project} />,
    },
    {
      key: 'updated_at',
      label: <span className="text-[14px] font-bold tracking-wide text-foreground">Updated</span>,
      width: '12%',
      render: (project: any) => (
        <span className="text-muted-foreground text-[13px]">{formatRelativeTime(project.updated_at)}</span>
      ),
    },
    {
      key: 'favorite',
      label: <span className="text-[14px] font-bold tracking-wide text-foreground">Favorite</span>,
      width: '6%',
      className: 'text-center',
      render: (project: any) => (
        <button
          onClick={(e) => onToggleFavorite(e, project)}
          className="hover:scale-110 transition-transform"
        >
          {project.is_favourite ? (
            <span className="text-yellow-500 text-lg">★</span>
          ) : (
            <span className="text-muted-foreground/40 text-lg hover:text-yellow-400">☆</span>
          )}
        </button>
      ),
    },
  ];

interface ProjectGridCardProps {
  project: Project;
  onToggleFavorite: (e: React.MouseEvent, project: Project) => void;
}

export function ProjectGridCard({ project, onToggleFavorite }: ProjectGridCardProps) {
  const [openMembersCard, setOpenMembersCard] = React.useState(false);

  return (
    <Link to={`/projects/${project.id}`}>
      <div className="bg-card rounded-xl p-4 transition-all duration-300 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 border border-border relative hover:z-50 h-full group text-card-foreground">
        {/* Header: Project Name & Favorite */}
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold text-xs ${getProjectTypeColor(project.task_type)}`}
            >
              {project.name?.slice(0, 1)?.toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground line-clamp-1">{project.name}</span>
              <span className="text-xs font-medium text-muted-foreground">
                {formatRelativeTime(project.updated_at)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => onToggleFavorite(e, project)}
            className="text-muted-foreground/40 hover:text-yellow-500 transition-colors"
          >
            <span className={`text-lg ${project.is_favourite ? 'text-yellow-500' : ''}`}>
              {project.is_favourite ? '★' : '☆'}
            </span>
          </button>
        </div>

        {/* Details: Docs & Members */}
        <div className="space-y-1 text-xs text-muted-foreground mb-2">
          <div className="flex items-center">
            <FileText className="w-3 h-3 mr-1" />
            <span className="font-medium">Docs:</span>
            <span className="ml-1">{project.document_count || 0}</span>
          </div>

          <div className="flex items-center">
            <ProjectMembersList project={project} />
          </div>
        </div>
      </div>
    </Link>
  );
}