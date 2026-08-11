'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, FileText, Truck } from 'lucide-react';
import Image from 'next/image';
import FloatingShapes from '@/components/FloatingShapes';
import EmailForm from '@/components/EmailForm';
import PinEntry from '@/components/PinEntry';
import AccountSelector, { type Account } from '@/components/AccountSelector';
import Dashboard from '@/components/Dashboard';
import { BusinessConfigProvider, useBusinessConfig } from '@/lib/BusinessConfigContext';
import ContactModal from '@/components/ContactModal';

const features = [
  { icon: FileText, text: 'Access your documents' },
  { icon: Shield, text: 'Secure portal login' },
  { icon: Truck, text: 'Track your services' },
];

type Step = 'email' | 'pin' | 'accounts' | 'dashboard';

function HomeContent() {
  const config = useBusinessConfig();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showContact, setShowContact] = useState(false);

  const handlePinSent = (sentEmail: string) => {
    setEmail(sentEmail);
    setStep('pin');
  };

  const handleVerified = (verifiedAccounts: Account[]) => {
    setAccounts(verifiedAccounts);
    if (verifiedAccounts.length === 1) {
      setSelectedAccount(verifiedAccounts[0]);
      setStep('dashboard');
    } else {
      setStep('accounts');
    }
  };

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
    setStep('dashboard');
  };

  const handleBackToEmail = () => {
    setStep('email');
    setEmail('');
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setStep('accounts');
  };

  const handleLogout = async () => {
    await fetch('/api/logout', {
      method: 'POST',
      cache: 'no-store',
    }).catch(() => undefined);
    setStep('email');
    setEmail('');
    setAccounts([]);
    setSelectedAccount(null);
  };

  const logoSrc = config.logoUrl || '/logo.png';
  const isRemoteLogo = logoSrc.startsWith('http');

  return (
    <div className="relative min-h-screen overflow-hidden">
      <FloatingShapes />

      {/* Decorative corner accent */}
      <div
        className="absolute top-0 right-0 w-1/3 h-1/2 pointer-events-none"
        style={{
          background: 'linear-gradient(225deg, rgba(26, 58, 47, 0.03) 0%, transparent 60%)',
        }}
      />

      <main className="relative z-10 min-h-screen flex">
        {/* Left section - Branding (hide on dashboard) */}
        {step !== 'dashboard' && (
          <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden" style={{ backgroundColor: '#333333' }}>
            {/* Pattern overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23cc0000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />

            <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full h-full">
              {/* Logo area */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                {isRemoteLogo ? (
                  <img
                    src={logoSrc}
                    alt={config.businessName}
                    style={{ width: 240, height: 'auto' }}
                  />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={config.businessName}
                    width={240}
                    height={85}
                    priority
                  />
                )}
              </motion.div>

              {/* Center content */}
              <div className="flex-1 flex flex-col justify-center py-12">
                <motion.h1
                  className="text-5xl xl:text-6xl 2xl:text-7xl font-bold text-white leading-[1.1]"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  Your waste
                  <br />
                  management,
                  <br />
                  <span className="text-white/90 italic">simplified.</span>
                </motion.h1>

                <motion.div
                  className="mt-16 space-y-5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  {features.map((feature, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-4 text-white/90"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                        <feature.icon size={20} className="text-white" />
                      </div>
                      <span className="text-base font-medium">{feature.text}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* Bottom decoration */}
              <motion.div
                className="text-white/50 text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {config.tagline}
              </motion.div>
            </div>

            {/* Diagonal accent */}
            <div
              className="absolute bottom-0 right-0 w-32 h-64 transform translate-x-16"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent) 0%, transparent 100%)',
                opacity: 0.2,
                borderRadius: '100px 0 0 0',
              }}
            />
          </div>
        )}

        {/* Right section - Form / Dashboard */}
        <div className={`flex-1 flex flex-col ${step === 'dashboard' ? 'justify-start pt-4 sm:pt-6' : 'justify-center'} items-center px-4 sm:px-6 py-8 sm:py-12 ${step === 'dashboard' ? 'lg:px-6 xl:px-8' : 'lg:px-16'} safe-area-bottom`}>
          <div className={`w-full ${step === 'dashboard' ? 'max-w-7xl' : 'max-w-md'}`}>
            {/* Mobile logo - hide on dashboard as it's in the header bar */}
            {step !== 'dashboard' && (
              <motion.div
                className="mb-8 sm:mb-12 lg:hidden flex justify-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                {isRemoteLogo ? (
                  <img
                    src={logoSrc}
                    alt={config.businessName}
                    className="w-[160px] sm:w-[200px] h-auto"
                  />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={config.businessName}
                    width={200}
                    height={72}
                    className="w-[160px] sm:w-[200px] h-auto"
                    priority
                  />
                )}
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {step === 'email' && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {/* Welcome text */}
                  <div className="mb-6 sm:mb-10">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--color-charcoal)] leading-tight">
                      Welcome back
                    </h1>
                    <p className="mt-2 sm:mt-3 text-[var(--color-stone)] text-base sm:text-lg">
                      Sign in to access your account and documents
                    </p>
                  </div>

                  {/* Email form */}
                  <EmailForm onPinSent={handlePinSent} />
                </motion.div>
              )}

              {step === 'pin' && (
                <motion.div
                  key="pin"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <PinEntry
                    email={email}
                    onVerified={handleVerified}
                    onBack={handleBackToEmail}
                  />
                </motion.div>
              )}

              {step === 'accounts' && (
                <motion.div
                  key="accounts"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <AccountSelector
                    accounts={accounts}
                    email={email}
                    onSelectAccount={handleSelectAccount}
                    onLogout={handleLogout}
                  />
                </motion.div>
              )}

              {step === 'dashboard' && selectedAccount && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Dashboard
                    account={selectedAccount}
                    email={email}
                    onBack={accounts.length > 1 ? handleBackToAccounts : handleLogout}
                    onLogout={handleLogout}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Help text - only show on email step */}
            {step === 'email' && (
              <motion.div
                className="mt-10 sm:mt-16 pt-6 sm:pt-8 border-t border-[var(--color-sand)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <p className="text-xs sm:text-sm text-[var(--color-stone)]">
                  Need help?{' '}
                  <button
                    onClick={() => setShowContact(true)}
                    className="text-[var(--color-primary)] hover:text-[var(--color-primary-light)] font-medium transition-colors"
                  >
                    Contact support
                  </button>
                </p>
              </motion.div>
            )}

            {/* Powered by PaperRoute footer - show on login steps */}
            {step !== 'dashboard' && (
              <motion.a
                href="https://www.paperroute.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 sm:mt-12 flex items-center justify-center gap-2 opacity-50 hover:opacity-70 transition-opacity"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 1 }}
              >
                <span className="text-xs text-gray-400">Powered by</span>
                <Image
                  src="/paperroute-logo.webp"
                  alt="PaperRoute"
                  width={100}
                  height={24}
                  className="h-5 w-auto"
                />
              </motion.a>
            )}
          </div>
        </div>
      </main>
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
    </div>
  );
}

export default function Home() {
  return (
    <BusinessConfigProvider>
      <HomeContent />
    </BusinessConfigProvider>
  );
}
