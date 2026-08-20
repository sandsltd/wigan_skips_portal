'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Send, X } from 'lucide-react';

import type { Account } from './AccountSelector';
import { SERVICE_TYPES, formatServiceType, type ServiceType } from '@/lib/serviceRequest';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
}

export default function ServiceRequestModal({
  isOpen,
  onClose,
  account,
}: ServiceRequestModalProps) {
  const [serviceType, setServiceType] = useState<ServiceType>('collection');
  const [description, setDescription] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setServiceType('collection');
      setDescription('');
      setAdditionalInfo('');
      setSubmitting(false);
      setSubmitted(false);
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/request-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerReference: account.reference,
          serviceType,
          description,
          additionalInfo,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'The service request could not be sent');
      }
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The service request could not be sent');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-request-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
              <div>
                <h2 id="service-request-title" className="text-lg font-bold text-gray-900">Request a service</h2>
                <p className="mt-1 text-sm text-gray-500">For {account.name}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Close service request"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {submitted ? (
              <div className="px-6 py-10 text-center">
                <CheckCircle2 size={52} className="mx-auto text-emerald-500" />
                <h3 className="mt-4 text-xl font-bold text-gray-900">Request submitted</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  The team has received your request and will contact you to confirm the details.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-gray-800">Service type</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {SERVICE_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setServiceType(type)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          serviceType === type
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {formatServiceType(type)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">
                    What is being collected, delivered or exchanged?
                  </span>
                  <textarea
                    required
                    maxLength={2_000}
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="For example: collect one full skip and deliver one empty skip"
                    className="mt-2 w-full resize-y rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Additional information <span className="font-normal text-gray-400">(optional)</span></span>
                  <textarea
                    maxLength={2_000}
                    rows={3}
                    value={additionalInfo}
                    onChange={(event) => setAdditionalInfo(event.target.value)}
                    placeholder="Access instructions, preferred timing or anything else we should know"
                    className="mt-2 w-full resize-y rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                  />
                </label>

                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
                )}

                <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !description.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {submitting ? 'Sending…' : 'Submit request'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
