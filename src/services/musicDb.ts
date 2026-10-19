/**
 * IndexedDB storage manager for persistent local audio files and metadata.
 * Stores audio Blobs directly in IndexedDB so large media files persist across sessions
 * without using localStorage or external servers.
 */

export interface LocalTrackMetadata {
  id: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  size: number; // in bytes
  type: string; // MIME type
  addedAt: number; // timestamp
}

const DB_NAME = 'MyStudyPath_LocalMusicDB';
const DB_VERSION = 1;
const STORE_TRACKS = 'tracks_metadata';
const STORE_BLOBS = 'tracks_blobs';

class MusicDBManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_TRACKS)) {
          db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Save audio file and its metadata persistently into IndexedDB
   */
  public async saveTrack(metadata: LocalTrackMetadata, fileBlob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TRACKS, STORE_BLOBS], 'readwrite');

      const metaStore = tx.objectStore(STORE_TRACKS);
      const blobStore = tx.objectStore(STORE_BLOBS);

      metaStore.put(metadata);
      blobStore.put({ id: metadata.id, blob: fileBlob });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Fetch metadata for all stored local tracks
   */
  public async getAllTrackMetadata(): Promise<LocalTrackMetadata[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_TRACKS, 'readonly');
        const store = tx.objectStore(STORE_TRACKS);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = (request.result || []) as LocalTrackMetadata[];
          results.sort((a, b) => a.addedAt - b.addedAt);
          resolve(results);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('Unable to read music metadata from IndexedDB:', err);
      return [];
    }
  }

  /**
   * Fetch the raw audio Blob for a specific track ID
   */
  public async getTrackBlob(id: string): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly');
        const store = tx.objectStore(STORE_BLOBS);
        const request = store.get(id);

        request.onsuccess = () => {
          if (request.result && request.result.blob) {
            resolve(request.result.blob);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error(`Error retrieving audio blob for track ${id}:`, err);
      return null;
    }
  }

  /**
   * Delete a track and its audio Blob from IndexedDB
   */
  public async deleteTrack(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TRACKS, STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_TRACKS).delete(id);
      tx.objectStore(STORE_BLOBS).delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Clear all tracks and blobs from IndexedDB
   */
  public async clearAll(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TRACKS, STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_TRACKS).clear();
      tx.objectStore(STORE_BLOBS).clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const musicDB = new MusicDBManager();
