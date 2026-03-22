// Ibid — IndexedDB storage layer
// Replaces chrome.storage.local for citations (unlimited storage)
// Settings/projects/tags stay in chrome.storage.local (small, syncs easier)

const DB_NAME = 'ibid';
const DB_VERSION = 1;
const STORE_CITATIONS = 'citations';

let db = null;

export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CITATIONS)) {
        const store = db.createObjectStore(STORE_CITATIONS, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('dateAdded', '_dateAdded', { unique: false });
        store.createIndex('starred', '_starred', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => {
      console.error('[Ibid DB] Failed to open:', e.target.error);
      reject(e.target.error);
    };
  });
}

export async function getAllCitations() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CITATIONS, 'readonly');
    const store = tx.objectStore(STORE_CITATIONS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCitation(id) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CITATIONS, 'readonly');
    const store = tx.objectStore(STORE_CITATIONS);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putCitation(item) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CITATIONS, 'readwrite');
    const store = tx.objectStore(STORE_CITATIONS);
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putCitations(items) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CITATIONS, 'readwrite');
    const store = tx.objectStore(STORE_CITATIONS);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCitation(id) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CITATIONS, 'readwrite');
    const store = tx.objectStore(STORE_CITATIONS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCitations(ids) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CITATIONS, 'readwrite');
    const store = tx.objectStore(STORE_CITATIONS);
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllCitations() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CITATIONS, 'readwrite');
    const store = tx.objectStore(STORE_CITATIONS);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCitationCount() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CITATIONS, 'readonly');
    const store = tx.objectStore(STORE_CITATIONS);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Migration: move citations from chrome.storage.local to IndexedDB
export async function migrateFromChromeStorage() {
  const stored = await chrome.storage.local.get(['citations']);
  const citations = stored.citations || [];

  if (citations.length === 0) return 0;

  // Check if already migrated
  const existing = await getCitationCount();
  if (existing > 0) return 0; // already have data in IDB

  await putCitations(citations);

  // Remove from chrome.storage.local to free space
  await chrome.storage.local.remove(['citations']);

  console.log(`[Ibid DB] Migrated ${citations.length} citations to IndexedDB`);
  return citations.length;
}
