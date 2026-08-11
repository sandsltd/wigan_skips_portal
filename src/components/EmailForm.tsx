'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, Loader2, XCircle } from 'lucide-react';

interface EmailFormProps {
  onPinSent: (email: string) => void;
}

export default function EmailForm({ onPinSent }: EmailFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const pinResponse = await fetch('/api/send-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email: email.trim() }),
      });

      const pinData = await pinResponse.json();

      if (!pinResponse.ok) {
        throw new Error(pinData.error || 'Failed to send verification code');
      }

      onPinSent(email.trim().toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="w-full max-w-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <form onSubmit={handleSubmit}>
        <div
          className={`
            relative flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 pl-4 sm:pl-5
            bg-white/70 backdrop-blur-xl
            rounded-xl sm:rounded-2xl rounded-br-sm
            border-2 transition-all duration-300
            ${error
              ? 'border-red-400'
              : isFocused
                ? 'border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/10'
                : 'border-[var(--color-sand)] shadow-md'
            }
          `}
        >
          <Mail
            size={20}
            className={`flex-shrink-0 transition-colors duration-300 ${
              error
                ? 'text-red-400'
                : isFocused
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-stone)]'
            }`}
          />

          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isLoading}
            className="
              flex-1 py-3 bg-transparent outline-none min-w-0
              text-[var(--color-charcoal)] placeholder:text-[var(--color-stone)]
              text-base
            "
            required
          />

          <motion.button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="
              flex items-center justify-center flex-shrink-0
              w-11 h-11 sm:w-12 sm:h-12
              bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)]
              disabled:bg-[var(--color-stone)] disabled:cursor-not-allowed
              text-white rounded-lg sm:rounded-xl rounded-br-sm
              transition-colors duration-300
              touch-manipulation
            "
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ArrowRight size={20} />
            )}
          </motion.button>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3"
          >
            <XCircle className="text-red-500 flex-shrink-0" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            className="mt-4 text-sm text-[var(--color-stone)] text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            If your email is registered, we&apos;ll send a secure PIN
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
