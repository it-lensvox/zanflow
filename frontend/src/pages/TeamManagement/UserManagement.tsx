import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Loader2, User, Mail, X, Lock, ChevronDown, CheckCircle, Crown, Send } from 'lucide-react';
import { Button } from '@/components/common';
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
      <div ref={modalRef} className="relative bg-white rounded-lg shadow-2xl w-full max-w-md m-4 p-6" role="dialog">
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
                    className={`px-4 py-2.5 cursor-pointer text-sm transition-colors ${newRole === role ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
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
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validate = () => {
     const newErrors: { username?: string; email?: string; password?: string; confirmPassword?: string } = {};
    if (form.username && /^\d/.test(form.username)) {
      newErrors.username = 'Username must start with a letter.';
    }
    if (form.email && !isValidEmail(form.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (form.password && form.password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters.';
    }
    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    return newErrors;
  };
  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2500);
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      if (data?.email) {
        setErrors(prev => ({ ...prev, email: 'This email is already in use.' }));
      } else if (data?.detail) {
        setErrors(prev => ({ ...prev, email: data.detail }));
      }
    },
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
          <input
            placeholder="unique_username"
            className={`${inputClass} ${errors.username ? 'border-red-400 focus:ring-red-200' : ''}`}
            onChange={e => {
              setForm({ ...form, username: e.target.value });
              setErrors(prev => ({ ...prev, username: undefined }));
            }}
          />
          {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
        </div>
        <div>
          <label className={labelClass}><Mail className="h-4 w-4" /> Email</label>
          <input
            placeholder="user@example.com"
            className={`${inputClass} ${errors.email ? 'border-red-400 focus:ring-red-200' : ''}`}
            onChange={e => {
              setForm({ ...form, email: e.target.value });
              setErrors(prev => ({ ...prev, email: undefined }));
            }}
            onBlur={e => {
              const val = e.target.value;
              if (val && !isValidEmail(val)) {
                setErrors(prev => ({ ...prev, email: 'Please enter a valid email address.' }));
              }
            }}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
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
          <input
            type="password"
            placeholder="********"
            className={`${inputClass} ${errors.password ? 'border-red-400 focus:ring-red-200' : ''}`}
            onChange={e => {
              setForm({ ...form, password: e.target.value });
              setErrors(prev => ({ ...prev, password: undefined }));
            }}
          />
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
        </div>
        <div>
          <label className={labelClass}><Lock className="h-4 w-4" /> Confirm Password</label>
          <div className="relative">
            <input
              type="password"
              placeholder="********"
              className={`${inputClass} pr-9 ${errors.confirmPassword ? 'border-red-400 focus:ring-red-200' : ''}`}
              onChange={e => {
                setForm({ ...form, confirmPassword: e.target.value });
                setErrors(prev => ({ ...prev, confirmPassword: undefined }));
              }}
              onBlur={e => {
                if (form.password && e.target.value && form.password !== e.target.value) {
                  setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
                }
              }}
            />
            {form.password.length >= 4 && form.confirmPassword && form.password === form.confirmPassword && (
              <CheckCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
            )}
          </div>
          {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 mt-2 border-t">
        <Button variant="outline" className="px-6" onClick={onClose}>Cancel</Button>
        <Button
          className="px-6 bg-[#1a1f2e] text-white hover:bg-[#252b3d]"
          onClick={() => {
            const validationErrors = validate();
            if (Object.keys(validationErrors).length > 0) {
              setErrors(validationErrors);
              return;
            }
            createUserMutation.mutate({
              username: form.username,
              email: form.email,
              password: form.password,
              password_confirm: form.confirmPassword,
              first_name: form.firstName,
              last_name: form.lastName,
              role: form.role,
            });
          }}
          disabled={createUserMutation.isPending}
        >
          {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create User'}
        </Button>
      </div>

      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center z-10 rounded-lg bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-xl shadow-lg bg-white border border-green-100">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="text-base font-semibold text-gray-800 tracking-wide">User created successfully.</p>
          </div>
        </div>
      )}
    </CustomModal>
  );
};

const InviteUserModal: React.FC<{ isOpen: boolean; onClose: () => void; queryClient: any }> = ({ isOpen, onClose, queryClient }) => {
  const [form, setForm] = useState({ email: '', role: 'viewer' as AppUser['role'] });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const inviteUserMutation = useMutation({
    mutationFn: usersApi.invite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        setForm({ email: '', role: 'viewer' });
      }, 2500);
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      if (data?.detail) {
        setErrors(prev => ({ ...prev, email: data.detail }));
      } else if (data?.email) {
        setErrors(prev => ({ ...prev, email: data.email[0] ?? 'This email is already in use or invalid.' }));
      }
    },
  });

  const inputClass = "w-full border rounded-md p-2 pl-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";
  const labelClass = "flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5";

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Invite User">
      <div className="py-4 space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
        <div>
          <label className={labelClass}><Mail className="h-4 w-4" /> Email</label>
          <input
            placeholder="user@example.com"
            value={form.email}
            className={`${inputClass} ${errors.email ? 'border-red-400 focus:ring-red-200' : ''}`}
            onChange={e => {
              setForm({ ...form, email: e.target.value });
              setErrors(prev => ({ ...prev, email: undefined }));
            }}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
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
                {(['admin', 'manager', 'annotator', 'viewer'] as AppUser['role'][]).map((role) => (
                  <div
                    key={role}
                    className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer capitalize"
                    onClick={() => {
                      setForm({ ...form, role });
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
      </div>

      <div className="flex justify-end gap-3 pt-6 mt-2 border-t">
        <Button variant="outline" className="px-6" onClick={() => { onClose(); setForm({ email: '', role: 'viewer' }); setErrors({}); }}>Cancel</Button>
        <Button
          className="px-6 bg-[#1a1f2e] text-white hover:bg-[#252b3d]"
          onClick={() => {
            if (!form.email) {
              setErrors({ email: 'Email is required.' });
              return;
            }
            inviteUserMutation.mutate({ email: form.email, role: form.role });
          }}
          disabled={inviteUserMutation.isPending}
        >
          {inviteUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Invite</>}
        </Button>
      </div>

      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center z-10 rounded-lg bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-xl shadow-lg bg-white border border-green-100">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="text-base font-semibold text-gray-800 tracking-wide">Invitation sent successfully.</p>
          </div>
        </div>
      )}
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
  const [isInviteUserModalOpen, setIsInviteUserModalOpen] = useState(false);
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
              <Button onClick={() => setIsInviteUserModalOpen(true)}>
                <Send className="h-4 w-4 mr-2" /> Invite User
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
      <InviteUserModal isOpen={isInviteUserModalOpen} onClose={() => setIsInviteUserModalOpen(false)} queryClient={queryClient} />
      {roleChangeUser &&
        <ChangeRoleModal user={roleChangeUser} isOpen={!!roleChangeUser} onClose={() => setRoleChangeUser(null)} queryClient={queryClient} />}
      {userToDelete &&
        <DeleteConfirmationModal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} onConfirm={() => deleteUserMutation.mutate(userToDelete.id)} username={userToDelete.username} isPending={deleteUserMutation.isPending} />}
    </div>
  );
}