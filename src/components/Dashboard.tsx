'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  LogOut,
  MapPinned,
  AlertCircle,
  ExternalLink,
  Loader2,
  FileWarning,
  CreditCard,
  Award,
  FileCheck,
  Receipt,
  File,
  Eye,
  Download,
  Send,
} from 'lucide-react';
import Image from 'next/image';
import type { Account } from './AccountSelector';
import DocumentViewer from './DocumentViewer';
import ContactModal from './ContactModal';
import ServiceRequestModal from './ServiceRequestModal';
import { useBusinessConfig } from '@/lib/BusinessConfigContext';

interface Document {
  id: string;
  name: string;
  displayName: string;
  type: 'waste_transfer_note' | 'certificate' | 'invoice' | 'other';
  date: string | null;
  size: number;
  url: string;
}

interface DashboardProps {
  account: Account;
  email: string;
  onBack: () => void;
  onLogout: () => void;
}

export default function Dashboard({ account, email, onBack, onLogout }: DashboardProps) {
  const config = useBusinessConfig();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [viewerDocument, setViewerDocument] = useState<Document | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [showServiceRequest, setShowServiceRequest] = useState(false);

  const logoSrc = config.logoUrl || '/logo.png';
  const isRemoteLogo = logoSrc.startsWith('http');

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!account.reference) {
        setDocumentsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/documents?ref=${encodeURIComponent(account.reference)}`, {
          cache: 'no-store',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch documents');
        }

        setDocuments(data.documents || []);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setDocumentsError(error instanceof Error ? error.message : 'Failed to load documents');
      } finally {
        setDocumentsLoading(false);
      }
    };

    fetchDocuments();
  }, [account.reference]);

  const getDocumentIcon = (type: Document['type']) => {
    switch (type) {
      case 'waste_transfer_note':
        return { icon: FileCheck, color: 'bg-emerald-100 text-emerald-600' };
      case 'certificate':
        return { icon: Award, color: 'bg-amber-100 text-amber-600' };
      case 'invoice':
        return { icon: Receipt, color: 'bg-blue-100 text-blue-600' };
      default:
        return { icon: File, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(doc.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(doc.url, '_blank');
    }
  };

  const isBusiness = (() => {
    const name = account.name.toLowerCase();
    return (
      name.includes('ltd') ||
      name.includes('limited') ||
      name.includes('plc') ||
      name.includes('inc') ||
      name.includes('corp') ||
      name.includes('llc') ||
      name.includes('(') ||
      !!account.businessName
    );
  })();

  const formatCustomerType = (type?: string) => {
    if (!type) return null;
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-auto"
    >
      {/* Clean header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        {isRemoteLogo ? (
          <img
            src={logoSrc}
            alt={config.businessName}
            className="w-[120px] sm:w-[150px] h-auto"
          />
        ) : (
          <Image
            src={logoSrc}
            alt={config.businessName}
            width={150}
            height={54}
            className="w-[120px] sm:w-[150px] h-auto"
            priority
          />
        )}

        <div className="flex items-center gap-3 sm:gap-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm p-2 -m-2 touch-manipulation"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm p-2 -m-2 touch-manipulation"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Welcome section */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <div className={`
            w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0
            ${isBusiness ? 'bg-[var(--color-primary)]/10' : 'bg-[var(--color-accent)]/10'}
          `}>
            {isBusiness
              ? <Building2 size={20} className="sm:w-6 sm:h-6 text-[var(--color-primary)]" />
              : <User size={20} className="sm:w-6 sm:h-6 text-[var(--color-accent)]" />
            }
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              Welcome back, {account.name.split(' ')[0]}
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm truncate">
              {account.reference && `Account ${account.reference}`}
              {account.customerType && ` · ${formatCustomerType(account.customerType)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

        {/* Documents - Main content area */}
        <div className="lg:col-span-8 order-1">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                <FileText size={18} className="text-[var(--color-primary)]" />
                Your Documents
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Waste transfer notes, certificates and invoices
              </p>
            </div>

            <div className="p-3 sm:p-4">
              {documentsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 size={32} className="text-[var(--color-primary)] animate-spin" />
                  <p className="text-sm text-gray-500 mt-3">Loading your documents...</p>
                </div>
              ) : documentsError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <FileWarning size={24} className="text-red-500" />
                  </div>
                  <p className="text-gray-900 font-medium">Unable to load documents</p>
                  <p className="text-sm text-gray-500 mt-1">{documentsError}</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <FileText size={28} className="text-gray-300" />
                  </div>
                  <p className="text-gray-900 font-medium">No documents yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your documents will appear here after your first collection
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {documents.map((doc, index) => {
                    const { icon: Icon, color } = getDocumentIcon(doc.type);
                    return (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50/50 hover:bg-gray-50 rounded-lg sm:rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                            <Icon size={20} className="sm:w-[22px] sm:h-[22px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                              {doc.displayName}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-500 truncate">
                              {doc.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              {doc.size > 0 && <span className="text-gray-300 mx-1 sm:mx-2">·</span>}
                              {doc.size > 0 && formatFileSize(doc.size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-13 sm:ml-0">
                          <button
                            onClick={() => setViewerDocument(doc)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 rounded-lg transition-colors touch-manipulation"
                          >
                            <Eye size={16} />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleDownload(doc)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors touch-manipulation"
                          >
                            <Download size={16} />
                            <span>Download</span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Special Instructions */}
          {account.specialInstructions && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <div className="flex gap-3">
                <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-900">Special Instructions</h3>
                  <p className="text-amber-800 text-sm mt-1">{account.specialInstructions}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4 order-2">

          {/* Service Request Card */}
          <div className="rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] p-4 text-white shadow-sm sm:rounded-2xl sm:p-5">
            <h3 className="font-semibold text-sm sm:text-base">Need a collection, delivery or exchange?</h3>
            <p className="mt-1 text-xs text-white/80 sm:text-sm">
              Send the team the details and they will contact you to confirm.
            </p>
            <button
              onClick={() => setShowServiceRequest(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-primary)] transition-opacity hover:opacity-90"
            >
              <Send size={16} />
              Request a service
            </button>
          </div>

          {/* Collection Address Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                <MapPin size={16} className="text-[var(--color-primary)]" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Collection Address</h3>
            </div>

            {account.collectionAddress ? (
              <div className="space-y-2">
                <p className="text-gray-700 text-sm leading-relaxed">
                  {account.collectionAddress}
                </p>
                {(account.collectionCity || account.collectionPostcode) && (
                  <p className="text-gray-700 text-sm">
                    {[account.collectionCity, account.collectionPostcode].filter(Boolean).join(', ')}
                  </p>
                )}
                {account.what3words && (
                  <a
                    href={`https://what3words.com/${account.what3words}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-sm text-[var(--color-primary)] hover:underline"
                  >
                    <MapPinned size={14} />
                    {'///'}{account.what3words}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No address on file</p>
            )}
          </div>

          {/* Contact Details Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <User size={16} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Contact Details</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail size={15} className="text-gray-400" />
                <span className="text-sm text-gray-700 break-all">{account.email || email}</span>
              </div>

              {account.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={15} className="text-gray-400" />
                  <a href={`tel:${account.phone}`} className="text-sm text-gray-700 hover:text-[var(--color-primary)]">
                    {account.phone}
                  </a>
                </div>
              )}

              {account.phone2 && (
                <div className="flex items-center gap-3">
                  <Phone size={15} className="text-gray-400" />
                  <a href={`tel:${account.phone2}`} className="text-sm text-gray-700 hover:text-[var(--color-primary)]">
                    {account.phone2}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Billing Address - only if different */}
          {account.billingAddress && account.billingAddress !== account.collectionAddress && (
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <CreditCard size={16} className="text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Billing Address</h3>
              </div>

              <div className="space-y-2">
                <p className="text-gray-700 text-sm leading-relaxed">
                  {account.billingAddress}
                </p>
                {(account.billingCity || account.billingPostcode) && (
                  <p className="text-gray-700 text-sm">
                    {[account.billingCity, account.billingPostcode].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Help Card */}
          <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Need to update your details?</h3>
            <p className="text-white/80 text-xs sm:text-sm mb-3">
              Our team is here to help with any changes to your account.
            </p>
            <button
              onClick={() => setShowContact(true)}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 sm:px-4 py-2 text-sm font-medium touch-manipulation"
            >
              <Phone size={16} />
              Contact support
            </button>
          </div>
        </div>
      </div>

      {/* Powered by PaperRoute footer */}
      <a
        href="https://www.paperroute.co.uk"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 sm:mt-12 pb-4 flex items-center justify-center gap-2 opacity-40 hover:opacity-60 transition-opacity"
      >
        <span className="text-xs text-gray-400">Powered by</span>
        <Image
          src="/paperroute-logo.webp"
          alt="PaperRoute"
          width={100}
          height={24}
          className="h-5 w-auto"
        />
      </a>

      {/* Contact Modal */}
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />

      {/* Service Request Modal */}
      <ServiceRequestModal
        isOpen={showServiceRequest}
        onClose={() => setShowServiceRequest(false)}
        account={account}
      />

      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={!!viewerDocument}
        onClose={() => setViewerDocument(null)}
        documentUrl={viewerDocument?.url || ''}
        documentName={viewerDocument?.displayName || ''}
      />
    </motion.div>
  );
}
