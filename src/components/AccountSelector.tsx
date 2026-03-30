'use client';

import { motion } from 'framer-motion';
import { Building2, User, MapPin, ChevronRight, LogOut } from 'lucide-react';
import SuccessAnimation from './SuccessAnimation';

export interface Account {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  reference: string;
  email: string;
  phone?: string;
  phone2?: string;
  billingAddress?: string;
  billingCity?: string;
  billingPostcode?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingPostcode?: string;
  collectionAddress?: string;
  collectionCity?: string;
  collectionPostcode?: string;
  customerType?: string;
  paymentTerms?: string;
  customerSince?: string;
  what3words?: string;
  specialInstructions?: string;
}

interface AccountSelectorProps {
  accounts: Account[];
  email: string;
  onSelectAccount: (account: Account) => void;
  onLogout: () => void;
}

export default function AccountSelector({
  accounts,
  email,
  onSelectAccount,
  onLogout,
}: AccountSelectorProps) {
  // Determine if account is a business (has business-like name)
  const isBusinessAccount = (account: Account) => {
    const name = account.name.toLowerCase();
    return (
      name.includes('ltd') ||
      name.includes('limited') ||
      name.includes('plc') ||
      name.includes('inc') ||
      name.includes('corp') ||
      name.includes('llc') ||
      name.includes('(')
    );
  };

  // Get display address (prefer collection, then shipping, then billing)
  const getDisplayAddress = (account: Account) => {
    const address = account.collectionAddress || account.shippingAddress || account.billingAddress;
    if (!address) return null;
    // Take first two lines of address for display
    const lines = address.split('\n').filter(line => line.trim());
    return lines.slice(0, 2).join(', ');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md"
    >
      {/* Success animation - only show briefly */}
      <div className="flex justify-center mb-2">
        <SuccessAnimation size={80} />
      </div>

      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-charcoal)]">
          Welcome back!
        </h2>
        <p className="mt-2 text-[var(--color-stone)] text-sm sm:text-base">
          Select an account to continue
        </p>
        <p className="text-xs sm:text-sm text-[var(--color-stone)] mt-1 truncate px-4">
          Signed in as <span className="font-medium">{email}</span>
        </p>
      </div>

      {/* Account list */}
      <div className="space-y-2 sm:space-y-3">
        {accounts.map((account, index) => {
          const isBusiness = isBusinessAccount(account);
          const displayAddress = getDisplayAddress(account);

          return (
            <motion.button
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelectAccount(account)}
              className="
                w-full p-3 sm:p-4 text-left
                bg-white/70 backdrop-blur
                border-2 border-[var(--color-sand)]
                rounded-lg sm:rounded-xl rounded-br-sm
                hover:border-[var(--color-primary)] hover:shadow-lg
                hover:shadow-[var(--color-primary)]/10
                active:scale-[0.98]
                transition-all duration-200
                group touch-manipulation
              "
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`
                  w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isBusiness
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  }
                `}>
                  {isBusiness ? <Building2 size={18} className="sm:w-5 sm:h-5" /> : <User size={18} className="sm:w-5 sm:h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--color-charcoal)] truncate text-sm sm:text-base">
                      {account.name}
                    </h3>
                    {account.reference && (
                      <span className="text-xs text-[var(--color-stone)] bg-[var(--color-sand)] px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">
                        {account.reference}
                      </span>
                    )}
                  </div>

                  {displayAddress && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs sm:text-sm text-[var(--color-stone)]">
                      <MapPin size={14} className="flex-shrink-0" />
                      <span className="truncate">{displayAddress}</span>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight
                  size={20}
                  className="text-[var(--color-stone)] group-hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Account count */}
      <p className="text-center text-xs sm:text-sm text-[var(--color-stone)] mt-4 sm:mt-6">
        {accounts.length} account{accounts.length !== 1 ? 's' : ''} found
      </p>

      {/* Logout button */}
      <button
        onClick={onLogout}
        className="flex items-center gap-2 mx-auto mt-4 sm:mt-6 p-2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors touch-manipulation"
      >
        <LogOut size={18} />
        <span className="text-sm">Sign out</span>
      </button>
    </motion.div>
  );
}
