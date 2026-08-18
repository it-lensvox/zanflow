import type { SignupEmailExistsResponse } from '@/types';

interface Props {
  data: SignupEmailExistsResponse;
  email: string;
  existingPassword: string;
  addPlatformPassword: string;
  isLoading: boolean;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onGoToLogin: () => void;
}

export function AddPlatformDialog({
  data, email, existingPassword, addPlatformPassword,
  isLoading, onPasswordChange, onConfirm, onDismiss, onGoToLogin,
}: Props) {
  const needsPassword = !existingPassword;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Account already exists</h2>
          <p className="text-sm text-muted-foreground">
            <strong>{email}</strong> already has a Dyuksa account.
            Would you like to add <strong>Project Management</strong> to it?
          </p>
        </div>

        {needsPassword && (
          <input
            type="password"
            placeholder="Enter your account password"
            value={addPlatformPassword}
            onChange={e => onPasswordChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-background"
            autoFocus
          />
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={isLoading || (needsPassword && !addPlatformPassword)}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {isLoading ? 'Adding PM…' : 'Yes, add PM to my account'}
          </button>
          <button
            onClick={onGoToLogin}
            className="w-full py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors"
          >
            Go to Login instead
          </button>
          <button
            onClick={onDismiss}
            className="w-full text-center text-xs text-muted-foreground hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}