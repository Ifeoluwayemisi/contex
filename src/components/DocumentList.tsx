import React, { useState } from 'react';
import { 
  FileText, 
  FileCode, 
  Trash2, 
  Sparkles, 
  Tag, 
  Calendar, 
  Layers, 
  Eye, 
  AlertTriangle,
  Folder,
  X
} from 'lucide-react';
import { DocumentRecord, SourceRecord } from '../types';

interface DocumentListProps {
  documents: DocumentRecord[];
  onSelectDocument: (doc: DocumentRecord) => void;
  onDeleteDocument: (id: string, filename: string) => void;
  selectedCollection: string | null;
  selectedSource?: SourceRecord | null;
  onClearSourceFilter?: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onSelectDocument,
  onDeleteDocument,
  selectedCollection,
  selectedSource,
  onClearSourceFilter,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  // Filter by source if selected
  let filtered = documents;
  if (selectedSource) {
    filtered = filtered.filter((doc) => doc.sourceId === selectedSource.id);
  }

  // Filter by collection if selected
  if (selectedCollection) {
    filtered = filtered.filter((doc) => {
      const collections = doc.metadata?.suggestedCollections || [];
      const custom = doc.customCollections || [];
      return (
        collections.some(c => c.toLowerCase() === selectedCollection.toLowerCase()) ||
        custom.some(c => c.toLowerCase() === selectedCollection.toLowerCase())
      );
    });
  }

  // Filter by file type
  if (filterType !== 'all') {
    filtered = filtered.filter((doc) => doc.fileType === filterType);
  }

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Active Source Banner */}
      {selectedSource && (
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs text-amber-950">
          <div className="flex items-center gap-2 min-w-0">
            <Folder className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="truncate">
              Filtered to folder: <span className="font-semibold">{selectedSource.name}</span>
            </span>
          </div>
          {onClearSourceFilter && (
            <button
              onClick={onClearSourceFilter}
              className="inline-flex items-center gap-1 text-[11px] text-amber-900 hover:text-amber-950 underline shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Show all documents</span>
            </button>
          )}
        </div>
      )}

      {/* Filters and Count Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div>
          <h2 className="font-serif text-lg font-bold text-stone-900">
            {selectedCollection ? `Collection: ${selectedCollection}` : selectedSource ? `Folder: ${selectedSource.name}` : 'Your Library'}
          </h2>
          <p className="text-xs text-stone-500">
            {filtered.length} {filtered.length === 1 ? 'document' : 'documents'} indexed with Gemma
          </p>
        </div>

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-stone-400 mr-1 text-[11px]">Filter:</span>
          {['all', 'pdf', 'markdown', 'txt'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2.5 py-1 rounded-lg uppercase font-medium transition-colors text-[11px] cursor-pointer ${
                filterType === type
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((doc) => {
          return (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc)}
              className={`p-4 rounded-xl bg-white border hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group space-y-3 ${
                doc.isMissing
                  ? 'border-amber-300/80 bg-amber-50/20'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 rounded-lg bg-stone-100 shrink-0">
                      {doc.fileType === 'pdf' ? (
                        <FileText className="w-4 h-4 text-rose-600" />
                      ) : doc.fileType === 'docx' ? (
                        <FileText className="w-4 h-4 text-blue-600" />
                      ) : doc.fileType === 'markdown' || doc.fileType === 'code' ? (
                        <FileCode className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-stone-600" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium text-stone-900 text-xs sm:text-sm truncate group-hover:text-amber-900 transition-colors">
                        {doc.filename}
                      </h3>
                      <div className="flex items-center flex-wrap gap-1.5 text-[10px] text-stone-400">
                        <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                        <span>•</span>
                        <span>{doc.wordCount.toLocaleString()} words</span>
                        {doc.pageCount && (
                          <>
                            <span>•</span>
                            <span>{doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}</span>
                          </>
                        )}
                        {doc.sourcePath && doc.sourcePath !== doc.filename && (
                          <>
                            <span>•</span>
                            <span className="text-stone-500 font-mono text-[9px] truncate max-w-[120px]" title={doc.sourcePath}>
                              {doc.sourcePath}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Missing file badge */}
                    {doc.isMissing && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-900 border border-amber-300">
                        Missing on disk
                      </span>
                    )}

                    {/* Document Type Badge */}
                    {doc.metadata?.documentType && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200/80">
                        {doc.metadata.documentType}
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Summary */}
                <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                  {doc.metadata?.summary || 'Text extracted. Ready for full-text search.'}
                </p>

                {/* Fallback warning if AI indexing failed */}
                {doc.aiIndexingFailed && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>AI indexing unavailable. Full text search preserved.</span>
                  </div>
                )}
              </div>

              {/* Topics / Metadata Footer */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                <div className="flex items-center flex-wrap gap-1 max-w-[80%] overflow-hidden">
                  {doc.metadata?.topics?.slice(0, 3).map((topic, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600"
                    >
                      #{topic}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(doc.id, doc.filename);
                    }}
                    title="Remove from library (source file untouched)"
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
