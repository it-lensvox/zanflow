import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

export function ResetPassword() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // State to track visibility for each field
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    old_password: '',
    new_password: '',
    confirm_new_password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (formData.new_password !== formData.confirm_new_password) {
      setError("New passwords do not match");
      return;
    }

    try {
      setLoading(true);
      await authApi.resetPassword({
        username: user?.username || '', 
        ...formData
      });
      setSuccess(true);
      setFormData({ old_password: '', new_password: '', confirm_new_password: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to render the eye icon button
  const ToggleVisibility = ({ isVisible, setVisible }: { isVisible: boolean, setVisible: (v: boolean) => void }) => (
    <button
      type="button"
      onClick={() => setVisible(!isVisible)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition"
    >
      {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-medium">Password updated successfully!</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showOldPassword ? "text" : "password"}
                required
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                value={formData.old_password}
                onChange={(e) => setFormData({...formData, old_password: e.target.value})}
              />
              <ToggleVisibility isVisible={showOldPassword} setVisible={setShowOldPassword} />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showNewPassword ? "text" : "password"}
                required
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                value={formData.new_password}
                onChange={(e) => setFormData({...formData, new_password: e.target.value})}
              />
              <ToggleVisibility isVisible={showNewPassword} setVisible={setShowNewPassword} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                value={formData.confirm_new_password}
                onChange={(e) => setFormData({...formData, confirm_new_password: e.target.value})}
              />
              <ToggleVisibility isVisible={showConfirmPassword} setVisible={setShowConfirmPassword} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-300 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-400"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}