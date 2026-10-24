import { 
  ConnectorFile, 
  computeFileHash, 
  isSupportedDocumentFilename 
} from './types';
import { DocumentRecord } from '../../types';

// In-memory cache for browser FileSystemDirectoryHandle instances
const directoryHandlesMap = new Map<string, any>();

export function storeDirectoryHandle(sourceId: string, handle: any): void {
  if (handle) {
    directoryHandlesMap.set(sourceId, handle);
  }
}

export function getDirectoryHandle(sourceId: string): any | undefined {
  return directoryHandlesMap.get(sourceId);
}

/**
 * Checks whether the browser natively supports the File System Access API.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Recursively scans a FileSystemDirectoryHandle for supported documents.
 */
async function scanDirectoryHandle(
  dirHandle: any,
  currentPath = '',
  depth = 0
): Promise<ConnectorFile[]> {
  if (depth > 4) return []; // Guard against excessive recursion
  const files: ConnectorFile[] = [];

  for await (const entry of dirHandle.values()) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    if (entry.kind === 'file') {
      if (isSupportedDocumentFilename(entry.name)) {
        try {
          const file = await entry.getFile();
          files.push({
            name: entry.name,
            relativePath: entryPath,
            file,
            lastModified: file.lastModified,
            size: file.size,
          });
        } catch (fileErr) {
          console.warn(`Could not read file "${entry.name}":`, fileErr);
        }
      }
    } else if (entry.kind === 'directory') {
      // Skip hidden directories and build outputs
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        const subFiles = await scanDirectoryHandle(entry, entryPath, depth + 1);
        files.push(...subFiles);
      }
    }
  }

  return files;
}

/**
 * Prompts user to select a local folder using File System Access API, with explicit read permission.
 */
export async function pickFolderUsingFSA(): Promise<{
  name: string;
  handle: any;
  files: ConnectorFile[];
}> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser.');
  }

  const dirHandle = await (window as any).showDirectoryPicker({
    mode: 'read',
    startIn: 'documents',
  });

  const files = await scanDirectoryHandle(dirHandle, '', 0);

  return {
    name: dirHandle.name,
    handle: dirHandle,
    files,
  };
}

/**
 * Rescans an already connected folder handle. Checks and requests read permissions safely.
 */
export async function rescanFolderUsingHandle(handle: any): Promise<ConnectorFile[]> {
  if (!handle) {
    throw new Error('No directory handle available. Please re-select the folder.');
  }

  if (typeof handle.queryPermission === 'function') {
    let permission = await handle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') {
      permission = await handle.requestPermission({ mode: 'read' });
      if (permission !== 'granted') {
        throw new Error('Permission to access folder was not granted.');
      }
    }
  }

  return scanDirectoryHandle(handle, '', 0);
}

/**
 * Fallback file input method for browsers without File System Access API (or in iframes where restricted).
 */
export function pickFolderUsingInput(): Promise<{ name: string; files: ConnectorFile[] }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    (input as any).directory = true;
    input.multiple = true;
    input.style.display = 'none';

    input.onchange = () => {
      const fileList = input.files;
      if (!fileList || fileList.length === 0) {
        document.body.removeChild(input);
        return reject(new Error('No files selected.'));
      }

      const files: ConnectorFile[] = [];
      let detectedFolderName = 'Local Folder';

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const relPath = file.webkitRelativePath || file.name;
        
        if (i === 0 && file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/');
          if (parts.length > 1) {
            detectedFolderName = parts[0];
          }
        }

        if (isSupportedDocumentFilename(file.name)) {
          files.push({
            name: file.name,
            relativePath: relPath,
            file,
            lastModified: file.lastModified,
            size: file.size,
          });
        }
      }

      document.body.removeChild(input);
      resolve({
        name: detectedFolderName,
        files,
      });
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      reject(new Error('Folder selection cancelled.'));
    };

    document.body.appendChild(input);
    input.click();
  });
}

export interface DiffScanAnalysis {
  newFiles: ConnectorFile[];
  changedFiles: { file: ConnectorFile; existingDoc: DocumentRecord }[];
  unchangedDocs: DocumentRecord[];
  missingDocs: DocumentRecord[];
}

/**
 * Compares freshly scanned folder files against existing IndexedDB records.
 * Identifies new, modified (by lastModified and content hash), unchanged, and deleted/missing files.
 */
export async function analyzeFolderChanges(
  scannedFiles: ConnectorFile[],
  existingDocs: DocumentRecord[]
): Promise<DiffScanAnalysis> {
  const existingMap = new Map<string, DocumentRecord>();
  for (const doc of existingDocs) {
    const key = doc.sourcePath || doc.filename;
    existingMap.set(key, doc);
  }

  const newFiles: ConnectorFile[] = [];
  const changedFiles: { file: ConnectorFile; existingDoc: DocumentRecord }[] = [];
  const matchedExistingIds = new Set<string>();

  for (const item of scannedFiles) {
    const key = item.relativePath || item.name;
    const existing = existingMap.get(key) || existingDocs.find(d => d.filename === item.name);

    if (!existing) {
      // Brand new file
      newFiles.push(item);
    } else {
      matchedExistingIds.add(existing.id);

      // Check if file was modified (compare lastModified, size, and hash if available)
      const timeChanged = existing.lastModified && existing.lastModified !== item.lastModified;
      const sizeChanged = existing.fileSize !== item.size;

      if (timeChanged || sizeChanged) {
        // Compute SHA-256 hash to confirm if content actually changed
        const newHash = await computeFileHash(item.file);
        if (existing.contentHash && existing.contentHash === newHash) {
          // Content is identical despite timestamp touch
          continue;
        }
        changedFiles.push({ file: item, existingDoc: existing });
      }
    }
  }

  const missingDocs = existingDocs.filter(d => !matchedExistingIds.has(d.id));
  const unchangedDocs = existingDocs.filter(d => matchedExistingIds.has(d.id) && !changedFiles.some(c => c.existingDoc.id === d.id));

  return {
    newFiles,
    changedFiles,
    unchangedDocs,
    missingDocs,
  };
}
