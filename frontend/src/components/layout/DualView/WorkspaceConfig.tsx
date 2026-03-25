import React, { useState } from 'react';
import { Badge } from '@/components/common';
import type { TableColumn } from '@/components/layout/DualView';
import type { Tenant, OrgAdmin, OrgRecentUser } from '@/types';
import { Trash2 } from 'lucide-react';
import { organizationsApi } from '@/services/api';

// ─── Admin Cell ───────────────────────────────────────────────────────────────

const AdminCell = ({ admins }: { admins: OrgAdmin[] }) => {
  if (!admins || admins.length === 0) {
    return <span className="text-gray-400 text-[11px]">—</span>;
  }
  const primary = admins[0];
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] font-medium text-[#172b4d] truncate">{primary.username}</span>
      <span className="text-[10px] text-gray-400 truncate">{primary.email}</span>
    </div>
  );
};

// ─── Recent Active Users Cell ─────────────────────────────────────────────────

const RecentUsersCell = ({ users }: { users: OrgRecentUser[] }) => {
  if (!users || users.length === 0) {
    return <span className="text-gray-400 text-[11px]">None</span>;
  }
  return (
    <div className="flex -space-x-1.5">
      {users.slice(0, 3).map((u) => (
        <div
          key={u.id}
          title={`${u.username} (${u.role})`}
          className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 ring-1 ring-white"
        >
          {u.username.charAt(0).toUpperCase()}
        </div>
      ))}
      {users.length > 3 && (
        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-white">
          +{users.length - 3}
        </div>
      )}
    </div>
  );
};

// ─── Stats Cell ───────────────────────────────────────────────────────────────

interface StatItemProps {
  label: string;
  value: number;
  color: string;
}

const StatItem = ({ label, value, color }: StatItemProps) => (
  <div className="flex flex-col items-center gap-0.5 min-w-[36px]">
    <span className={`text-[13px] font-bold ${color}`}>{value}</span>
    <span className="text-[9px] text-gray-400 uppercase tracking-wide leading-none">{label}</span>
  </div>
);

const StatsDivider = () => (
  <div className="w-px h-6 bg-[#e8eaed] self-center" />
);

const StatsCell = ({ tenant }: { tenant: Tenant }) => (
  <div className="flex items-start gap-1 flex-wrap">
    <StatItem label="Users" value={tenant.stats.users} color="text-indigo-600" />
    <StatsDivider />
    <StatItem label="Projects" value={tenant.stats.projects} color="text-blue-500" />
    <StatsDivider />
    <StatItem label="Tasks" value={tenant.stats.tasks} color="text-violet-500" />
    <StatsDivider />
    <StatItem label="Teams" value={tenant.stats.teams} color="text-emerald-500" />
    <StatsDivider />
    <StatItem label="Rooms" value={tenant.stats.chat_rooms} color="text-amber-500" />
  </div>
);

// ─── Name + Delete Cell ───────────────────────────────────────────────────────

interface NameCellProps {
  tenant: Tenant;
  onDelete: (tenant: Tenant) => void;
}

const NameCell = ({ tenant, onDelete }: NameCellProps) => (
  <div className="flex items-center justify-between gap-2 w-full group/orgname">
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-semibold text-[13px] text-[#172b4d] truncate">{tenant.name}</span>
      <span className="text-[10px] text-gray-400 truncate">{tenant.slug}</span>
    </div>
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete(tenant);
      }}
      className="opacity-0 group-hover/orgname:opacity-100 p-1 hover:bg-red-50 rounded transition-all text-red-400 hover:text-red-600 shrink-0"
      title="Delete organization"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

// ─── Status Toggle Cell ───────────────────────────────────────────────────────

interface StatusToggleCellProps {
  tenant: Tenant;
  onToggled: (id: number, isActive: boolean) => void;
}

const StatusToggleCell = ({ tenant, onToggled }: StatusToggleCellProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await organizationsApi.toggleStatus(tenant.id);
      onToggled(tenant.id, result.is_active);
    } catch (err) {
      console.error('Failed to toggle status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      title={tenant.is_active ? 'Click to deactivate' : 'Click to activate'}
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium transition-all
        ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-80'}
        ${tenant.is_active
          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
        }`}
    >
      {isLoading ? (
        <svg
          className="w-2.5 h-2.5 mr-1.5 animate-spin text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            tenant.is_active ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
      {tenant.is_active ? 'Active' : 'Inactive'}
    </button>
  );
};

// ─── Column Definitions ───────────────────────────────────────────────────────

export const getWorkspaceTableColumns = (
  onDelete: (tenant: Tenant) => void,
  onStatusToggled: (id: number, isActive: boolean) => void
): TableColumn<Tenant>[] => [
  {
    key: 'name',
    label: 'Organization',
    render: (tenant: Tenant) => <NameCell tenant={tenant} onDelete={onDelete} />,
  },
  {
    key: 'is_active',
    label: 'Status',
    width: '100px',
    render: (tenant: Tenant) => (
      <StatusToggleCell tenant={tenant} onToggled={onStatusToggled} />
    ),
  },
  {
    key: 'created_at',
    label: 'Created At',
    width: '130px',
    render: (tenant: Tenant) => (
      <span className="text-[12px] text-gray-600">
        {new Date(tenant.created_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'admins',
    label: 'Admin',
    width: '180px',
    render: (tenant: Tenant) => <AdminCell admins={tenant.admins} />,
  },
  {
    key: 'stats',
    label: 'Stats',
    width: '280px',
    render: (tenant: Tenant) => <StatsCell tenant={tenant} />,
  },
];