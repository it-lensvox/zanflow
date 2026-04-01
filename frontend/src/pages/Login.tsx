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
  const [showPassword, setShowPassword] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error', autoClose: boolean = true) => {
    setToast({ message, type });
    if (autoClose) {
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleSendOTP = async () => {
    // 1. Show the success message immediately when the button is clicked
    showToast("If this email is registered, an OTP has been sent.", "success", false);
    
    try {
      // 2. Perform the 5-6 second API call in the background
      await authApi.forgotPassword(forgotEmail);
    } catch (err: any) {
      // 3. Only update the UI again if the network request actually fails
      const errorMessage = err?.response?.data?.detail || "Failed to process request. Please try again.";
      showToast(errorMessage, "error");
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
            <div className="space-y-2 relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.52-3.4m4.68-1.68c1.07-.66 2.34-1.04 3.68-1.04 4.478 0 8.268 2.943 9.542 7a10.06 10.06 0 01-1.38 3.02m-7.23-3.64l-4.5 4.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  </svg>
                )}
              </button>
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
                  setToast(null);
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
              {/* Inline Notification */}
              {toast && (
                <div className={`mb-4 flex items-start gap-3 rounded-lg p-3 animate-in fade-in zoom-in duration-200 ${
                  toast.type === 'success' 
                    ? 'bg-green-50 text-green-900 border border-green-200' 
                    : 'bg-red-50 text-red-900 border border-red-200'
                }`}>
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {toast.type === 'success' ? (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    )}
                  </div>
                  <div className="flex-1 text-sm font-medium mt-0.5">{toast.message}</div>
                  <button onClick={() => setToast(null)} className={`flex-shrink-0 mt-0.5 ${
                    toast.type === 'success' ? 'text-green-400 hover:text-green-600' : 'text-red-400 hover:text-red-600'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

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
                      <Input 
                        placeholder="4-digit code" 
                        maxLength={4} 
                        className="text-center tracking-widest" 
                        value={otp} 
                        onChange={(e) => {
                          setOtp(e.target.value);
                          // Clear the success message as soon as the user starts typing
                          if (toast?.type === 'success') {
                            setToast(null);
                          }
                        }} 
                      />
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