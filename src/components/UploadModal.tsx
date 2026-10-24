import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FolderPlus,
  Folder,
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  FileCode, 
  RefreshCw,
  StopCircle,
  HardDrive,
  Shield,
  Info
} from 'lucide-react';
import { DocumentRecord, SourceRecord } from '../types';
import { apiFetch, parseJsonSafely } from '../lib/api';
import { extractTextClientSide } from '../lib/clientExtractor';
import { 
  pickFolderUsingFSA, 
  pickFolderUsingInput, 
  isFileSystemAccessSupported, 
  storeDirectoryHandle 
} from '../lib/connectors/LocalFolderConnector';
import { computeFileHash, ConnectorFile } from '../lib/connectors/types';
import { saveSourceToDB } from '../lib/db';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentsAdded: (docs: DocumentRecord[], source?: SourceRecord) => void;
  sources: SourceRecord[];
}

interface UploadTask {
  id: string;
  file: File;
  relativePath?: string;
  sourceId?: string;
  status: 'pending' | 'extracting' | 'indexing' | 'ready' | 'error';
  errorMessage?: string;
  extractedDoc?: DocumentRecord;
  progressPercent: number;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onDocumentsAdded,
  sources
}) => {
  const [activeTab, setActiveTab] = useState<'folder' | 'files'>('folder');
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFolderSource, setCurrentFolderSource] = useState<SourceRecord | null>(null);
  const abortControllerRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesSelected = (files: FileList | null, sourceId?: string) => {
    if (!files || files.length === 0) return;

    const newTasks: UploadTask[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      relativePath: (f as any).webkitRelativePath || f.name,
      sourceId,
      status: 'pending',
      progressPercent: 10,
    }));

    setTasks((prev) => [...prev, ...newTasks]);
    processUploadQueue(newTasks, sourceId);
  };

  const handleConnectFolder = async () => {
    try {
      let folderResult: { name: string; handle?: any; files: ConnectorFile[] };

      if (isFileSystemAccessSupported()) {
        try {
          folderResult = await pickFolderUsingFSA();
        } catch (fsaErr: any) {
          if (fsaErr.name === 'AbortError') return; // User cancelled picker
          // Fall back to input if FSA restricted in iframe
          folderResult = await pickFolderUsingInput();
        }
      } else {
        folderResult = await pickFolderUsingInput();
      }

      if (!folderResult.files || folderResult.files.length === 0) {
        alert(`No supported documents (.pdf, .md, .txt, .docx) found in "${folderResult.name}".`);
        return;
      }

      const sourceId = `source-folder-${Date.now()}`;
      const newSource: SourceRecord = {
        id: sourceId,
        name: folderResult.name,
        type: 'local_folder',
        folderPath: folderResult.name,
        lastScanned: new Date().toISOString(),
        fileCount: folderResult.files.length,
        status: 'connected',
      };

      if (folderResult.handle) {
        storeDirectoryHandle(sourceId, folderResult.handle);
      }
      await saveSourceToDB(newSource);
      setCurrentFolderSource(newSource);

      const newTasks: UploadTask[] = folderResult.files.map((item) => ({
        id: `${item.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file: item.file,
        relativePath: item.relativePath,
        sourceId,
        status: 'pending',
        progressPercent: 10,
      }));

      setTasks((prev) => [...prev, ...newTasks]);
      processUploadQueue(newTasks, sourceId, newSource);
    } catch (err: any) {
      if (err.message && !err.message.includes('cancelled')) {
        console.warn('Folder selection error:', err.message);
      }
    }
  };

  const handleCancelBatch = () => {
    abortControllerRef.current = true;
    setIsProcessing(false);
  };

  const processUploadQueue = async (
    taskList: UploadTask[], 
    sourceId?: string, 
    sourceRecord?: SourceRecord
  ) => {
    setIsProcessing(true);
    abortControllerRef.current = false;
    const completedDocs: DocumentRecord[] = [];

    for (const task of taskList) {
      if (abortControllerRef.current) {
        updateTask(task.id, {
          status: 'error',
          errorMessage: 'Batch import cancelled by user.',
          progressPercent: 100,
        });
        continue;
      }

      // Check file size limit
      if (task.file.size > MAX_FILE_SIZE_BYTES) {
        updateTask(task.id, {
          status: 'error',
          errorMessage: `File exceeds maximum limit of 15MB (${(task.file.size / (1024 * 1024)).toFixed(1)}MB).`,
          progressPercent: 100,
        });
        continue;
      }

      // Step 1: Extraction
      updateTask(task.id, { status: 'extracting', progressPercent: 30 });

      try {
        let extracted: any = null;

        // Attempt 1: Server-side extraction
        try {
          const formData = new FormData();
          formData.append('files', task.file);

          const uploadRes = await apiFetch('/api/upload', {
            method: 'POST',
            body: formData,
          }, 1);

          const uploadData = await parseJsonSafely(uploadRes, '/api/upload');
          extracted = uploadData.documents?.[0];
        } catch (serverUploadErr: any) {
          console.warn(
            `Server upload endpoint notice (${serverUploadErr.message}). Using client-side extraction fallback for "${task.file.name}"...`
          );
          // Attempt 2: Resilient client-side extraction fallback
          try {
            extracted = await extractTextClientSide(task.file);
          } catch (clientExtractErr: any) {
            throw new Error(`Text extraction failed: ${clientExtractErr.message || serverUploadErr.message}`);
          }
        }

        if (!extracted) {
          throw new Error('No document text could be extracted.');
        }

        if (extracted.error) {
          updateTask(task.id, {
            status: 'error',
            errorMessage: extracted.error,
            progressPercent: 100,
          });
          continue;
        }

        // Step 2: Gemma AI Indexing
        updateTask(task.id, { status: 'indexing', progressPercent: 65 });

        let indexData: any = null;
        try {
          const indexRes = await apiFetch('/api/index-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: extracted.filename,
              extractedText: extracted.extractedText,
            }),
          }, 1);

          indexData = await parseJsonSafely(indexRes, '/api/index-document');
        } catch (indexErr: any) {
          console.warn(`Gemma indexing notice for "${extracted.filename}", preserving extracted text:`, indexErr.message);
          const rawText = extracted.extractedText || '';
          const sentences = rawText.split(/(?<=[.?!])\s+/).filter((s: string) => s.length > 20).slice(0, 2);
          indexData = {
            success: true,
            aiIndexingFailed: true,
            errorMessage: indexErr.message,
            metadata: {
              summary: sentences.length > 0
                ? sentences.join(' ').slice(0, 320)
                : `Document extracted from "${extracted.filename}" (${extracted.charCount.toLocaleString()} chars). AI indexing service unavailable.`,
              topics: ['General Reference'],
              keywords: [extracted.filename.replace(/\.[^/.]+$/, "")],
              documentType: extracted.fileType === 'pdf' ? 'PDF Document' : 'Document',
              distinctivePhrases: sentences.slice(0, 1),
              dateMentions: [],
              suggestedCollections: ['General Reference']
            }
          };
        }

        // Compute SHA-256 hash for change detection
        const contentHash = await computeFileHash(task.file);

        const docRecord: DocumentRecord = {
          id: task.id,
          filename: extracted.filename,
          fileType: extracted.fileType,
          fileSize: extracted.fileSize,
          dateAdded: new Date().toISOString(),
          extractedText: extracted.extractedText,
          charCount: extracted.charCount,
          wordCount: extracted.wordCount,
          pageCount: extracted.pageCount,
          pages: extracted.pages,
          status: 'ready',
          aiIndexingFailed: indexData.aiIndexingFailed || false,
          errorMessage: indexData.errorMessage,
          metadata: indexData.metadata || indexData.fallbackMetadata,
          sourceId: task.sourceId || sourceId,
          sourceType: task.sourceId || sourceId ? 'local_folder' : 'file_upload',
          sourcePath: task.relativePath || task.file.name,
          lastModified: task.file.lastModified,
          contentHash,
          isMissing: false,
        };

        completedDocs.push(docRecord);
        updateTask(task.id, {
          status: 'ready',
          extractedDoc: docRecord,
          progressPercent: 100,
        });
      } catch (err: any) {
        let msg = err.message || 'Processing failed.';
        if (msg.toLowerCase().includes('failed to fetch')) {
          msg = 'Network connection interrupted during upload. Please click retry.';
        }
        updateTask(task.id, {
          status: 'error',
          errorMessage: msg,
          progressPercent: 100,
        });
      }
    }

    if (completedDocs.length > 0) {
      onDocumentsAdded(completedDocs, sourceRecord || currentFolderSource || undefined);
    }
    setIsProcessing(false);
  };

  const updateTask = (id: string, updates: Partial<UploadTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleRetry = (task: UploadTask) => {
    updateTask(task.id, { status: 'pending', errorMessage: undefined, progressPercent: 10 });
    processUploadQueue([task], task.sourceId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const totalFinished = tasks.filter((t) => t.status === 'ready').length;
  const totalFailed = tasks.filter((t) => t.status === 'error').length;
  const inProgressTask = tasks.find((t) => t.status === 'extracting' || t.status === 'indexing');
  const progressRatio = tasks.length > 0 ? Math.round(((totalFinished + totalFailed) / tasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div>
            <h2 className="text-lg font-serif font-bold text-stone-900">
              Add Documents to ContextKeeper
            </h2>
            <p className="text-xs text-stone-500">
              Connect a local folder or select individual files to index with Google Gemma.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-stone-200 px-6 pt-2 bg-stone-50/30 gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('folder')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'folder'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-amber-700" />
            <span>Connect Local Folder</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px]">
              Recommended
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'files'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Upload className="w-4 h-4 text-stone-500" />
            <span>Upload Loose Files</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'folder' ? (
            /* Folder Import Card */
            <div className="space-y-4">
              <div className="p-6 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/40 text-center space-y-4 hover:border-stone-400 transition-colors">
                <div className="h-14 w-14 rounded-2xl bg-amber-100/70 text-amber-900 mx-auto flex items-center justify-center">
                  <Folder className="w-7 h-7 text-amber-700" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="font-serif text-base font-semibold text-stone-900">
                    Connect a Folder on Your Computer
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    ContextKeeper will scan your chosen folder for PDFs, Markdown notes, Word docs, and text files. Original files remain untouched on your disk.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleConnectFolder}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 text-amber-300" />
                    <span>Choose Local Folder to Index</span>
                  </button>
                </div>

                <div className="flex items-center justify-center gap-4 text-[11px] text-stone-500 pt-2 border-t border-stone-200/60">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    Read-only (never edits or deletes files)
                  </span>
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                    One-click rescan supported
                  </span>
                </div>
              </div>

              {/* Already Connected Folders */}
              {sources.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Currently Connected Folders ({sources.length})
                  </span>
                  <div className="space-y-1.5">
                    {sources.map((src) => (
                      <div
                        key={src.id}
                        className="p-3 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Folder className="w-4 h-4 text-amber-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900 truncate">{src.name}</p>
                            <p className="text-[10px] text-stone-400">
                              {src.fileCount} files indexed • Last scanned: {src.lastScanned ? new Date(src.lastScanned).toLocaleDateString() : 'recently'}
                            </p>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Connected
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* File Dropzone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-stone-900 bg-stone-100/60 scale-[0.99]'
                  : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.yaml,.yml,.rtf,.log"
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />

              <div className="h-12 w-12 rounded-full bg-stone-100 mx-auto flex items-center justify-center mb-3 text-stone-600">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-stone-900">
                Drop files here, or <span className="underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Supports PDFs, Word (.docx), Markdown, Data, and text files up to 15MB
              </p>

              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 text-[11px] text-stone-500">
                <span className="px-2 py-0.5 rounded bg-stone-100">PDF & Slides</span>
                <span className="px-2 py-0.5 rounded bg-stone-100">Word (.docx)</span>
                <span className="px-2 py-0.5 rounded bg-stone-100">Markdown (.md)</span>
                <span className="px-2 py-0.5 rounded bg-stone-100">Plain text (.txt)</span>
                <span className="px-2 py-0.5 rounded bg-stone-100">CSV & JSON</span>
              </div>
            </div>
          )}

          {/* Batch Progress Overview */}
          {tasks.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-xl bg-stone-100/80 border border-stone-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-medium text-stone-800">
                  <div className="flex items-center gap-2">
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>
                      {isProcessing
                        ? `Processing file ${totalFinished + totalFailed + 1} of ${tasks.length} (${progressRatio}%)`
                        : `Batch complete: ${totalFinished} ready, ${totalFailed} failed`}
                    </span>
                  </div>

                  {isProcessing && (
                    <button
                      type="button"
                      onClick={handleCancelBatch}
                      className="inline-flex items-center gap-1 text-[11px] text-rose-700 hover:text-rose-900 font-medium cursor-pointer"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Cancel batch</span>
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                  <div 
                    className="h-full bg-stone-900 transition-all duration-300"
                    style={{ width: `${progressRatio}%` }}
                  />
                </div>

                {inProgressTask && (
                  <p className="text-[11px] text-stone-500 truncate">
                    Currently indexing: <span className="font-medium text-stone-800">{inProgressTask.file.name}</span>
                  </p>
                )}
              </div>

              {/* Task List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 text-xs flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {task.file.name.endsWith('.pdf') ? (
                          <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : task.file.name.endsWith('.docx') || task.file.name.endsWith('.doc') ? (
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : task.file.name.endsWith('.md') ? (
                          <FileCode className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-stone-600 shrink-0" />
                        )}
                        <span className="font-medium text-stone-900 truncate">
                          {task.relativePath || task.file.name}
                        </span>
                        <span className="text-[11px] text-stone-400 shrink-0">
                          ({(task.file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {task.status === 'extracting' && (
                          <span className="inline-flex items-center gap-1 text-stone-600">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Extracting text...</span>
                          </span>
                        )}
                        {task.status === 'indexing' && (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-600" />
                            <span>Gemma indexing...</span>
                          </span>
                        )}
                        {task.status === 'ready' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Ready</span>
                          </span>
                        )}
                        {task.status === 'error' && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                              <AlertCircle className="w-4 h-4 text-rose-600" />
                              <span>Failed</span>
                            </span>
                            <button
                              onClick={() => handleRetry(task)}
                              className="p-1 hover:bg-stone-200 rounded text-stone-600 cursor-pointer"
                              title="Retry processing"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Error message breakdown */}
                    {task.status === 'error' && task.errorMessage && (
                      <div className="p-2 rounded bg-rose-50 text-rose-900 text-[11px] border border-rose-200 leading-relaxed">
                        {task.errorMessage}
                      </div>
                    )}

                    {/* Metadata Preview for Ready Docs */}
                    {task.status === 'ready' && task.extractedDoc?.metadata && (
                      <div className="p-2 rounded bg-white text-stone-700 text-[11px] border border-stone-200/80 space-y-1">
                        <p className="line-clamp-2 text-stone-800">
                          <span className="font-medium text-stone-900">Summary: </span>
                          {task.extractedDoc.metadata.summary}
                        </p>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                            {task.extractedDoc.metadata.documentType}
                          </span>
                          {task.extractedDoc.metadata.topics.slice(0, 3).map((topic, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                              #{topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs">
          <span className="text-stone-500">
            {isProcessing ? 'Processing files with Gemma...' : `${tasks.length} total queued`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
          >
            {tasks.length > 0 ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
