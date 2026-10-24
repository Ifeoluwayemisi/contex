import React from 'react';
import { 
  X, 
  Cpu, 
  ShieldCheck, 
  Database, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  Clock, 
  Info,
  ExternalLink
} from 'lucide-react';
import { ModelInfo } from '../types';

interface ModelInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelInfo: ModelInfo | null;
}

export const ModelInfoModal: React.FC<ModelInfoModalProps> = ({
  isOpen,
  onClose,
  modelInfo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-300/80">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900">
                Gemma Model & Privacy Transparency
              </h2>
              <p className="text-xs text-stone-500">
                Runtime configuration, open-weight model details, and data boundaries.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Active Runtime Model Status */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-800 text-sm">
                Runtime Model Architecture
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px] ${
                modelInfo?.status === 'available'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {modelInfo?.status === 'available' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Operational
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    Checking / Standby
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded bg-white border border-stone-200">
                <span className="text-stone-400 block text-[10px]">Model ID</span>
                <span className="font-bold text-stone-900">{modelInfo?.modelId || 'gemma-4-26b-a4b-it'}</span>
              </div>
              <div className="p-2 rounded bg-white border border-stone-200">
                <span className="text-stone-400 block text-[10px]">Model Type</span>
                <span className="font-bold text-stone-900">Gemma Open-Weight</span>
              </div>
              <div className="p-2 rounded bg-white border border-stone-200">
                <span className="text-stone-400 block text-[10px]">API Endpoint</span>
                <span className="text-stone-800 truncate block">Google AI Studio REST</span>
              </div>
              <div className="p-2 rounded bg-white border border-stone-200">
                <span className="text-stone-400 block text-[10px]">Roundtrip Latency</span>
                <span className="text-stone-800">{modelInfo?.latencyMs ? `${modelInfo.latencyMs} ms` : 'Ready'}</span>
              </div>
            </div>

            <p className="text-[11px] text-stone-600 leading-relaxed">
              <strong>Mandatory Gemma Constraint:</strong> In strict compliance with the Hacktoberfest PRD, ContextKeeper uses Google Gemma open-weight models exclusively for runtime document summarization, topic extraction, distinctive phrase detection, and search explanations. Gemini is never substituted for Gemma in the application's runtime features.
            </p>
          </div>

          {/* Privacy & Storage Boundaries (PRD Section 8.1) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-stone-900 flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Privacy & Local Storage Transparency
            </h3>

            <div className="space-y-2 text-stone-600 leading-relaxed text-xs">
              <div className="p-3 rounded-xl border border-stone-200 bg-white space-y-1">
                <span className="font-medium text-stone-900 block flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-stone-500" />
                  Local Storage (Browser IndexedDB)
                </span>
                <p>
                  Your indexed documents, full extracted text, generated summaries, smart collections, and custom tags remain stored locally on your device in your browser's IndexedDB. They persist across browser refreshes and are never uploaded to a persistent cloud database or user account.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-stone-200 bg-white space-y-1">
                <span className="font-medium text-stone-900 block flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-stone-500" />
                  Hosted Gemma Inference Disclosure
                </span>
                <p>
                  Extracted text sent for AI indexing is transmitted server-side to the hosted Gemma inference endpoint for summarization and metadata extraction. The server retains zero document data after request processing. API keys are kept strictly in server-side environment variables and are never transmitted to the client.
                </p>
              </div>
            </div>
          </div>

          {/* Safe Deletion Disclosure */}
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-stone-700 text-[11px] leading-relaxed">
            <strong>Non-Destructive Library Management:</strong> Removing a document or clearing your library only deletes the browser-stored IndexedDB records and search indexes. It will never delete, modify, or move the original files on your computer.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs">
          <span className="text-stone-500">ContextKeeper v1.0.0</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
