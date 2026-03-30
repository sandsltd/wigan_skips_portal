'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, Loader2, CheckCircle2, Building2, User, MapPin, Mail, Phone } from 'lucide-react';
import type { Account } from './AccountSelector';

interface CollectionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  email: string;
}

interface ItemType {
  key: string;
  label: string;
  note?: string;
}

const ITEM_TYPES: ItemType[] = [
  { key: 'desktop_computers', label: 'Desktop Computers' },
  { key: 'laptops', label: 'Laptops' },
  { key: 'tft_monitors', label: 'TFT Monitors' },
  { key: 'crt_monitors', label: 'CRT Monitors', note: '@ £10 per item' },
  { key: 'servers', label: 'Servers' },
  { key: 'networking', label: 'Networking' },
  { key: 'hard_drives', label: 'Hard Drives' },
  { key: 'data_tapes', label: 'Data Tapes' },
  { key: 'flat_screen_tvs', label: 'Flat Screen TVs', note: 'damaged £15' },
  { key: 'tablets_mobiles', label: 'Tablets & Mobiles' },
  { key: 'office_phones', label: 'Office Phones' },
  { key: 'ups_batteries', label: 'UPS Batteries' },
  { key: 'printers_domestic', label: 'Printers (Domestic)' },
  { key: 'printers_commercial', label: 'Printers (Commercial)' },
  { key: 'toner_cartridges', label: 'Toner Cartridges', note: '@ £15 per 25kg box' },
];

export default function CollectionRequestModal({ isOpen, onClose, account, email }: CollectionRequestModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    () => Object.fromEntries(ITEM_TYPES.map(i => [i.key, 0]))
  );
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuantityChange = (key: string, value: string) => {
    const num = parseInt(value) || 0;
    setQuantities(prev => ({ ...prev, [key]: Math.max(0, num) }));
  };

  const hasItems = Object.values(quantities).some(q => q > 0);

  const handleSubmit = async () => {
    if (!hasItems) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/request-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: account.name,
            firstName: account.firstName,
            lastName: account.lastName,
            businessName: account.businessName,
            email: account.email || email,
            phone: account.phone,
            reference: account.reference,
            collectionAddress: account.collectionAddress,
            collectionCity: account.collectionCity,
            collectionPostcode: account.collectionPostcode,
          },
          items: quantities,
          additionalInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form after animation completes
    setTimeout(() => {
      setQuantities(Object.fromEntries(ITEM_TYPES.map(i => [i.key, 0])));
      setAdditionalInfo('');
      setSuccess(false);
      setError(null);
    }, 300);
  };

  const collectionAddress = [
    account.collectionAddress,
    account.collectionCity,
    account.collectionPostcode,
  ].filter(Boolean).join(', ');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-4"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="px-5 sm:px-6 py-4 sm:py-5 text-white"
                style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-primary-light))` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck size={20} />
                    <h2 className="text-lg font-semibold">Request a Collection</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-white/80 text-sm mt-1">
                  Submit a request and we&apos;ll be in touch to confirm
                </p>
              </div>

              {success ? (
                /* Success State */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 sm:p-8 text-center"
                >
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Submitted</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">
                    Thank you for your collection request. We&apos;ll review your request and be in touch to confirm the details and arrange a convenient collection date.
                  </p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    Close
                  </button>
                </motion.div>
              ) : (
                /* Form */
                <div className="max-h-[70vh] overflow-y-auto">
                  {/* Customer Details Summary */}
                  <div className="px-5 sm:px-6 pt-4 sm:pt-5 pb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Details</h3>
                    <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center gap-2.5">
                        {account.businessName ? (
                          <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                        ) : (
                          <User size={14} className="text-gray-400 flex-shrink-0" />
                        )}
                        <span className="text-sm text-gray-700">
                          {account.businessName || account.name}
                          {account.businessName && account.name !== account.businessName && (
                            <span className="text-gray-400 ml-1">({account.name})</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Mail size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{account.email || email}</span>
                      </div>
                      {account.phone && (
                        <div className="flex items-center gap-2.5">
                          <Phone size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{account.phone}</span>
                        </div>
                      )}
                      {collectionAddress && (
                        <div className="flex items-start gap-2.5">
                          <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{collectionAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item Quantities */}
                  <div className="px-5 sm:px-6 pt-3 pb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Item Quantities</h3>
                    <div className="space-y-2">
                      {ITEM_TYPES.map(item => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-3 py-1.5"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700">{item.label}</span>
                            {item.note && (
                              <span className="text-xs text-amber-600 ml-1.5">({item.note})</span>
                            )}
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={quantities[item.key] || ''}
                            onChange={(e) => handleQuantityChange(item.key, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0"
                            className="w-16 sm:w-20 text-center text-sm border border-gray-200 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="px-5 sm:px-6 pt-3 pb-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Additional Information</h3>
                    <textarea
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      placeholder="Any special requirements, access instructions, preferred dates..."
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors resize-none placeholder:text-gray-400"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="px-5 sm:px-6 pb-3">
                      <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                    <button
                      onClick={handleSubmit}
                      disabled={!hasItems || loading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Submitting request...
                        </>
                      ) : (
                        <>
                          <Truck size={18} />
                          Submit Collection Request
                        </>
                      )}
                    </button>
                    {!hasItems && (
                      <p className="text-xs text-gray-400 text-center mt-2">Add at least one item to submit</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
