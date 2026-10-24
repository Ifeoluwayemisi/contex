export interface ConnectorFile {
  name: string;
  relativePath: string;
  file: File;
  lastModified: number;
  size: number;
}

export interface SourceConnector {
  id: string;
  name: string;
  type: 'local_folder' | 'cloud_drive';
  isSupported(): boolean;
  pickFolder(): Promise<{ name: string; handle?: any; files: ConnectorFile[] }>;
  rescanFolder(handle?: any): Promise<ConnectorFile[]>;
}

/**
 * Computes a deterministic SHA-256 hash of a file's content in the browser using the Web Crypto API.
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback hash based on metadata if crypto.subtle is restricted
    const f = file as File;
    return `meta-${f.name}-${f.size}-${f.lastModified || Date.now()}`;
  }
}

/**
 * Checks if a filename has a supported document extension for ContextKeeper.
 */
export function isSupportedDocumentFilename(name: string): boolean {
  const lower = name.toLowerCase();
  // Filter out system and hidden files
  if (name.startsWith('.') || lower.includes('node_modules') || lower.includes('.git')) {
    return false;
  }

  const supportedExtensions = [
    '.pdf',
    '.md',
    '.markdown',
    '.txt',
    '.docx',
    '.csv',
    '.json',
    '.rtf'
  ];

  return supportedExtensions.some((ext) => lower.endsWith(ext));
}
