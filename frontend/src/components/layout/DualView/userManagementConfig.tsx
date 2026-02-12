import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { User as AppUser } from '@/types';
import type { TableColumn } from '../DualView';

interface UserTableColumnsProps {
  onRoleClick: (user: AppUser) => void;
  onDeleteClick: (user: AppUser) => void;
}

const getRoleColorConfig = (role: AppUser['role']) => {
  const normalizedRole = role.toLowerCase();
  switch (normalizedRole) {
    case 'admin':
      return { bg: 'bg-green-50', text: 'text-green-800', label: 'ADMIN' };
    case 'manager':
      return { bg: 'bg-blue-50', text: 'text-blue-800', label: 'MANAGER' };
    case 'annotator':
      return { bg: 'bg-yellow-50', text: 'text-yellow-800', label: 'ANNOTATOR' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-800', label: 'VIEWER' };
  }
};

export const createUserTableColumns = ({ onRoleClick, onDeleteClick }: UserTableColumnsProps): TableColumn<AppUser>[] => {
  return [
    {
      key: 'name',
      label: 'Full Name',
      render: (user: AppUser) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 flex-shrink-0">
            {user.first_name?.charAt(0) || user.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-[#172b4d] truncate">
              {user.first_name} {user.last_name}
            </span>
            <span className="text-[11px] text-gray-400 truncate">{user.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      width: '140px',
      render: (user: AppUser) => {
        const config = getRoleColorConfig(user.role);
        return (
          <div
            onClick={(e) => { e.stopPropagation(); onRoleClick(user); }}
            className={`jira-status-badge ${config.bg} ${config.text} cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center px-2.5 py-1 rounded text-[11px] font-medium uppercase`}
          >
            {config.label}
          </div>
        );
      },
    },
    {
      key: 'date_joined',
      label: 'Joined Date',
      render: (user: AppUser) => (
        <span className="text-[12px] text-gray-700">
          {formatDate(user.date_joined)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '60px',
      render: (user: AppUser) => (
        <div className="flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteClick(user); }}
            className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 hover:bg-red-50 rounded"
            title="Delete User"
          >
            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
          </button>
        </div>
      ),
    },
  ];
};