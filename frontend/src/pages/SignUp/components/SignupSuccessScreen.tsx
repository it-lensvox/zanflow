import type { SignupProductKey } from '@/types';

const PRODUCT_NAMES: Record<SignupProductKey, string> = {
  pm:   'Project Management',
  hrms: 'HRMS',
  crm:  'CRM',
  ims:  'IMS',
};

interface Props {
  platforms: SignupProductKey[];
}

export function SignupSuccessScreen({ platforms }: Props) {
  return (
    <div className="text-center space-y-6 py-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">🎉 Welcome to Dyuksa!</h2>
        <p className="text-sm text-muted-foreground">Your account is ready.</p>
      </div>
      {platforms.length > 0 && (
        <div className="bg-muted rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            You now have access to:
          </p>
          {platforms.map(p => (
            <div key={p} className="flex items-center gap-2 text-sm font-medium">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {PRODUCT_NAMES[p] ?? p.toUpperCase()}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Redirecting to your dashboard…</p>
    </div>
  );
}