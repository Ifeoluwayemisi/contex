import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  FileCode, 
  Sparkles, 
  Calendar, 
  Tag, 
  Quote, 
  BookMarked, 
  Copy, 
  Check, 
  Layers, 
  Search, 
  Link2,
  FolderPlus,
  Trash2
} from 'lucide-react';
import { DocumentRecord, RelatedDocumentResult } from '../types';
import { apiFetch, parseJsonSafely } from '../lib/api';

interface DocumentInspectorModalProps {
  document: DocumentRecord | null;
  allDocuments: DocumentRecord[];
  onClose: () => void;
  onSelectDocument: (doc: DocumentRecord) => void;
  onDeleteDocument?: (id: string, filename: string) => void;
}

export const DocumentInspectorModal: React.FC<DocumentInspectorModalProps> = ({
  document,
  allDocuments,
  onClose,
  onSelectDocument,
  onDeleteDocument,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'text' | 'related'>('overview');
  const [copiedText, setCopiedText] = useState(false);
  const [textSearch, setTextSearch] = useState('');
  const [relatedDocs, setRelatedDocs] = useState<RelatedDocumentResult[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    if (!document) return;
    loadRelatedDocuments();
  }, [document?.id]);

  const loadRelatedDocuments = async () => {
    if (!document) return;
    setLoadingRelated(true);

    const candidates = allDocuments.filter(d => d.id !== document.id);
    const relatedList: RelatedDocumentResult[] = [];

    const myTopics = (document.metadata?.topics || []).map(t => t.toLowerCase());

    for (const other of candidates.slice(0, 3)) {
      const otherTopics = (other.metadata?.topics || []).map(t => t.toLowerCase());
      const shared = myTopics.filter(t => otherTopics.includes(t));

      if (shared.length > 0 || other.fileType === document.fileType) {
        // Query server for Gemma connection explanation
        try {
          const res = await apiFetch('/api/related', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doc1: {
                filename: document.filename,
                summary: document.metadata?.summary,
                topics: document.metadata?.topics,
              },
              doc2: {
                filename: other.filename,
                summary: other.metadata?.summary,
                topics: other.metadata?.topics,
              },
            }),
          }, 1);
          const data = await parseJsonSafely(res, '/api/related');
          relatedList.push({
            targetDocId: other.id,
            targetDocFilename: other.filename,
            similarityScore: shared.length * 25 + 50,
            explanation: data.explanation || `Both cover ${shared.join(', ')}`,
            sharedTopics: shared,
          });
        } catch {
          relatedList.push({
            targetDocId: other.id,
            targetDocFilename: other.filename,
            similarityScore: 60,
            explanation: `Documents share common concepts in your library.`,
            sharedTopics: shared,
          });
        }
      }
    }

    setRelatedDocs(relatedList);
    setLoadingRelated(false);
  };

  if (!document) return null;

  const isPdf = document.fileType === 'pdf';
  const isMarkdown = document.fileType === 'markdown';

  const handleCopyText = () => {
    navigator.clipboard.writeText(document.extractedText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-start justify-between bg-stone-50/70 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-white border border-stone-200 text-stone-700 shadow-2xs">
              {isPdf ? (
                <FileText className="w-5 h-5 text-rose-600" />
              ) : isMarkdown ? (
                <FileCode className="w-5 h-5 text-blue-600" />
              ) : (
                <FileText className="w-5 h-5 text-stone-600" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 truncate">
                {document.filename}
              </h2>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="capitalize">{document.fileType} document</span>
                <span>•</span>
                <span>{(document.fileSize / 1024).toFixed(1)} KB</span>
                <span>•</span>
                <span>{document.wordCount.toLocaleString()} words</span>
                {document.pageCount && (
                  <>
                    <span>•</span>
                    <span>{document.pageCount} pages</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-stone-200 flex gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Gemma Intelligence & Metadata
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'text'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Extracted Source Text ({document.charCount.toLocaleString()} chars)
          </button>
          <button
            onClick={() => setActiveTab('related')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'related'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Related Documents ({relatedDocs.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Concise Document Summary (Google Gemma)</span>
                </div>
                <p className="text-stone-800 text-xs sm:text-sm leading-relaxed">
                  {document.metadata?.summary || 'No summary available.'}
                </p>
              </div>

              {/* Document Classification & Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                  <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                    Document Type
                  </span>
                  <p className="text-sm font-semibold text-stone-900">
                    {document.metadata?.documentType || 'General Document'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                  <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                    Explicit Dates Mentioned
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {document.metadata?.dateMentions && document.metadata.dateMentions.length > 0 ? (
                      document.metadata.dateMentions.map((d, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-stone-200 font-mono text-stone-800 text-[11px]">
                          <Calendar className="w-3 h-3 text-stone-400" />
                          {d}
                        </span>
                      ))
                    ) : (
                      <span className="text-stone-400 italic">None explicitly identified in source</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Distinctive Phrases */}
              {document.metadata?.distinctivePhrases && document.metadata.distinctivePhrases.length > 0 && (
                <div className="space-y-2">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-stone-500" />
                    Distinctive Phrases (to help you recall)
                  </span>
                  <div className="space-y-1.5">
                    {document.metadata.distinctivePhrases.map((phrase, i) => (
                      <div key={i} className="p-2 rounded-lg bg-stone-50 border border-stone-200/90 text-stone-700 italic">
                        "{phrase}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics & Keywords */}
              <div className="space-y-3 pt-2">
                <div>
                  <span className="font-semibold text-stone-800 block mb-1.5">
                    Main Topics
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {document.metadata?.topics?.map((topic, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                        #{topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-stone-800 block mb-1.5">
                    Domain Keywords & Entities
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {document.metadata?.keywords?.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-amber-50/70 text-amber-900 border border-amber-200/60 font-mono text-[11px]">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    value={textSearch}
                    onChange={(e) => setTextSearch(e.target.value)}
                    placeholder="Search inside extracted document text..."
                    className="w-full pl-8 pr-3 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-800"
                  />
                </div>
                <button
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs shrink-0"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full Text</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 font-mono text-xs text-stone-800 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed select-text">
                {document.extractedText}
              </div>
            </div>
          )}

          {activeTab === 'related' && (
            <div className="space-y-3">
              {loadingRelated ? (
                <div className="py-8 text-center text-stone-500">
                  <Sparkles className="w-5 h-5 mx-auto animate-spin text-amber-600 mb-2" />
                  <span>Connecting knowledge with Gemma...</span>
                </div>
              ) : relatedDocs.length === 0 ? (
                <div className="py-8 text-center text-stone-500 space-y-2">
                  <Link2 className="w-6 h-6 mx-auto text-stone-400" />
                  <p>No related documents detected in your current library.</p>
                  <p className="text-[11px] text-stone-400">
                    As you add more documents covering similar topics, ContextKeeper will connect them automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {relatedDocs.map((rel, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-white hover:border-stone-300 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-stone-900 text-xs">
                          {rel.targetDocFilename}
                        </span>
                        <button
                          onClick={() => {
                            const target = allDocuments.find(d => d.id === rel.targetDocId);
                            if (target) onSelectDocument(target);
                          }}
                          className="text-[11px] text-stone-700 font-medium underline hover:text-stone-950"
                        >
                          View Document
                        </button>
                      </div>
                      <p className="text-stone-700 text-xs leading-relaxed">
                        {rel.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-stone-500">
              Stored locally in browser IndexedDB
            </span>
            {onDeleteDocument && (
              <button
                onClick={() => {
                  onDeleteDocument(document.id, document.filename);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete from Library</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
