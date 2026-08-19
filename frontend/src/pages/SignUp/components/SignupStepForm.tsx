import { useState } from 'react';
import { Input } from '@/components/common';
import { Button } from '@/components/common';

interface Props {
  adminEmail: string;
  companyName: string;
  password: string;
  passwordConfirm: string;
  otp: string;
  error: string;
  isSubmitting: boolean;
  countdown: number;
  onChange: (field: 'companyName' | 'password' | 'passwordConfirm' | 'otp', value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResendOtp: () => void;
  onBack: () => void;
  onNavigateLogin: () => void;
}

export function SignupStepForm({
  adminEmail, companyName, password, passwordConfirm, otp,
  error, isSubmitting, countdown,
  onChange, onSubmit, onResendOtp, onBack, onNavigateLogin,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const EyeIcon = ({ visible }: { visible: boolean }) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {visible ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </>
      )}
    </svg>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Input
        type="text"
        value={companyName}
        onChange={e => onChange('companyName', e.target.value)}
        placeholder="Company Name"
        required
        autoComplete="off"
      />

      {/* Email display with edit */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted">
        <span className="flex-1 text-sm truncate text-muted-foreground">{adminEmail}</span>
        <button type="button" onClick={onBack} className="text-xs text-primary hover:underline flex-shrink-0">
          Edit
        </button>
      </div>

      {/* Password */}
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => onChange('password', e.target.value)}
          placeholder="Password"
          required
          autoComplete="new-password"
          className="pr-10"
        />
        <button type="button" onClick={() => setShowPassword(p => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <EyeIcon visible={showPassword} />
        </button>
      </div>

      {/* Confirm Password */}
      <div className="relative">
        <Input
          type={showPasswordConfirm ? 'text' : 'password'}
          value={passwordConfirm}
          onChange={e => onChange('passwordConfirm', e.target.value)}
          placeholder="Confirm Password"
          required
          autoComplete="new-password"
          className="pr-10"
        />
        <button type="button" onClick={() => setShowPasswordConfirm(p => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <EyeIcon visible={showPasswordConfirm} />
        </button>
      </div>

      {/* OTP */}
      <div className="space-y-1">
        <Input
          type="text"
          value={otp}
          onChange={e => onChange('otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Enter 6-digit OTP"
          maxLength={6}
          required
          inputMode="numeric"
        />
        <div className="text-right">
          {countdown > 0 ? (
            <span className="text-xs text-muted-foreground">Resend OTP in {countdown}s</span>
          ) : (
            <button type="button" onClick={onResendOtp} className="text-xs text-primary hover:underline">
              Resend OTP
            </button>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create Account'}
      </Button>

      <button type="button" onClick={onBack}
        className="w-full text-center text-sm text-muted-foreground hover:underline">
        ← Back
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button type="button" onClick={onNavigateLogin} className="text-primary hover:underline font-medium">
          Sign in
        </button>
      </p>
    </form>
  );
}