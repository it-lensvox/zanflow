import { useState, useCallback, useRef, useEffect } from 'react';

interface UseCopyToClipboardOptions {
  resetDelay?: number;
}

interface UseCopyToClipboardResult {
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
}

export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardResult {
  const { resetDelay = 2000 } = options;
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for older browsers / non-HTTPS contexts.
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }

        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), resetDelay);
        return true;
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        setCopied(false);
        return false;
      }
    },
    [resetDelay]
  );

  // Clean up the pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { copied, copy };
}

export default useCopyToClipboard;