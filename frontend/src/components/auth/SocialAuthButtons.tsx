// Reusable OAuth button group for Login and Signup pages.

import { GoogleLogin } from '@react-oauth/google';

interface SocialAuthButtonsProps {
  mode: 'login' | 'signup';
  isLoading: boolean;
  onGoogleSuccess: (credential: string) => void;
  onGoogleError: () => void;
  onMicrosoftClick: () => void;
}

export function SocialAuthButtons({
  mode,
  isLoading,
  onGoogleSuccess,
  onGoogleError,
  onMicrosoftClick,
}: SocialAuthButtonsProps) {
  const label = mode === 'login' ? 'Sign in' : 'Sign up';

  return (
    <div className="w-full space-y-3">
      {/* Divider — uses existing border/muted-foreground tokens */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground shrink-0">or continue with</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Google — uses the official GoogleLogin component which returns id_token */}
      <div className="flex justify-center">
        <GoogleLogin
  onSuccess={(credentialResponse) => {
    if (credentialResponse.credential) {
      onGoogleSuccess(credentialResponse.credential);
    }
  }}
  onError={onGoogleError}
  text={mode === 'login' ? 'signin_with' : 'signup_with'}
  shape="rectangular"
  theme="outline"
  width="100%"
/>
      </div>

      {/* Microsoft */}
      <button
        type="button"
        onClick={onMicrosoftClick}
        disabled={isLoading}
        className="
          w-full flex items-center justify-center gap-2
          h-10 px-4 rounded-md
          border border-input bg-background
          text-sm font-medium text-foreground
          hover:bg-accent hover:text-accent-foreground
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        "
      >
        {/* Microsoft SVG logo — official brand asset, inline to avoid external requests */}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        {label} with Microsoft
      </button>
    </div>
  );
}