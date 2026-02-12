import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Loader2, User, Mail, X, Lock, ChevronDown, CheckCircle, Crown, } from 'lucide-react';
import {
  Button,
  Card,
} from '@/components/common';
import { usersApi } from '@/services/api';
import type { User as AppUser, PaginatedResponse } from '@/types';
import { DualView, useViewMode, ViewToggle } from '@/components/layout/DualView';
import { createUserTableColumns } from '@/components/layout/DualView/userManagementConfig';

const CustomModal: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string }> = ({ isOpen, onClose, children, title }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen) { document.body.style.overflow = 'hidden'; modalRef.current?.focus(); }
    else { document.body.style.overflow = 'unset'; }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} className="bg-white rounded-lg shadow-2xl w-full max-w-md m-4 p-6" role="dialog">
        <div className="flex justify-between items-start pb-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        {children}
      </div>
    </div>
  );
};

const ChangeRoleModal: React.FC<{ user: AppUser; isOpen: boolean; onClose: () => void; queryClient: any }> = ({ user, isOpen, onClose, queryClient }) => {
  const [newRole, setNewRole] = useState<AppUser['role']>(user.role);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); 
  const roles: AppUser['role'][] = ['admin', 'manager', 'annotator', 'viewer'];

  const changeRoleMutation = useMutation({
    mutationFn: (role: AppUser['role']) => usersApi.updateRole(user.id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const getRoleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={`Change Role: ${user.username}`}>
      <div className="py-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Crown className="w-4 h-4" /> Select New Role
          </label>

          {/* Inline Controlled Dropdown */}
          <div className="relative">
            <div
              className="w-full p-2.5 rounded border border-gray-300 hover:border-gray-400 cursor-pointer bg-white flex items-center justify-between transition-all"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="text-sm text-gray-700 capitalize">{newRole}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>

            {isDropdownOpen && (
              <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
                {roles.map((role) => (
                  <div
                    key={role}
                    className={`px-4 py-2.5 cursor-pointer text-sm transition-colors ${newRole === role ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    onClick={() => {
                      setNewRole(role);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      {getRoleLabel(role)}
                      {newRole === role && <CheckCircle className="w-4 h-4" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          className="bg-[#1a1f2e] text-white hover:bg-[#252b3d]"
          onClick={async () => {
            try {
              await changeRoleMutation.mutateAsync(newRole);
            } catch (error) {
              console.error("Save failed:", error);
            }
          }}
          disabled={newRole === user.role || changeRoleMutation.isPending}
        >
          {changeRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
        </Button>
      </div>
    </CustomModal>
  );
};

const AddUserModal: React.FC<{ isOpen: boolean; onClose: () => void; queryClient: any }> = ({ isOpen, onClose, queryClient }) => {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', firstName: '', lastName: '', role: 'viewer' as AppUser['role'] });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); onClose(); },
  });

  const inputClass = "w-full border rounded-md p-2 pl-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";
  const labelClass = "flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5";

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Add New User">
      <div className="py-4 space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}><User className="h-4 w-4" /> First Name</label>
            <input placeholder="First Name" className={inputClass} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}><User className="h-4 w-4" /> Last Name</label>
            <input placeholder="Last Name" className={inputClass} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={labelClass}><User className="h-4 w-4" /> Username</label>
          <input placeholder="unique_username" className={inputClass} onChange={e => setForm({ ...form, username: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}><Mail className="h-4 w-4" /> Email</label>
          <input placeholder="user@example.com" className={inputClass} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}><Crown className="h-4 w-4" /> Role</label>
          <div className="space-y-1">
            <div
              className={`${inputClass} cursor-pointer flex justify-between items-center bg-white`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="capitalize">{form.role}</span>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>

            {isDropdownOpen && (
              <div className="border border-gray-200 rounded-md mt-1 bg-white overflow-hidden shadow-sm">
                {['admin', 'manager', 'annotator', 'viewer'].map((role) => (
                  <div
                    key={role}
                    className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer capitalize"
                    onClick={() => {
                      setForm({ ...form, role: role as any });
                      setIsDropdownOpen(false);
                    }}
                  >
                    {role}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className={labelClass}><Lock className="h-4 w-4" /> Password</label>
          <input type="password" placeholder="********" className={inputClass} onChange={e => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}><Lock className="h-4 w-4" /> Confirm Password</label>
          <input type="password" placeholder="********" className={inputClass} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-6 mt-2 border-t">
        <Button variant="outline" className="px-6" onClick={onClose}>Cancel</Button>
        <Button
          className="px-6 bg-[#1a1f2e] text-white hover:bg-[#252b3d]"
          onClick={() => createUserMutation.mutate({
            username: form.username,
            email: form.email,
            password: form.password,
            password_confirm: form.confirmPassword,
            first_name: form.firstName,  
            last_name: form.lastName,              
            role: form.role
          })}
          disabled={createUserMutation.isPending}
        >
          {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create User'}
        </Button>
      </div>
    </CustomModal>
  );
};

const DeleteConfirmationModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; username: string; isPending: boolean }> = ({ isOpen, onClose, onConfirm, username, isPending }) => (
  <CustomModal isOpen={isOpen} onClose={onClose} title="Delete User">
    <div className="py-4"><p className="text-sm">Are you sure you want to delete <span className="font-bold">{username}</span>?</p></div>
    <div className="flex justify-end gap-3 pt-4 border-t">
      <Button variant="outline" onClick={onClose}>No</Button>
      <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Yes, Delete
      </Button>
    </div>
  </CustomModal>
);

// Main Page Component 

export function UserManagement() {
  const queryClient = useQueryClient();
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [roleChangeUser, setRoleChangeUser] = useState<AppUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const viewMode = 'table' as const;

  const { data: usersData, isLoading } = useQuery<PaginatedResponse<AppUser>, Error>({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => usersApi.delete(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setUserToDelete(null); },
  });

  const users = usersData?.results || [];

  return (
    <div className="flex w-full min-h-screen">
      <div className="flex-1 min-w-0 p-8">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">User Management</h1>
              <p className="text-muted-foreground">Manage system users, access levels, and roles</p>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={() => setIsAddUserModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Add New User
              </Button>
            </div>
          </div>

          <DualView
            viewMode="table"
            isLoading={isLoading}
            gridProps={{
              data: users,
              renderCard: () => null, 
            }}
            tableProps={{
              data: users,
              columns: createUserTableColumns({
                onRoleClick: (user) => setRoleChangeUser(user),
                onDeleteClick: (user) => setUserToDelete(user)
              }),
              rowKey: (user) => user.id,
              rowClassName: () => 'group',
            }}
          />
        </div>
      </div>

      <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} queryClient={queryClient} />
      {roleChangeUser && <ChangeRoleModal user={roleChangeUser} isOpen={!!roleChangeUser} onClose={() => setRoleChangeUser(null)} queryClient={queryClient} />}
      {userToDelete && <DeleteConfirmationModal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} onConfirm={() => deleteUserMutation.mutate(userToDelete.id)} username={userToDelete.username} isPending={deleteUserMutation.isPending} />}
    </div>
  );
}