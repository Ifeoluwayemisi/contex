import React from 'react';
import { Trash2, AlertTriangle, X, Loader2, ShieldCheck } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  document?: { id: string; filename: string; fileSize?: number } | null;
  filename?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isDeleting: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  document,
  filename,
  onConfirm,
  onCancel,
  isDeleting,
}) => {
  const targetFilename = document?.filename || filename;
  if (!isOpen || !targetFilename) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-rose-50/40 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-stone-900">
                Remove from ContextKeeper?
              </h2>
              <p className="text-xs text-stone-500">
                Delete this document's index and summary.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-stone-600 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-stone-400">Target Document</span>
            <p className="font-medium text-stone-900 truncate text-sm">
              {targetFilename}
            </p>
            {document?.fileSize && (
              <p className="text-[11px] text-stone-500">
                Size: {(document.fileSize / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          {/* Safety Notice */}
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 flex items-start gap-2.5 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong className="font-semibold text-emerald-900">Your original file is safe:</strong> This operation only removes the local search index from your browser. The original file on your computer's drive is never altered or deleted.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Document</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
