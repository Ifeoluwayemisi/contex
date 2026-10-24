/**
 * Google Drive Connector Boundary
 * 
 * Prepares the architectural interface for future cloud integration.
 * In this hackathon MVP phase, OAuth and live cloud synchronization are intentionally
 * decoupled to maintain security, privacy, and local-first reliability.
 */

import { SourceConnector, ConnectorFile } from './types';

export interface GoogleDriveFolderConfig {
  folderId: string;
  folderName: string;
  userEmail?: string;
  driveType?: 'personal' | 'shared';
}

export class GoogleDriveConnector implements SourceConnector {
  id = 'google-drive-connector';
  name = 'Google Drive';
  type = 'cloud_drive' as const;

  /**
   * Cloud drive connector is prepared for desktop companion and authorized OAuth.
   * Currently inactive in the local-first MVP.
   */
  isSupported(): boolean {
    return false;
  }

  async pickFolder(): Promise<{ name: string; handle?: any; files: ConnectorFile[] }> {
    throw new Error(
      'Google Drive integration will be enabled in a future update. For this release, use Local Folder or file upload.'
    );
  }

  async rescanFolder(_handle?: any): Promise<ConnectorFile[]> {
    throw new Error(
      'Google Drive synchronization is not active in this build.'
    );
  }
}
