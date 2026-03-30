'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Mail, Globe } from 'lucide-react';
import { useBusinessConfig } from '@/lib/BusinessConfigContext';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const config = useBusinessConfig();

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
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="px-6 py-5 text-white"
                style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-primary-light))` }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Contact Support</h2>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-white/80 text-sm mt-1">
                  Get in touch with {config.businessName}
                </p>
              </div>

              {/* Contact options */}
              <div className="p-5 space-y-3">
                {config.phoneNumber && (
                  <a
                    href={`tel:${config.phoneNumber.replace(/\s/g, '')}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                      <Phone size={18} className="text-[var(--color-primary)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Call us</p>
                      <p className="text-sm text-gray-500">{config.phoneNumber}</p>
                    </div>
                  </a>
                )}

                {config.emailAddress && (
                  <a
                    href={`mailto:${config.emailAddress}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Mail size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email us</p>
                      <p className="text-sm text-gray-500">{config.emailAddress}</p>
                    </div>
                  </a>
                )}

                {config.websiteUrl && (
                  <a
                    href={config.websiteUrl.startsWith('http') ? config.websiteUrl : `https://${config.websiteUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Globe size={18} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Visit website</p>
                      <p className="text-sm text-gray-500">{config.websiteUrl}</p>
                    </div>
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
