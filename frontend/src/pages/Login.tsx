import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/common';
import { getCredentials } from '@/services/authStorage';
import { authApi } from '@/services/api';

// Toast Notification Component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-5 duration-300">
      <div className={`rounded-lg shadow-lg p-4 min-w-[300px] max-w-md ${type === 'success'
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'
        }`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}>
            {type === 'success' ? (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${type === 'success' ? 'text-green-900' : 'text-red-900'
              }`}>
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`flex-shrink-0 ${type === 'success'
                ? 'text-green-400 hover:text-green-600'
                : 'text-red-400 hover:text-red-600'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { login } = useAuth();
  const savedCredentials = getCredentials();
  const [username, setUsername] = useState(savedCredentials?.username || '');
  const [password, setPassword] = useState(savedCredentials?.password || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSendOTP = async () => {
    try {
      await authApi.forgotPassword(forgotEmail);
      showToast("OTP sent successfully to your email", "success");
    } catch (err) {
      showToast("Failed to send OTP. Please check your email.", "error");
    }
  }

  const handleVerifyOTP = async () => {
    try {
      const data = await authApi.verifyOTP(forgotEmail, otp);
      setResetToken(data.reset_token);
      showToast("OTP verified successfully!", "success");
      setStep(2);
    } catch (err) {
      showToast("Invalid OTP. Please try again.", "error");
      console.error("Error verifying OTP:", err);
    }
  }

  const handleSetNewPassword = async () => {
    try {
      await authApi.setNewPassword({
        email: forgotEmail,
        reset_token: resetToken,
        password: newPassword,
        password_confirm: confirmPassword
      });
      showToast("Password has been reset successfully!", "success");
      setTimeout(() => {
        setShowForgotPassword(false);
        setStep(1);
        setForgotEmail('');
        setOtp('');
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (err) {
      showToast("Failed to reset password. Ensure passwords match.", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      queryClient.clear();
      await login(username, password);
    } catch {
      setError('Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome To DYUKSA</CardTitle>
          <p className="text-muted-foreground">
            Sign in to your account to continue
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Email or Username"
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="text-primary hover:underline font-bold"
              >
                Sign Up
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center relative">
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setStep(1);
                  setForgotEmail('');
                  setOtp('');
                  setResetToken('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              >✕</button>
              <CardTitle className="text-2xl">
                {step === 1 ? 'Forgot Password' : 'Create New Password'}
              </CardTitle>
              <p className="text-muted-foreground">
                {step === 1 ? 'Verify your identity' : 'Set your new secure password'}
              </p>
            </CardHeader>
            <CardContent>
              {step === 1 ? (
                /* Form 1: OTP Flow */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your Email</label>
                    <div className="flex gap-2">
                      <Input placeholder="user@example.com" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                      <Button variant="outline" type="button" onClick={handleSendOTP} disabled={!forgotEmail}>Send OTP</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enter OTP</label>
                    <div className="flex gap-2 items-center">
                      <Input placeholder="4-digit code" maxLength={4} className="text-center tracking-widest" value={otp} onChange={(e) => setOtp(e.target.value)} />
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    disabled={otp.length < 4}
                    onClick={handleVerifyOTP}
                  >
                    Continue
                  </Button>
                </div>
              ) : (
                /* Form 2: New Password */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm Password</label>
                    <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={handleSetNewPassword}
                    disabled={!newPassword || newPassword !== confirmPassword}
                  >
                    Submit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}