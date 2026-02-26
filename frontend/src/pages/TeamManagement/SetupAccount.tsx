import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle, AlertCircle, User, Lock, Mail, Crown } from 'lucide-react';
import { usersApi } from '@/services/api';
import type { InviteVerifyResponse, InviteAcceptPayload } from '@/types';

type PageState = 'loading' | 'error' | 'form' | 'success';

export function SetupAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [inviteData, setInviteData] = useState<InviteVerifyResponse | null>(null);
  const [form, setForm] = useState({
    username: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
  });
  const [errors, setErrors] = useState<Partial<typeof form & { submit: string }>>({});

  // ── STEP 2: Verify token on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setPageState('error');
      return;
    }
    usersApi.verifyInvite(token)
      .then((data) => {
        setInviteData(data);
        setPageState('form');
      })
      .catch(() => {
        setPageState('error');
      });
  }, [token]);

  // ── STEP 4: Submit form ────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: (payload: InviteAcceptPayload) => usersApi.acceptInvite(payload),
    onSuccess: () => {
      setPageState('success');
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      const fieldErrors: typeof errors = {};
      if (data?.username) fieldErrors.username = data.username[0] ?? 'Invalid username.';
      if (data?.password) fieldErrors.password = data.password[0] ?? 'Invalid password.';
      if (data?.non_field_errors) fieldErrors.submit = data.non_field_errors[0];
      if (data?.detail) fieldErrors.submit = data.detail;
      setErrors(fieldErrors);
    },
  });

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.username.trim()) newErrors.username = 'Username is required.';
    else if (/^\d/.test(form.username)) newErrors.username = 'Username must start with a letter.';
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required.';
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required.';
    if (!form.password) newErrors.password = 'Password is required.';
    else if (form.password.length < 4) newErrors.password = 'Password must be at least 4 characters.';
    if (form.password !== form.password_confirm) newErrors.password_confirm = 'Passwords do not match.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    acceptMutation.mutate({
      token,
      username: form.username,
      first_name: form.first_name,
      last_name: form.last_name,
      password: form.password,
      password_confirm: form.password_confirm,
    });
  };

  // ── Shared styles (mirrors AddUserModal) ──────────────────────────────────
  const inputClass = "w-full border rounded-md p-2 pl-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all bg-white";
  const labelClass = "flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5";

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">

      {/* ── Loading ── */}
      {pageState === 'loading' && (
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Verifying your invitation…</p>
        </div>
      )}

      {/* ── Error ── */}
      {pageState === 'error' && (
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-800">Invitation Invalid</h2>
          <p className="text-sm text-gray-500">
            This invitation link is invalid or has expired. Please contact your administrator to request a new one.
          </p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-2 text-sm text-primary underline hover:text-primary/80 transition-colors"
          >
            Back to Login
          </button>
        </div>
      )}

      {/* ── Success ── */}
      {pageState === 'success' && (
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-800">Account Created!</h2>
          <p className="text-sm text-gray-500">
            Your account has been set up successfully. Redirecting you to login…
          </p>
        </div>
      )}

      {/* ── Form ── */}
      {pageState === 'form' && inviteData && (
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md m-4">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b">
            <h2 className="text-xl font-semibold text-gray-800">Set Up Your Account</h2>
            <p className="text-sm text-gray-500 mt-1">Complete your profile to get started.</p>
          </div>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">

            {/* Read-only: Email */}
            <div>
              <label className={labelClass}>
                <Mail className="h-4 w-4" /> Email
              </label>
              <div className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`}>
                {inviteData.email}
              </div>
            </div>

            {/* Read-only: Role */}
            <div>
              <label className={labelClass}>
                <Crown className="h-4 w-4" /> Role
              </label>
              <div className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed capitalize`}>
                {inviteData.role}
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* First Name + Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  <User className="h-4 w-4" /> First Name
                </label>
                <input
                  placeholder="First Name"
                  value={form.first_name}
                  className={`${inputClass} ${errors.first_name ? 'border-red-400 focus:ring-red-200' : ''}`}
                  onChange={e => { setForm({ ...form, first_name: e.target.value }); setErrors(p => ({ ...p, first_name: undefined })); }}
                />
                {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <label className={labelClass}>
                  <User className="h-4 w-4" /> Last Name
                </label>
                <input
                  placeholder="Last Name"
                  value={form.last_name}
                  className={`${inputClass} ${errors.last_name ? 'border-red-400 focus:ring-red-200' : ''}`}
                  onChange={e => { setForm({ ...form, last_name: e.target.value }); setErrors(p => ({ ...p, last_name: undefined })); }}
                />
                {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className={labelClass}>
                <User className="h-4 w-4" /> Username
              </label>
              <input
                placeholder="unique_username"
                value={form.username}
                className={`${inputClass} ${errors.username ? 'border-red-400 focus:ring-red-200' : ''}`}
                onChange={e => { setForm({ ...form, username: e.target.value }); setErrors(p => ({ ...p, username: undefined })); }}
              />
              {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
            </div>

            {/* Password */}
            <div>
              <label className={labelClass}>
                <Lock className="h-4 w-4" /> Password
              </label>
              <input
                type="password"
                placeholder="********"
                value={form.password}
                className={`${inputClass} ${errors.password ? 'border-red-400 focus:ring-red-200' : ''}`}
                onChange={e => { setForm({ ...form, password: e.target.value }); setErrors(p => ({ ...p, password: undefined })); }}
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className={labelClass}>
                <Lock className="h-4 w-4" /> Confirm Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="********"
                  value={form.password_confirm}
                  className={`${inputClass} pr-9 ${errors.password_confirm ? 'border-red-400 focus:ring-red-200' : ''}`}
                  onChange={e => { setForm({ ...form, password_confirm: e.target.value }); setErrors(p => ({ ...p, password_confirm: undefined })); }}
                />
                {form.password.length >= 4 && form.password_confirm && form.password === form.password_confirm && (
                  <CheckCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
              </div>
              {errors.password_confirm && <p className="text-xs text-red-500 mt-1">{errors.password_confirm}</p>}
            </div>

            {/* Generic submit error */}
            {errors.submit && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {errors.submit}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t">
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="px-6 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={acceptMutation.isPending}
              className="px-6 py-2 rounded-md bg-[#1a1f2e] text-white text-sm hover:bg-[#252b3d] transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {acceptMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                : 'Create Account'
              }
            </button>
          </div>

        </div>
      )}

    </div>
  );
}