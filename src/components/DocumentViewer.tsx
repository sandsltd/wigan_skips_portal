'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  documentName: string;
}

export default function DocumentViewer({ isOpen, onClose, documentUrl, documentName }: DocumentViewerProps) {
  const handleDownload = async () => {
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(documentUrl, '_blank');
    }
  };

  const handleOpenExternal = () => {
    window.open(documentUrl, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full h-full sm:max-w-6xl sm:max-h-[90vh] sm:m-4 flex flex-col bg-white sm:rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50 safe-area-top">
              <div className="flex-1 min-w-0 mr-2 sm:mr-4">
                <h2 className="font-semibold text-gray-900 truncate text-sm sm:text-base">{documentName}</h2>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={handleOpenExternal}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
                  title="Open in new tab"
                >
                  <ExternalLink size={18} />
                  <span className="hidden sm:inline">New Tab</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-lg transition-colors touch-manipulation"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-1 sm:ml-2 touch-manipulation"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-gray-200 overflow-hidden safe-area-bottom">
              <iframe
                src={`${documentUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                className="w-full h-full border-0"
                title={documentName}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
