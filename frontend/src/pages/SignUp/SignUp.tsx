import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/common';
import { authApi } from '@/services/api';
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
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
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
            };
            await authApi.register(payload);
            showToast('Account created successfully! Please sign in to continue.', 'success');
            setTimeout(() => { window.location.href = '/login'; }, 1500);
        } catch (err: any) {
            const msg =
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
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Input
                                id="company_name"
                                type="text"
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                placeholder="Company Name"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Input
                                id="admin_email"
                                type="email"
                                value={adminEmail}
                                onChange={e => setAdminEmail(e.target.value)}
                                placeholder="Email"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Input
                                id="password_confirm"
                                type="password"
                                value={passwordConfirm}
                                onChange={e => setPasswordConfirm(e.target.value)}
                                placeholder="Confirm Password"
                                required
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Creating account…' : 'Sign up'}
                        </Button>

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