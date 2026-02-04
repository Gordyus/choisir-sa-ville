/**
 * IndexedDB Cache
 *
 * Simple IndexedDB-based cache with TTL support.
 * Used for caching entity data with a 7-day expiration.
 */

const DB_NAME = "choisir-sa-ville-cache";
const DB_VERSION = 1;
const STORE_NAME = "entities";

// Default TTL: 7 days in milliseconds
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry<T> {
    key: string;
    data: T;
    expiresAt: number;
    dataVersion?: string;
}

export interface CacheConfig {
    /** Cache TTL in milliseconds (default: 7 days) */
    ttlMs?: number;
    /** Database name (default: "choisir-sa-ville-cache") */
    dbName?: string;
}

// ============================================================================
// IndexedDB Cache Implementation
// ============================================================================

export class IndexedDbCache {
    private dbName: string;
    private ttlMs: number;
    private dbPromise: Promise<IDBDatabase> | null = null;

    constructor(config?: CacheConfig) {
        this.dbName = config?.dbName ?? DB_NAME;
        this.ttlMs = config?.ttlMs ?? DEFAULT_TTL_MS;
    }

    /**
     * Get a value from cache.
     * Returns null if not found or expired.
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const db = await this.openDatabase();
            const entry = await this.getEntry<T>(db, key);

            if (!entry) {
                return null;
            }

            // Check TTL
            if (Date.now() > entry.expiresAt) {
                // Entry expired, remove it
                void this.delete(key);
                return null;
            }

            return entry.data;
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.warn("[IndexedDbCache] Failed to get", key, error);
            }
            return null;
        }
    }

    /**
     * Set a value in cache with TTL.
     */
    async set<T>(key: string, data: T, dataVersion?: string): Promise<void> {
        try {
            const db = await this.openDatabase();
            const entry: CacheEntry<T> = {
                key,
                data,
                expiresAt: Date.now() + this.ttlMs,
                ...(dataVersion !== undefined && { dataVersion })
            };
            await this.putEntry(db, entry);
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.warn("[IndexedDbCache] Failed to set", key, error);
            }
        }
    }

    /**
     * Delete a value from cache.
     */
    async delete(key: string): Promise<void> {
        try {
            const db = await this.openDatabase();
            await this.deleteEntry(db, key);
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.warn("[IndexedDbCache] Failed to delete", key, error);
            }
        }
    }

    /**
     * Clear all entries from cache.
     */
    async clear(): Promise<void> {
        try {
            const db = await this.openDatabase();
            await this.clearStore(db);
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.warn("[IndexedDbCache] Failed to clear", error);
            }
        }
    }

    /**
     * Check if IndexedDB is available.
     */
    static isAvailable(): boolean {
        try {
            return typeof indexedDB !== "undefined" && indexedDB !== null;
        } catch {
            return false;
        }
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private openDatabase(): Promise<IDBDatabase> {
        if (this.dbPromise) {
            return this.dbPromise;
        }

        this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(this.dbName, DB_VERSION);

            request.onerror = () => {
                this.dbPromise = null;
                reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "key" });
                }
            };
        });

        return this.dbPromise;
    }

    private getEntry<T>(db: IDBDatabase, key: string): Promise<CacheEntry<T> | null> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result as CacheEntry<T> | null);
            };
        });
    }

    private putEntry<T>(db: IDBDatabase, entry: CacheEntry<T>): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    private deleteEntry(db: IDBDatabase, key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    private clearStore(db: IDBDatabase): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}
