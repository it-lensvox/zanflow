import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/common';
import { getCredentials } from '@/services/authStorage';
import { authApi } from '@/services/api';




export function Login() {
  const queryClient = useQueryClient();
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

  const handleSendOTP = async () => {
    try {
      await authApi.forgotPassword(forgotEmail);
      alert("OTP sent successfully to your email");
    } catch (err) {
      alert("Failed to send OTP. Please check your email.");
    }
  }

  const handleVerifyOTP = async () => {
    try {
      const data = await authApi.verifyOTP(forgotEmail, otp);
      setResetToken(data.reset_token);
      alert("OTP verified successfully!");
      setStep(2);
      setStep(2);
    } catch (err) {
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
    alert("Password has been reset successfully!"); // Pop-up 3
    setShowForgotPassword(false);
    setStep(1);
  } catch (err) {
    alert("Failed to reset password. Ensure passwords match.");
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
          <CardTitle className="text-2xl">Welcome to ZanFlow</CardTitle>
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
          </form>
        </CardContent>
      </Card>
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center relative">
              <button
                onClick={() => { setShowForgotPassword(false); setStep(1); }}
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
                    onClick={() => {handleSetNewPassword();}}
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
