/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { SearchResultsView } from './components/SearchResultsView';
import { DocumentList } from './components/DocumentList';
import { SmartCollectionsView } from './components/SmartCollectionsView';
import { UploadModal } from './components/UploadModal';
import { DocumentInspectorModal } from './components/DocumentInspectorModal';
import { ModelInfoModal } from './components/ModelInfoModal';
import { AuthModal } from './components/AuthModal';
import { DeleteConfirmationModal } from './components/DeleteConfirmationModal';
import { SearchHistoryView } from './components/SearchHistoryView';
import { 
  DocumentRecord, 
  SearchResultItem, 
  SmartCollection, 
  ModelInfo,
  SearchRefinements,
  SearchResponsePayload,
  SourceRecord
} from './types';
import { 
  getAllDocumentsFromDB, 
  saveDocumentToDB, 
  deleteDocumentFromDB, 
  clearAllDocumentsFromDB,
  getAllCollectionsFromDB,
  saveCollectionToDB,
  deleteCollectionFromDB,
  getAllSourcesFromDB,
  saveSourceToDB,
  deleteSourceFromDB,
  cleanSeededDemoDocuments
} from './lib/db';
import { apiFetch, parseJsonSafely } from './lib/api';
import { extractTextClientSide } from './lib/clientExtractor';
import { 
  rescanFolderUsingHandle, 
  pickFolderUsingFSA, 
  pickFolderUsingInput, 
  analyzeFolderChanges, 
  getDirectoryHandle, 
  storeDirectoryHandle,
  isFileSystemAccessSupported
} from './lib/connectors/LocalFolderConnector';
import { computeFileHash } from './lib/connectors/types';
import { 
  BookOpen, 
  Sparkles, 
  Upload, 
  FolderPlus, 
  Folder, 
  Search,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [collections, setCollections] = useState<SmartCollection[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'library' | 'collections' | 'recent' | 'history'>('library');

  // Search state
  const [activeQuery, setActiveQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRecallMode, setIsRecallMode] = useState(true);
  const [searchRefinements, setSearchRefinements] = useState<SearchRefinements>({});
  const [searchResponse, setSearchResponse] = useState<SearchResponsePayload | null>(null);

  // Modals & Async States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isModelInfoOpen, setIsModelInfoOpen] = useState(false);
  const [inspectedDoc, setInspectedDoc] = useState<DocumentRecord | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);

  // Delete Confirmation Modal States (replaces window.confirm)
  const [docToDelete, setDocToDelete] = useState<{ id: string; filename: string } | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Source Removal Confirmation State
  const [sourceToRemove, setSourceToRemove] = useState<SourceRecord | null>(null);
  const [isRemovingSource, setIsRemovingSource] = useState(false);

  // Clear Library Modal State
  const [isClearLibraryOpen, setIsClearLibraryOpen] = useState(false);
  const [isClearingLibrary, setIsClearingLibrary] = useState(false);

  // Model & Server Status
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Initialize from IndexedDB and fetch model health
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // Priority 1: Safe one-time cleanup migration that removes ONLY legacy seeded/demo documents
      await cleanSeededDemoDocuments();
      await loadLibraryFromDB();
      await fetchModelInfo();
    } catch (err) {
      console.error('Initialization error:', err);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const loadLibraryFromDB = async () => {
    try {
      const storedDocs = await getAllDocumentsFromDB();
      setDocuments(storedDocs);

      const storedCollections = await getAllCollectionsFromDB();
      recalculateSmartCollections(storedDocs, storedCollections);

      const storedSources = await getAllSourcesFromDB();
      setSources(storedSources);
    } catch (err) {
      console.error('Failed to load from IndexedDB:', err);
    }
  };

  const fetchModelInfo = async () => {
    try {
      const res = await apiFetch('/api/model-info');
      const data = await parseJsonSafely(res, '/api/model-info');
      setModelInfo(data);
    } catch (err) {
      console.warn('Could not load remote model info:', err);
    }
  };

  const recalculateSmartCollections = (docs: DocumentRecord[], existingCustom: SmartCollection[]) => {
    const topicMap: Record<string, { count: number; docIds: string[]; topics: Set<string> }> = {};

    for (const doc of docs) {
      const suggested = doc.metadata?.suggestedCollections || [];
      const topics = doc.metadata?.topics || [];

      for (const colName of suggested) {
        const clean = colName.trim();
        if (!clean) continue;
        if (!topicMap[clean]) {
          topicMap[clean] = { count: 0, docIds: [], topics: new Set() };
        }
        topicMap[clean].count++;
        topicMap[clean].docIds.push(doc.id);
        topics.forEach(t => topicMap[clean].topics.add(t));
      }
    }

    const autoSuggestedCols: SmartCollection[] = Object.entries(topicMap).map(([name, data]) => ({
      id: `auto-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      documentCount: data.count,
      documentIds: data.docIds,
      isAutoSuggested: true,
      sampleTopics: Array.from(data.topics).slice(0, 4),
    }));

    const customCols = existingCustom.filter(c => !c.isAutoSuggested);
    const merged = [...customCols, ...autoSuggestedCols];
    setCollections(merged);
  };

  // Search Handler
  const handleSearch = async (
    query: string, 
    recallMode = isRecallMode, 
    refinements = searchRefinements
  ) => {
    setActiveQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      setSearchResponse(null);
      return;
    }

    if (documents.length === 0) {
      setSearchResults([]);
      setSearchResponse(null);
      return;
    }

    setIsSearching(true);
    try {
      const res = await apiFetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          documents,
          recallMode,
          refinements,
        }),
      });

      const data: SearchResponsePayload = await parseJsonSafely(res, '/api/search');
      setSearchResults(data.results || []);
      setSearchResponse(data);
    } catch (err) {
      console.error('Search error:', err);
      showNotification('Search encountered an error. Please try again.');
      setSearchResults([]);
      setSearchResponse(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setActiveQuery('');
    setSearchResults(null);
    setSearchResponse(null);
  };

  // Add newly uploaded / indexed documents
  const handleDocumentsAdded = async (newDocs: DocumentRecord[], source?: SourceRecord) => {
    for (const doc of newDocs) {
      await saveDocumentToDB(doc);
    }

    if (source) {
      await saveSourceToDB(source);
      setSources((prev) => {
        const idx = prev.findIndex((s) => s.id === source.id);
        if (idx >= 0) {
          const updatedSources = [...prev];
          updatedSources[idx] = source;
          return updatedSources;
        }
        return [...prev, source];
      });
    }

    const updated = [...documents, ...newDocs];
    setDocuments(updated);
    recalculateSmartCollections(updated, collections);
    showNotification(`Successfully indexed ${newDocs.length} ${newDocs.length === 1 ? 'file' : 'files'} with Gemma.`);
  };

  // Folder Rescan Action (Detects new, modified, unchanged, and missing files)
  const handleRescanSource = async (source: SourceRecord) => {
    setIsRescanning(true);
    showNotification(`Rescanning folder "${source.name}"...`);

    try {
      let files: any[] = [];
      const cachedHandle = getDirectoryHandle(source.id);

      if (cachedHandle) {
        try {
          files = await rescanFolderUsingHandle(cachedHandle);
        } catch (handleErr) {
          console.warn('Cached handle permission prompt or error:', handleErr);
        }
      }

      // If handle was not cached or permission expired, re-prompt user
      if (files.length === 0) {
        if (isFileSystemAccessSupported()) {
          try {
            const picked = await pickFolderUsingFSA();
            files = picked.files;
            if (picked.handle) {
              storeDirectoryHandle(source.id, picked.handle);
            }
          } catch {
            const fallback = await pickFolderUsingInput();
            files = fallback.files;
          }
        } else {
          const fallback = await pickFolderUsingInput();
          files = fallback.files;
        }
      }

      if (files.length === 0) {
        showNotification(`No supported files found during rescan of "${source.name}".`);
        return;
      }

      const existingSourceDocs = documents.filter((d) => d.sourceId === source.id);
      const diff = await analyzeFolderChanges(files, existingSourceDocs);

      let newIndexedCount = 0;
      let updatedCount = 0;
      const updatedDocsMap = new Map<string, DocumentRecord>(documents.map(d => [d.id, d]));

      // 1. Process Changed Files (re-extract and re-index without duplicate records)
      for (const item of diff.changedFiles) {
        try {
          const extraction = await extractTextClientSide(item.file.file);
          const newHash = await computeFileHash(item.file.file);

          let indexData: any = null;
          try {
            const indexRes = await apiFetch('/api/index-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: extraction.filename,
                extractedText: extraction.extractedText,
              }),
            }, 1);
            indexData = await parseJsonSafely(indexRes, '/api/index-document');
          } catch {
            // Keep existing metadata or generate deterministic fallback
          }

          const updatedDoc: DocumentRecord = {
            ...item.existingDoc,
            fileSize: item.file.size,
            lastModified: item.file.lastModified,
            contentHash: newHash,
            extractedText: extraction.extractedText,
            charCount: extraction.charCount,
            wordCount: extraction.wordCount,
            pageCount: extraction.pageCount,
            pages: extraction.pages,
            isMissing: false,
            metadata: indexData?.metadata || item.existingDoc.metadata,
          };

          await saveDocumentToDB(updatedDoc);
          updatedDocsMap.set(updatedDoc.id, updatedDoc);
          updatedCount++;
        } catch (changeErr) {
          console.warn('Failed to update changed file:', item.file.name, changeErr);
        }
      }

      // 2. Process New Files
      for (const item of diff.newFiles) {
        try {
          const extraction = await extractTextClientSide(item.file);
          const newHash = await computeFileHash(item.file);

          let indexData: any = null;
          try {
            const indexRes = await apiFetch('/api/index-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: extraction.filename,
                extractedText: extraction.extractedText,
              }),
            }, 1);
            indexData = await parseJsonSafely(indexRes, '/api/index-document');
          } catch {
            // Deterministic metadata fallback
          }

          const newDoc: DocumentRecord = {
            id: `${item.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            filename: extraction.filename,
            fileType: extraction.fileType,
            fileSize: item.size,
            dateAdded: new Date().toISOString(),
            extractedText: extraction.extractedText,
            charCount: extraction.charCount,
            wordCount: extraction.wordCount,
            pageCount: extraction.pageCount,
            pages: extraction.pages,
            status: 'ready',
            metadata: indexData?.metadata,
            sourceId: source.id,
            sourceType: 'local_folder',
            sourcePath: item.relativePath,
            lastModified: item.lastModified,
            contentHash: newHash,
            isMissing: false,
          };

          await saveDocumentToDB(newDoc);
          updatedDocsMap.set(newDoc.id, newDoc);
          newIndexedCount++;
        } catch (newErr) {
          console.warn('Failed to index new file:', item.name, newErr);
        }
      }

      // 3. Mark Missing Files Safely (Original disk files are never altered or deleted)
      for (const missing of diff.missingDocs) {
        const updatedMissing: DocumentRecord = {
          ...missing,
          isMissing: true,
        };
        await saveDocumentToDB(updatedMissing);
        updatedDocsMap.set(updatedMissing.id, updatedMissing);
      }

      // 4. Update Source Record
      const updatedSource: SourceRecord = {
        ...source,
        lastScanned: new Date().toISOString(),
        fileCount: files.length,
        status: 'connected',
      };
      await saveSourceToDB(updatedSource);

      setSources((prev) => prev.map((s) => (s.id === source.id ? updatedSource : s)));
      const finalDocs = Array.from(updatedDocsMap.values());
      setDocuments(finalDocs);
      recalculateSmartCollections(finalDocs, collections);

      showNotification(
        `Rescan complete: ${newIndexedCount} new, ${updatedCount} updated, ${diff.unchangedDocs.length} unchanged, ${diff.missingDocs.length} missing.`
      );
    } catch (rescanErr: any) {
      console.error('Rescan failed:', rescanErr);
      showNotification(`Rescan error: ${rescanErr.message || 'Folder could not be read.'}`);
    } finally {
      setIsRescanning(false);
    }
  };

  // Remove connected folder source (preserves original disk files)
  const handleRequestRemoveSource = (source: SourceRecord) => {
    setSourceToRemove(source);
  };

  const handleConfirmRemoveSource = async () => {
    if (!sourceToRemove) return;
    setIsRemovingSource(true);
    try {
      await deleteSourceFromDB(sourceToRemove.id);
      const remainingSources = sources.filter((s) => s.id !== sourceToRemove.id);
      setSources(remainingSources);

      // Remove documents indexed from this folder
      const docsToRemove = documents.filter((d) => d.sourceId === sourceToRemove.id);
      for (const d of docsToRemove) {
        await deleteDocumentFromDB(d.id);
      }

      const updatedDocs = documents.filter((d) => d.sourceId !== sourceToRemove.id);
      setDocuments(updatedDocs);
      recalculateSmartCollections(updatedDocs, collections);
      if (selectedSourceId === sourceToRemove.id) {
        setSelectedSourceId(null);
      }
      showNotification(`Removed folder "${sourceToRemove.name}" from library. Your files on disk remain safe.`);
      setSourceToRemove(null);
    } catch (err) {
      console.error('Failed to remove source folder:', err);
      showNotification('Failed to remove folder from library.');
    } finally {
      setIsRemovingSource(false);
    }
  };

  // Priority 3: In-app reliable Document Deletion (replaces window.confirm)
  const handleRequestDeleteDocument = (id: string, filename: string) => {
    setDocToDelete({ id, filename });
  };

  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    try {
      await deleteDocumentFromDB(docToDelete.id);
      const updated = documents.filter(d => d.id !== docToDelete.id);
      setDocuments(updated);
      recalculateSmartCollections(updated, collections);
      if (searchResults) {
        setSearchResults(searchResults.filter(r => r.documentId !== docToDelete.id));
      }
      if (inspectedDoc?.id === docToDelete.id) {
        setInspectedDoc(null);
      }
      showNotification(`Removed "${docToDelete.filename}" from library.`);
      setDocToDelete(null);
    } catch (err) {
      console.error('Failed to delete document from DB:', err);
      showNotification('Error removing document. Please try again.');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // Clear entire library
  const handleConfirmClearLibrary = async () => {
    setIsClearingLibrary(true);
    try {
      await clearAllDocumentsFromDB();
      setDocuments([]);
      setCollections([]);
      setSources([]);
      setSearchResults(null);
      setActiveQuery('');
      setSelectedCollection(null);
      setSelectedSourceId(null);
      setInspectedDoc(null);
      setIsClearLibraryOpen(false);
      showNotification("Library cleared. Source files on disk remain untouched.");
    } catch (err) {
      console.error('Failed to clear library:', err);
      showNotification("Could not clear library.");
    } finally {
      setIsClearingLibrary(false);
    }
  };

  // Collection CRUD
  const handleCreateCollection = async (name: string) => {
    const newCol: SmartCollection = {
      id: `custom-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      documentCount: 0,
      documentIds: [],
      isAutoSuggested: false,
      sampleTopics: [],
    };
    await saveCollectionToDB(newCol);
    const updated = [newCol, ...collections];
    setCollections(updated);
    setSelectedCollection(name);
    showNotification(`Created collection "${name}".`);
  };

  const handleRenameCollection = async (oldName: string, newName: string) => {
    const updated = collections.map(c => c.name === oldName ? { ...c, name: newName } : c);
    setCollections(updated);
    if (selectedCollection === oldName) {
      setSelectedCollection(newName);
    }
    showNotification(`Renamed collection to "${newName}".`);
  };

  const handleDeleteCollection = async (name: string) => {
    const col = collections.find(c => c.name === name);
    if (col) {
      await deleteCollectionFromDB(col.id);
      const updated = collections.filter(c => c.name !== name);
      setCollections(updated);
      if (selectedCollection === name) {
        setSelectedCollection(null);
      }
      showNotification(`Removed collection "${name}".`);
    }
  };

  const selectedSource = sources.find((s) => s.id === selectedSourceId) || null;

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-900 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-stone-900 text-stone-100 px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl border border-stone-800 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        modelInfo={modelInfo}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenModelInfo={() => setIsModelInfoOpen(true)}
        onClearLibrary={() => setIsClearLibraryOpen(true)}
        totalDocs={documents.length}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Sidebar */}
        <Sidebar
          documents={documents}
          collections={collections}
          selectedCollection={selectedCollection}
          onSelectCollection={(col) => {
            setSelectedCollection(col);
            setSelectedSourceId(null);
            setSearchResults(null);
          }}
          activeView={activeView}
          onChangeView={(v) => {
            setActiveView(v);
            setSearchResults(null);
          }}
          onOpenModelInfo={() => setIsModelInfoOpen(true)}
          modelInfo={modelInfo}
          sources={sources}
          selectedSourceId={selectedSourceId}
          onSelectSource={(sourceId) => {
            setSelectedSourceId(sourceId);
            setSelectedCollection(null);
            setSearchResults(null);
          }}
          onRescanSource={handleRescanSource}
          onRemoveSource={handleRequestRemoveSource}
          isRescanning={isRescanning}
          onOpenUpload={() => setIsUploadOpen(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 min-w-0 max-w-4xl">
          {activeView === 'history' ? (
            /* Protected User Search History View */
            <SearchHistoryView
              onSelectQuery={(query) => {
                setActiveView('library');
                handleSearch(query);
              }}
            />
          ) : (
            <>
              {/* Prominent Natural Language Search Area */}
              <section className="space-y-4">
                <div className="space-y-1">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
                    Find what you remember.
                  </h1>
                  <p className="text-xs sm:text-sm text-stone-600">
                    Search your document library using ordinary recollections, concepts, and fragments — even without remembering filenames.
                  </p>
                </div>

                <SearchBar
                  onSearch={handleSearch}
                  isLoading={isSearching}
                  activeQuery={activeQuery}
                  onClear={handleClearSearch}
                  hasDocs={documents.length > 0}
                  isRecallMode={isRecallMode}
                  onToggleRecallMode={setIsRecallMode}
                  refinements={searchRefinements}
                  onUpdateRefinements={setSearchRefinements}
                />
              </section>

              {/* Conditional View Rendering */}
              {searchResults !== null ? (
                /* Search Results View */
                <SearchResultsView
                  query={activeQuery}
                  results={searchResults}
                  isLoading={isSearching}
                  onSelectDocument={(doc) => setInspectedDoc(doc)}
                  onClearSearch={handleClearSearch}
                  recallMode={isRecallMode}
                  interpretedClues={searchResponse?.interpretedClues}
                  suggestedAlternativeClues={searchResponse?.suggestedAlternativeClues}
                  onApplyAlternativeClue={(clue) => {
                    handleSearch(clue, isRecallMode, searchRefinements);
                  }}
                />
              ) : activeView === 'collections' ? (
                /* Smart Collections Management */
                <SmartCollectionsView
                  collections={collections}
                  documents={documents}
                  selectedCollection={selectedCollection}
                  onSelectCollection={(name) => {
                    setSelectedCollection(name);
                    setActiveView('library');
                  }}
                  onCreateCollection={handleCreateCollection}
                  onRenameCollection={handleRenameCollection}
                  onDeleteCollection={handleDeleteCollection}
                />
              ) : (
                /* Primary Library View */
                <section className="space-y-6">
                  {documents.length === 0 ? (
                    /* Clean Empty Library Onboarding (Zero Demo/Seeded Data) */
                    <div className="py-16 px-6 text-center rounded-2xl border-2 border-dashed border-stone-200 bg-white/60 space-y-5">
                      <div className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-800 mx-auto flex items-center justify-center shadow-xs">
                        <BookOpen className="w-8 h-8 text-amber-700" />
                      </div>
                      <div className="max-w-md mx-auto space-y-2">
                        <h2 className="font-serif text-xl font-bold text-stone-900">
                          Your document library is empty
                        </h2>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          Connect a folder from your computer or upload your PDFs, Markdown notes, or text files to index summaries, topics, and quotes for natural-language Recall search.
                        </p>
                      </div>

                      <div className="flex items-center justify-center flex-wrap gap-3 pt-2">
                        <button
                          onClick={() => setIsUploadOpen(true)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                          <FolderPlus className="w-4 h-4 text-amber-300" />
                          <span>Connect Folder or Import Files</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-stone-500 pt-4 flex items-center justify-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Source files on your computer are read-only and never modified, moved, or deleted.</span>
                      </div>
                    </div>
                  ) : (
                    <DocumentList
                      documents={documents}
                      onSelectDocument={(doc) => setInspectedDoc(doc)}
                      onDeleteDocument={handleRequestDeleteDocument}
                      selectedCollection={selectedCollection}
                      selectedSource={selectedSource}
                      onClearSourceFilter={() => setSelectedSourceId(null)}
                    />
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {/* Upload & Folder Connector Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDocumentsAdded={handleDocumentsAdded}
        sources={sources}
      />

      {/* Document Inspector Modal */}
      <DocumentInspectorModal
        document={inspectedDoc}
        allDocuments={documents}
        onClose={() => setInspectedDoc(null)}
        onSelectDocument={(doc) => setInspectedDoc(doc)}
        onDeleteDocument={handleRequestDeleteDocument}
      />

      {/* Model Info & Privacy Transparency Modal */}
      <ModelInfoModal
        isOpen={isModelInfoOpen}
        onClose={() => setIsModelInfoOpen(false)}
        modelInfo={modelInfo}
      />

      {/* In-App Delete Confirmation Modal (Priority 3) */}
      <DeleteConfirmationModal
        isOpen={docToDelete !== null}
        filename={docToDelete?.filename || ''}
        isDeleting={isDeletingDoc}
        onConfirm={handleConfirmDeleteDoc}
        onCancel={() => setDocToDelete(null)}
      />

      {/* Folder Removal Confirmation Modal */}
      {sourceToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
              <Folder className="w-6 h-6 text-amber-600" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-serif font-bold text-stone-900">
                Remove Connected Folder?
              </h3>
              <p className="text-xs text-stone-600">
                Are you sure you want to remove <span className="font-semibold text-stone-900">"{sourceToRemove.name}"</span> from your ContextKeeper library?
              </p>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Your device's original folder and files remain completely safe and untouched.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSourceToRemove(null)}
                disabled={isRemovingSource}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveSource}
                disabled={isRemovingSource}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs disabled:opacity-50"
              >
                {isRemovingSource ? 'Removing...' : 'Remove from Library'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Library Confirmation Modal */}
      {isClearLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-serif font-bold text-stone-900">
                Clear Browser Library?
              </h3>
              <p className="text-xs text-stone-600">
                This will clear all indexed documents and connected folder references from this browser's IndexedDB.
              </p>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Your actual files and folders on your computer are strictly read-only and will NOT be touched.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsClearLibraryOpen(false)}
                disabled={isClearingLibrary}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearLibrary}
                disabled={isClearingLibrary}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs disabled:opacity-50"
              >
                {isClearingLibrary ? 'Clearing...' : 'Clear Indexed Library'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Authentication Modal (Priority 2) */}
      <AuthModal />
    </div>
  );
}
