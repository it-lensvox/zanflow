// Shown only on the Signup page after OAuth token is received.

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/common/diaog'; 
import { Button } from '@/components/common/Button'; 
import { Input } from '@/components/common/Input'; 
import { Label } from '@/components/common/label';
import type { SocialProvider } from '@/types';

interface CompanyNameModalProps {
  isOpen: boolean;
  provider: SocialProvider | null;
  isLoading: boolean;
  onConfirm: (companyName: string) => void;
  onCancel: () => void;
  backendError?: string | null;
  onClearBackendError?: () => void;
}

export function CompanyNameModal({
  isOpen,
  provider,
  isLoading,
  onConfirm,
  onCancel,
  backendError,
  onClearBackendError,
}: CompanyNameModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [localError, setLocalError] = useState('');

  // Show backend error if present, otherwise show local validation error
  const error = backendError || localError;

  const providerLabel = provider === 'google' ? 'Google' : 'Microsoft';

  function handleConfirm() {
    const trimmed = companyName.trim();
    if (!trimmed) {
      setLocalError('Company name is required.');
      return;
    }
    if (trimmed.length < 2) {
      setLocalError('Company name must be at least 2 characters.');
      return;
    }
    setLocalError('');
    onConfirm(trimmed);
  }

  function handleCancel() {
    setCompanyName('');
    setLocalError('');
    onCancel();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>One more step</DialogTitle>
          <DialogDescription>
            You're signing up with {providerLabel}. Enter your company name to create your Dyuksa workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="company-name">Company name</Label>
          <Input
            id="company-name"
            placeholder="e.g. Acme Corp"
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              if (localError) setLocalError('');
              if (backendError) onClearBackendError?.();
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            disabled={isLoading}
            autoFocus
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !companyName.trim()}
          >
            {isLoading ? 'Creating workspace…' : 'Create workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}