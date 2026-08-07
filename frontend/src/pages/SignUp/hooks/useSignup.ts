import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, startProactiveRefresh } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type {
  SignupStep,
  SignupProductKey,
  SignupEmailExistsResponse,
} from '@/types';

interface SignupForm {
  adminEmail: string;
  companyName: string;
  password: string;
  passwordConfirm: string;
  otp: string;
}

export function useSignup() {
  const navigate = useNavigate();
  const { loginWithUser } = useAuth();

  const [step, setStep] = useState<SignupStep>(1);
  const [form, setForm] = useState<SignupForm>({
    adminEmail: '',
    companyName: '',
    password: '',
    passwordConfirm: '',
    otp: '',
  });
  const [selectedProducts, setSelectedProducts] = useState<SignupProductKey[]>(['pm']);
  const [activatedPlatforms, setActivatedPlatforms] = useState<SignupProductKey[]>([]);
  const [error, setError] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingPlatform, setIsAddingPlatform] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [emailExistsData, setEmailExistsData] = useState<SignupEmailExistsResponse | null>(null);
  const [addPlatformPassword, setAddPlatformPassword] = useState('');

  // Reset form on mount
  useEffect(() => {
    setForm({ adminEmail: '', companyName: '', password: '', passwordConfirm: '', otp: '' });
    setStep(1);
    setError('');
    setCountdown(0);
    setSelectedProducts(['pm']);
  }, []);

  const updateForm = useCallback((field: keyof SignupForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  }, [error]);

  const startCountdown = useCallback((seconds = 120) => {
    setCountdown(seconds);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendOtp = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setOtpSending(true);
    try {
      await authApi.sendOtp(form.adminEmail);
      setStep(2);
      startCountdown();
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const isAlreadyExists =
        status === 409 ||
        (status === 400 && (
          data?.code === 'EMAIL_ALREADY_EXISTS' ||
          (data?.detail || data?.email?.[0] || '').toLowerCase().includes('already exist')
        ));
      if (isAlreadyExists) {
        setEmailExistsData(data);
        return;
      }
      setError(data?.detail || data?.email?.[0] || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  }, [form.adminEmail, startCountdown]);

  const handleVerifyAndProceed = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    // Go to product selection screen
    setStep(3);
  }, [form.password, form.passwordConfirm]);

  const toggleProduct = useCallback((key: SignupProductKey) => {
    if (key === 'pm') return; // PM is locked — cannot uncheck
    setSelectedProducts(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  }, []);

  const handleSignup = useCallback(async (products: SignupProductKey[]) => {
    setError('');
    setIsSubmitting(true);
    try {
      const response = await authApi.register({
        company_name: form.companyName,
        admin_email: form.adminEmail,
        password: form.password,
        password_confirm: form.passwordConfirm,
        otp: form.otp,
        platform: 'pm',
        products,
      });
      startProactiveRefresh();
      setActivatedPlatforms(response.platforms || ['pm']);
      setStep('success');
      setTimeout(() => { window.location.href = '/dashboard'; }, 3000);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && data?.code === 'EMAIL_ALREADY_EXISTS') {
        setEmailExistsData(data);
        setStep(2);
        return;
      }
      setError(
        data?.otp?.[0] ||
        data?.detail ||
        data?.admin_email?.[0] ||
        data?.company_name?.[0] ||
        'Registration failed. Please try again.'
      );
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  }, [form]);

  const handleGetStarted = useCallback(() => {
    handleSignup(selectedProducts);
  }, [selectedProducts, handleSignup]);

  const handleSkipProducts = useCallback(() => {
    handleSignup(['pm']);
  }, [handleSignup]);

  const handleAddPlatform = useCallback(async () => {
    const pwd = addPlatformPassword || form.password;
    if (!pwd) {
      setError('Please enter your password to continue.');
      return;
    }
    setIsAddingPlatform(true);
    try {
      const data = await authApi.addPlatform(
        emailExistsData ? form.adminEmail : form.adminEmail,
        pwd,
        'pm'
      );
      startProactiveRefresh();
      setEmailExistsData(null);
      setAddPlatformPassword('');
      setActivatedPlatforms(data.platforms || ['pm']);
      setStep('success');
      setTimeout(() => { window.location.href = '/dashboard'; }, 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to add PM. Please check your password.');
      setEmailExistsData(null);
      setAddPlatformPassword('');
    } finally {
      setIsAddingPlatform(false);
    }
  }, [addPlatformPassword, form.adminEmail, form.password, emailExistsData]);

  const goBackToStep1 = useCallback(() => {
    setStep(1);
    setError('');
    setForm(prev => ({ ...prev, otp: '' }));
    setCountdown(0);
  }, []);

  const goBackToStep2 = useCallback(() => {
    setStep(2);
    setError('');
  }, []);

  const dismissEmailExists = useCallback(() => {
    setEmailExistsData(null);
    setAddPlatformPassword('');
    setError('');
  }, []);

  return {
    // state
    step,
    form,
    selectedProducts,
    activatedPlatforms,
    error,
    otpSending,
    isSubmitting,
    isAddingPlatform,
    countdown,
    emailExistsData,
    addPlatformPassword,
    // actions
    updateForm,
    handleSendOtp,
    handleVerifyAndProceed,
    toggleProduct,
    handleGetStarted,
    handleSkipProducts,
    handleAddPlatform,
    goBackToStep1,
    goBackToStep2,
    setAddPlatformPassword,
    dismissEmailExists,
    navigate,
  };
}