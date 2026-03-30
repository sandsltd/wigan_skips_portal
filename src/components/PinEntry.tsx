'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import EmailSentAnimation from './EmailSentAnimation';

import type { Account } from './AccountSelector';

interface PinEntryProps {
  email: string;
  onVerified: (accounts: Account[]) => void;
  onBack: () => void;
}

export default function PinEntry({ email, onVerified, onBack }: PinEntryProps) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    // Only allow alphanumeric
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length > 1) return;

    const newPin = [...pin];
    newPin[index] = cleaned;
    setPin(newPin);
    setError(null);

    // Move to next input
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (cleaned && index === 5) {
      const fullPin = [...newPin.slice(0, 5), cleaned].join('');
      if (fullPin.length === 6) {
        handleVerify(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newPin = pasted.split('');
      setPin(newPin);
      handleVerify(pasted);
    }
  };

  const handleVerify = async (pinCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin: pinCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      onVerified(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);

    try {
      const response = await fetch('/api/send-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend');
      }

      setResendCooldown(60); // 60 second cooldown
      setPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-md"
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)] mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back to email</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-center mb-4">
          <EmailSentAnimation size={100} />
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-charcoal)] text-center">
          Check your email
        </h2>
        <p className="mt-2 text-[var(--color-stone)] text-center">
          We&apos;ve sent a 6-character code to<br />
          <span className="font-medium text-[var(--color-charcoal)]">{email}</span>
        </p>
      </div>

      {/* PIN inputs */}
      <div className="flex gap-1.5 sm:gap-2 justify-center mb-6 px-2" onPaste={handlePaste}>
        {pin.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={isLoading}
            className={`
              w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold
              border-2 rounded-lg sm:rounded-xl
              bg-white/70 backdrop-blur
              outline-none transition-all duration-200
              touch-manipulation
              ${error
                ? 'border-red-400 text-red-600'
                : 'border-[var(--color-sand)] focus:border-[var(--color-primary)]'
              }
              disabled:opacity-50
            `}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-600 text-sm text-center mb-4"
        >
          {error}
        </motion.p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-[var(--color-primary)] mb-4">
          <Loader2 size={20} className="animate-spin" />
          <span>Verifying...</span>
        </div>
      )}

      {/* Resend option */}
      <div className="text-center">
        <p className="text-sm text-[var(--color-stone)]">
          Didn&apos;t receive the code?{' '}
          {resendCooldown > 0 ? (
            <span className="text-[var(--color-stone)]">
              Resend in {resendCooldown}s
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={isResending}
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-light)] font-medium transition-colors disabled:opacity-50"
            >
              {isResending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </p>
      </div>

      {/* Expiry notice */}
      <p className="mt-6 text-xs text-[var(--color-stone)] text-center">
        Code expires in 5 minutes
      </p>
    </motion.div>
  );
}
