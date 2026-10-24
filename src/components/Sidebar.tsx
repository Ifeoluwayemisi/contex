import React from 'react';
import { 
  BookOpen, 
  Folder, 
  HardDrive, 
  Sparkles, 
  FileText, 
  Cpu,
  FolderPlus,
  RefreshCw,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  History,
  Lock
} from 'lucide-react';
import { SmartCollection, DocumentRecord, ModelInfo, SourceRecord } from '../types';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  documents: DocumentRecord[];
  collections: SmartCollection[];
  selectedCollection: string | null;
  onSelectCollection: (name: string | null) => void;
  activeView: 'library' | 'collections' | 'recent' | 'history';
  onChangeView: (view: 'library' | 'collections' | 'recent' | 'history') => void;
  onOpenModelInfo: () => void;
  modelInfo: ModelInfo | null;
  sources?: SourceRecord[];
  selectedSourceId?: string | null;
  onSelectSource?: (sourceId: string | null) => void;
  onRescanSource?: (source: SourceRecord) => void;
  onRemoveSource?: (source: SourceRecord) => void;
  isRescanning?: boolean;
  onOpenUpload?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  collections,
  selectedCollection,
  onSelectCollection,
  activeView,
  onChangeView,
  onOpenModelInfo,
  modelInfo,
  sources = [],
  selectedSourceId = null,
  onSelectSource,
  onRescanSource,
  onRemoveSource,
  isRescanning = false,
  onOpenUpload
}) => {
  const { user } = useAuth();
  const totalWords = documents.reduce((acc, doc) => acc + (doc.wordCount || 0), 0);
  const totalChars = documents.reduce((acc, doc) => acc + (doc.charCount || 0), 0);
  const recentDocs = [...documents].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()).slice(0, 4);

  return (
    <aside className="w-64 shrink-0 flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 border-r border-stone-200 bg-[#faf9f6] p-4 text-xs select-none hidden lg:flex">
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* Primary Navigation */}
        <div className="space-y-1">
          <span className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase px-2.5">
            Knowledge Library
          </span>

          <button
            onClick={() => {
              if (onSelectSource) onSelectSource(null);
              onSelectCollection(null);
              onChangeView('library');
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
              activeView === 'library' && selectedCollection === null && selectedSourceId === null
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-700 hover:bg-stone-200/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>All Documents</span>
            </div>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${
              activeView === 'library' && selectedCollection === null && selectedSourceId === null
                ? 'bg-stone-800 text-stone-200'
                : 'bg-stone-200/80 text-stone-600'
            }`}>
              {documents.length}
            </span>
          </button>

          <button
            onClick={() => {
              if (onSelectSource) onSelectSource(null);
              onSelectCollection(null);
              onChangeView('collections');
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
              activeView === 'collections'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-700 hover:bg-stone-200/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4" />
              <span>Smart Collections</span>
            </div>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${
              activeView === 'collections'
                ? 'bg-stone-800 text-stone-200'
                : 'bg-stone-200/80 text-stone-600'
            }`}>
              {collections.length}
            </span>
          </button>

          <button
            onClick={() => {
              if (onSelectSource) onSelectSource(null);
              onSelectCollection(null);
              onChangeView('history');
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
              activeView === 'history'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-700 hover:bg-stone-200/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span>Search History</span>
            </div>
            {!user ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-100/70 text-amber-900">
                <Lock className="w-2.5 h-2.5" />
                <span>Private</span>
              </span>
            ) : (
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                activeView === 'history'
                  ? 'bg-stone-800 text-stone-200'
                  : 'bg-stone-200/80 text-stone-600'
              }`}>
                Saved
              </span>
            )}
          </button>
        </div>

        {/* Connected Folders Section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2.5">
            <span className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
              Connected Folders
            </span>
            {onOpenUpload && (
              <button
                onClick={onOpenUpload}
                title="Connect a new folder"
                className="p-1 text-stone-400 hover:text-stone-800 rounded hover:bg-stone-200/60 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {sources.map((src) => {
              const isSelected = selectedSourceId === src.id;
              const sourceDocCount = documents.filter(d => d.sourceId === src.id).length;

              return (
                <div
                  key={src.id}
                  className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-amber-100/80 text-amber-950 font-medium border-amber-300'
                      : 'bg-white/80 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <button
                    onClick={() => {
                      if (onSelectSource) {
                        onSelectSource(isSelected ? null : src.id);
                        onSelectCollection(null);
                        onChangeView('library');
                      }
                    }}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer truncate"
                  >
                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-800' : 'text-amber-600'}`} />
                    <span className="truncate text-xs">{src.name}</span>
                    <span className="text-[10px] text-stone-400 shrink-0">
                      ({sourceDocCount})
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {onRescanSource && (
                      <button
                        onClick={() => onRescanSource(src)}
                        disabled={isRescanning}
                        title={`Rescan folder "${src.name}" for new/changed files`}
                        className="p-1 text-stone-400 hover:text-stone-800 rounded hover:bg-stone-200/70 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRescanning ? 'animate-spin text-amber-600' : ''}`} />
                      </button>
                    )}
                    {onRemoveSource && (
                      <button
                        onClick={() => onRemoveSource(src)}
                        title={`Remove "${src.name}" from library (source files untouched)`}
                        className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {sources.length === 0 && (
              <button
                onClick={onOpenUpload}
                className="w-full text-left px-2.5 py-2 rounded-lg border border-dashed border-stone-300 text-stone-500 hover:bg-stone-100/60 hover:text-stone-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[11px]">Connect local folder...</span>
              </button>
            )}
          </div>
        </div>

        {/* Smart Collections Sub-list */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2.5">
            <span className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
              Auto Collections
            </span>
            <Sparkles className="w-3 h-3 text-amber-600" />
          </div>

          <div className="space-y-0.5">
            {collections.slice(0, 5).map((col) => {
              const isSelected = selectedCollection === col.name;
              return (
                <button
                  key={col.id}
                  onClick={() => {
                    if (onSelectSource) onSelectSource(null);
                    onSelectCollection(isSelected ? null : col.name);
                    onChangeView('library');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors truncate cursor-pointer ${
                    isSelected
                      ? 'bg-amber-100/80 text-amber-950 font-medium border border-amber-200'
                      : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                  }`}
                >
                  <span className="truncate">{col.name}</span>
                  <span className="text-[10px] text-stone-400 ml-1 shrink-0">
                    {col.documentCount}
                  </span>
                </button>
              );
            })}
            {collections.length === 0 && (
              <p className="px-2.5 py-1 text-[11px] text-stone-400 italic">
                Upload files to see suggested collections
              </p>
            )}
          </div>
        </div>

        {/* Recent Documents */}
        {recentDocs.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase px-2.5">
              Recent Documents
            </span>
            <div className="space-y-0.5">
              {recentDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="px-2.5 py-1.5 rounded-lg text-stone-600 hover:bg-stone-200/50 flex items-center gap-2 truncate cursor-default"
                >
                  <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate text-[11px]">{doc.filename}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Storage and Gemma Status Footer */}
      <div className="pt-4 border-t border-stone-200 space-y-3">
        {/* Local Storage Indicator */}
        <div className="p-2.5 rounded-xl bg-stone-100/80 border border-stone-200 text-stone-600 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-stone-800">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-stone-500" />
              <span>Local IndexedDB</span>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
              Persistent
            </span>
          </div>
          <div className="text-[10px] text-stone-500">
            {totalWords.toLocaleString()} words indexed ({Math.round(totalChars / 1024)} KB)
          </div>
        </div>

        {/* Original File Safety Notice */}
        <div className="text-[10px] text-stone-400 flex items-center gap-1.5 px-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Read-only: source files on disk are never altered or deleted.</span>
        </div>

        {/* Gemma Pill */}
        <button
          onClick={onOpenModelInfo}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 transition-colors shadow-2xs cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Cpu className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate font-medium text-[11px]">Gemma 4 26B A4B</span>
          </div>
          <span className="text-[10px] text-stone-400">Settings</span>
        </button>
      </div>
    </aside>
  );
};
