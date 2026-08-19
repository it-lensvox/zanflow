import { Card, CardHeader, CardTitle, CardContent } from '@/components/common';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { CompanyNameModal } from '@/components/auth/CompanyNameModal';
import { useSocialAuth } from '@/hooks/useSocialAuth';
import { useSignup } from './hooks/useSignup';
import { SignupStepEmail } from './components/SignupStepEmail';
import { SignupStepForm } from './components/SignupStepForm';
import { SignupStepProducts } from './components/SignupStepProducts';
import { SignupSuccessScreen } from './components/SignupSuccessScreen';
import { AddPlatformDialog } from './components/AddPlatformDialog';
import { useState } from 'react';
import type { SocialProvider } from '@/types';

export function Signup() {
  const {
    step, form, selectedProducts, activatedPlatforms,
    error, otpSending, isSubmitting, isAddingPlatform,
    countdown, emailExistsData, addPlatformPassword,
    updateForm, handleSendOtp, handleVerifyAndProceed,
    toggleProduct, handleGetStarted, handleSkipProducts,
    handleAddPlatform, goBackToStep1, goBackToStep2,
    setAddPlatformPassword, dismissEmailExists, navigate,
  } = useSignup();

  const [pendingOAuthToken, setPendingOAuthToken] = useState<{ provider: SocialProvider; token: string } | null>(null);
  const [oauthModalError, setOauthModalError] = useState<string | null>(null);

  const { isLoading: isSocialLoading, handleGoogleSuccess, handleGoogleError, handleMicrosoftLogin, completeSocialSignup } =
    useSocialAuth({
      mode: 'signup',
      loginWithUser: () => {},
      onTokenReceived: (provider, token) => setPendingOAuthToken({ provider, token }),
    });

  const cardTitle = step === 1 ? 'Create your account'
    : step === 2 ? 'Complete your profile'
    : step === 3 ? 'Choose your products'
    : null;

  const cardSubtitle = step === 1 ? 'Set up your organisation on DYUKSA'
    : step === 2 ? 'Enter your details and verify your email'
    : step === 3 ? null
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">

      {/* Email already exists dialog */}
      {emailExistsData && (
        <AddPlatformDialog
          data={emailExistsData}
          email={form.adminEmail}
          existingPassword={form.password}
          addPlatformPassword={addPlatformPassword}
          isLoading={isAddingPlatform}
          onPasswordChange={setAddPlatformPassword}
          onConfirm={handleAddPlatform}
          onDismiss={dismissEmailExists}
          onGoToLogin={() => navigate('/login')}
        />
      )}

      <Card className="w-full max-w-md">
        {step !== 'success' && cardTitle && (
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{cardTitle}</CardTitle>
            {cardSubtitle && <p className="text-muted-foreground">{cardSubtitle}</p>}
          </CardHeader>
        )}

        <CardContent>
          {step === 1 && (
            <>
              <SignupStepEmail
                adminEmail={form.adminEmail}
                error={error}
                otpSending={otpSending}
                onChange={v => updateForm('adminEmail', v)}
                onSubmit={handleSendOtp}
                onNavigateLogin={() => navigate('/login')}
              />
              <div className="mt-4">
                <SocialAuthButtons
                  mode="signup"
                  isLoading={isSocialLoading}
                  onGoogleSuccess={handleGoogleSuccess}
                  onGoogleError={handleGoogleError}
                  onMicrosoftClick={handleMicrosoftLogin}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <SignupStepForm
              adminEmail={form.adminEmail}
              companyName={form.companyName}
              password={form.password}
              passwordConfirm={form.passwordConfirm}
              otp={form.otp}
              error={error}
              isSubmitting={isSubmitting}
              countdown={countdown}
              onChange={(field, value) => updateForm(field, value)}
              onSubmit={handleVerifyAndProceed}
              onResendOtp={() => handleSendOtp()}
              onBack={goBackToStep1}
              onNavigateLogin={() => navigate('/login')}
            />
          )}

          {step === 3 && (
            <SignupStepProducts
              selectedProducts={selectedProducts}
              isSubmitting={isSubmitting}
              onToggle={toggleProduct}
              onGetStarted={handleGetStarted}
              onSkip={handleSkipProducts}
              onBack={goBackToStep2}
            />
          )}

          {step === 'success' && (
            <SignupSuccessScreen platforms={activatedPlatforms} />
          )}
        </CardContent>
      </Card>

      {/* OAuth company name modal */}
      <CompanyNameModal
        isOpen={!!pendingOAuthToken}
        provider={pendingOAuthToken?.provider ?? null}
        isLoading={isSocialLoading}
        backendError={oauthModalError}
        onClearBackendError={() => setOauthModalError(null)}
        onConfirm={async (companyName) => {
          if (!pendingOAuthToken) return;
          const err = await completeSocialSignup(pendingOAuthToken.provider, pendingOAuthToken.token, companyName);
          if (err) { setOauthModalError(err); }
          else { setPendingOAuthToken(null); setOauthModalError(null); }
        }}
        onCancel={() => { setPendingOAuthToken(null); setOauthModalError(null); }}
      />
    </div>
  );
}