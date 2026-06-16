import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/common';
import { authApi, startProactiveRefresh } from '@/services/api';
import type { OrganizationSignupPayload } from '@/types';

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

export function Signup() {
    const navigate = useNavigate();
    const [companyName, setCompanyName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [otp, setOtp] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    useEffect(() => {
        setCompanyName('');
        setPassword('');
        setPasswordConfirm('');
        setOtp('');
        setStep(1);
        setError('');
        setCountdown(0);
        setShowPassword(false);
        setShowPasswordConfirm(false);
    }, []);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setOtpSending(true);
        try {
            await authApi.sendOtp(adminEmail);
            showToast('OTP sent to your email', 'success');
            setStep(2);
            setCountdown(120);
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) { clearInterval(timer); return 0; }
                    return prev - 1;
                });
            }, 1000);
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.response?.data?.email?.[0] || 'Failed to send OTP');
        } finally {
            setOtpSending(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== passwordConfirm) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            const payload: OrganizationSignupPayload = {
                company_name: companyName,
                admin_email: adminEmail,
                password,
                password_confirm: passwordConfirm,
                otp: otp
            };
            const response = await authApi.register(payload);
            localStorage.setItem('access_token', response.tokens.access);
            localStorage.setItem('refresh_token', response.tokens.refresh);
            startProactiveRefresh();   // ← add this
            showToast('Account created successfully!', 'success');
            setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
        } catch (err: any) {
            const msg =
                err?.response?.data?.otp?.[0] ||
                err?.response?.data?.detail ||
                err?.response?.data?.admin_email?.[0] ||
                err?.response?.data?.company_name?.[0] ||
                'Registration failed. Please try again.';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50">
            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}

            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Create your account</CardTitle>
                    <p className="text-muted-foreground">Set up your organisation on DYUKSA</p>
                </CardHeader>

                <CardContent>
                    <form onSubmit={step === 1 ? handleSendOtp : handleSubmit} className="space-y-4" autoComplete="off">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {/* ── Step 1 — Email only ── */}
                        {step === 1 && (
                            <div className="space-y-2">
                                <Input
                                    id="admin_email"
                                    type="email"
                                    value={adminEmail}
                                    onChange={e => setAdminEmail(e.target.value)}
                                    placeholder="Work Email"
                                    required
                                />
                            </div>
                        )}

                        {/* ── Step 2 — Full form ── */}
                        {step === 2 && (
                            <>
                                <div className="space-y-2">
                                    <Input
                                        id="company_name"
                                        type="text"
                                        value={companyName}
                                        onChange={e => setCompanyName(e.target.value)}
                                        placeholder="Company Name"
                                        required
                                        autoComplete="off"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted">
                                        <span className="flex-1 text-sm truncate text-muted-foreground">{adminEmail}</span>
                                        <button
                                            type="button"
                                            onClick={() => { setStep(1); setError(''); setOtp(''); setCountdown(0); }}
                                            className="text-xs text-primary hover:underline flex-shrink-0"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Password"
                                            required
                                            autoComplete="off"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(prev => !prev)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2"> 
                                    <div className="relative">
                                        <input
                                            id="password_confirm"
                                            type={showPasswordConfirm ? 'text' : 'password'}
                                            value={passwordConfirm}
                                            onChange={e => setPasswordConfirm(e.target.value)}
                                            placeholder="Confirm Password"
                                            required
                                            autoComplete="off"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswordConfirm(prev => !prev)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswordConfirm ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* OTP field with resend */}
                                <div className="space-y-2">
                                    <Input
                                        id="otp"
                                        type="text"
                                        value={otp}
                                        onChange={e => setOtp(e.target.value.replace(/\D/, '').slice(0, 6))}
                                        placeholder="Enter 6-digit OTP"
                                        maxLength={6}
                                        required
                                    />
                                    <div className="text-right">
                                        {countdown > 0 ? (
                                            <span className="text-xs text-muted-foreground">
                                                Resend OTP in {countdown}s
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                Resend OTP
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        <Button type="submit" className="w-full" disabled={isLoading || otpSending}>
                            {step === 1
                                ? (otpSending ? 'Sending OTP…' : 'Continue')
                                : (isLoading ? 'Creating account…' : 'Create Account')
                            }
                        </Button>

                        {step === 2 && (
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); setOtp(''); }}
                                className="w-full text-center text-sm text-muted-foreground hover:underline"
                            >
                                ← Back
                            </button>
                        )}

                        <p className="text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="text-primary hover:underline font-medium"
                            >
                                Sign in
                            </button>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}