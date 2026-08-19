import { Input } from '@/components/common';
import { Button } from '@/components/common';

interface Props {
  adminEmail: string;
  error: string;
  otpSending: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onNavigateLogin: () => void;
}

export function SignupStepEmail({ adminEmail, error, otpSending, onChange, onSubmit, onNavigateLogin }: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      <Input
        id="admin_email"
        type="email"
        value={adminEmail}
        onChange={e => onChange(e.target.value)}
        placeholder="Work Email"
        required
        autoFocus
      />
      <Button type="submit" className="w-full" disabled={otpSending}>
        {otpSending ? 'Sending OTP…' : 'Continue'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button type="button" onClick={onNavigateLogin} className="text-primary hover:underline font-medium">
          Sign in
        </button>
      </p>
    </form>
  );
}