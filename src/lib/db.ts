import { DocumentRecord, SmartCollection, SourceRecord } from '../types';

const DB_NAME = 'contextkeeper_db';
const DB_VERSION = 2;
const STORE_DOCS = 'documents';
const STORE_COLLECTIONS = 'collections';
const STORE_SOURCES = 'sources';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) {
        db.createObjectStore(STORE_COLLECTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SOURCES)) {
        db.createObjectStore(STORE_SOURCES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllDocumentsFromDB(): Promise<DocumentRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DOCS, 'readonly');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load documents from IndexedDB:', err);
    return [];
  }
}

export async function saveDocumentToDB(doc: DocumentRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, 'readwrite');
    const store = tx.objectStore(STORE_DOCS);
    const req = store.put(doc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDocumentFromDB(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, 'readwrite');
    const store = tx.objectStore(STORE_DOCS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllDocumentsFromDB(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DOCS, STORE_COLLECTIONS, STORE_SOURCES], 'readwrite');
    tx.objectStore(STORE_DOCS).clear();
    tx.objectStore(STORE_COLLECTIONS).clear();
    tx.objectStore(STORE_SOURCES).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllCollectionsFromDB(): Promise<SmartCollection[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COLLECTIONS, 'readonly');
      const store = tx.objectStore(STORE_COLLECTIONS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load collections from IndexedDB:', err);
    return [];
  }
}

export async function saveCollectionToDB(collection: SmartCollection): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLLECTIONS, 'readwrite');
    const store = tx.objectStore(STORE_COLLECTIONS);
    const req = store.put(collection);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCollectionFromDB(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLLECTIONS, 'readwrite');
    const store = tx.objectStore(STORE_COLLECTIONS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSourcesFromDB(): Promise<SourceRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SOURCES, 'readonly');
      const store = tx.objectStore(STORE_SOURCES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load sources from IndexedDB:', err);
    return [];
  }
}

export async function saveSourceToDB(source: SourceRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SOURCES, 'readwrite');
    const store = tx.objectStore(STORE_SOURCES);
    const req = store.put(source);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSourceFromDB(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SOURCES, 'readwrite');
    const store = tx.objectStore(STORE_SOURCES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Priority 1: Safe one-time cleanup migration that removes ONLY seeded/demo documents
 * and sample packs without deleting user-created documents or clearing the whole database.
 */
export async function cleanSeededDemoDocuments(): Promise<number> {
  try {
    const db = await openDatabase();
    const docs = await getAllDocumentsFromDB();
    const demoDocs = docs.filter(
      (d) =>
        d.id.startsWith('sample-') ||
        d.id.startsWith('demo-') ||
        d.sourceType === 'sample_pack' ||
        (d as any).isSample === true ||
        (d as any).isDemo === true
    );

    if (demoDocs.length === 0) {
      return 0;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DOCS, 'readwrite');
      const store = tx.objectStore(STORE_DOCS);
      for (const doc of demoDocs) {
        store.delete(doc.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.info(`[ContextKeeper] Cleaned ${demoDocs.length} legacy demo/sample documents from IndexedDB.`);
    return demoDocs.length;
  } catch (err) {
    console.error('Failed to clean seeded demo documents:', err);
    return 0;
  }
}
