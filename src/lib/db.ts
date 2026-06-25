import { QueueItem, AttendanceRecord, Profile, AuditLog } from '../types';

const DB_NAME = 'absensi_sync_db';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';

const PROFILE_KEY = 'smkn1_profile_v1';
const ACTIVE_RECORDS_KEY = 'smkn1_active_records_key_v2';

export const DB = {
  open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
  }
};

function isRunningInServiceWorker(): boolean {
  return typeof window === 'undefined' || typeof localStorage === 'undefined';
}

function getQueueOwnerId(): string {
  if (isRunningInServiceWorker()) return 'SERVICE_WORKER';
  const userId = localStorage.getItem('smkn1_session_user_id');
  const role = localStorage.getItem('smkn1_role') || localStorage.getItem('smkn1_session_role') || 'guest';
  const profileRaw = localStorage.getItem(PROFILE_KEY);
  let nis = 'unknown';
  if (profileRaw) {
    try {
      const profile = JSON.parse(profileRaw);
      nis = profile.nis || 'unknown';
    } catch (_) {}
  }
  return userId || `${role}:${nis}`;
}

export const Queue = {
  async add(payload: QueueItem['payload']): Promise<string> {
    const db = await DB.open();
    const id = crypto.randomUUID ? crypto.randomUUID() : `queue-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const time = Date.now();
    const ownerId = getQueueOwnerId();

    const item: QueueItem = {
      id,
      ownerId,
      payload,
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: time,
      updatedAt: time
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.put(item);

      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAll(options: { includeFinalFailed?: boolean; ownerScoped?: boolean } = {}): Promise<QueueItem[]> {
    const includeFinalFailed = options.includeFinalFailed !== false;
    const ownerScoped = options.ownerScoped !== false;

    try {
      const db = await DB.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const ownerId = getQueueOwnerId();
          const items: QueueItem[] = Array.isArray(req.result) ? req.result : [];

          const filtered = items
            .filter(item => {
              if (!ownerScoped) return true;
              return item.ownerId === ownerId;
            })
            .filter(item => {
              if (includeFinalFailed) return true;
              return item.status !== 'failed_final';
            })
            .sort((a, b) => a.createdAt - b.createdAt);

          resolve(filtered);
        };

        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[DB] Gagal fetch queue, returning empty', e);
      return [];
    }
  },

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.get(id);

      req.onsuccess = () => {
        const item = req.result as QueueItem;
        if (!item) return resolve();

        item.status = 'pending';
        item.attempts = Number(item.attempts || 0) + 1;
        item.lastError = errorMessage || 'Unknown sync error';
        item.updatedAt = Date.now();

        store.put(item);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async markFinalFailed(id: string, errorMessage: string, attempts?: number): Promise<void> {
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.get(id);

      req.onsuccess = () => {
        const item = req.result as QueueItem;
        if (!item) return resolve();

        const currentAttempts = Number(item.attempts || 0);
        item.status = 'failed_final';
        item.attempts = attempts !== undefined ? attempts : currentAttempts + 1;
        item.lastError = errorMessage || 'Max retry reached';
        item.updatedAt = Date.now();

        store.put(item);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async remove(id: string): Promise<void> {
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearCurrentOwner(): Promise<void> {
    const db = await DB.open();
    const items = await this.getAll({ includeFinalFailed: true });
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);

      for (const item of items) {
        store.delete(item.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getStats() {
    const items = await this.getAll({ includeFinalFailed: true });
    return items.reduce(
      (acc, item) => {
        if (item.status === 'failed_final') acc.failedFinal += 1;
        else acc.pending += 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, pending: 0, failedFinal: 0 }
    );
  }
};

// ===================== STORAGE SERVICE =====================
export const StorageService = {
  getProfile(): Profile {
    const defaultProfile: Profile = {
      id: '',
      nis: '12345678',
      nama: 'M. Reza Pratama',
      kelas: 'XII RPL 1',
      tempatPkl: 'PT. Teknologi Karya (Tarakan)',
      role: 'siswa'
    };

    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile;

    try {
      const parsed = JSON.parse(raw);
      return { ...defaultProfile, ...parsed };
    } catch (_) {
      return defaultProfile;
    }
  },

  saveProfile(profile: Partial<Profile>) {
    const current = this.getProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  },

  getRecordsKey(): string | null {
    const userId = localStorage.getItem('smkn1_session_user_id') || '';
    const role = localStorage.getItem('smkn1_role') || localStorage.getItem('smkn1_session_role') || 'guest';
    if (role === 'admin') {
      return 'smkn1_records_v1_admin_all';
    }
    if (!userId) {
      return null;
    }
    return `smkn1_records_v1_${role}_${userId}`;
  },

  getRecords(): AttendanceRecord[] {
    const key = this.getRecordsKey();
    if (!key) return [];

    const raw = localStorage.getItem(key);
    if (!raw) return [];

    try {
      const data: AttendanceRecord[] = JSON.parse(raw);
      if (!Array.isArray(data)) return [];

      // Sort records by date descending
      return [...data].sort((a, b) => {
        const da = new Date(a.dateKey);
        const db = new Date(b.dateKey);
        return db.getTime() - da.getTime();
      });
    } catch (_) {
      return [];
    }
  },

  saveRecords(records: AttendanceRecord[]) {
    const key = this.getRecordsKey();
    if (!key) return;

    // Filter, sort and save
    const sorted = [...records].sort((a, b) => {
      const da = new Date(a.dateKey);
      const db = new Date(b.dateKey);
      return db.getTime() - da.getTime();
    });

    localStorage.setItem(key, JSON.stringify(sorted));
    localStorage.setItem(ACTIVE_RECORDS_KEY, key);
  },

  clearRecords() {
    const key = this.getRecordsKey();
    if (key) {
      localStorage.removeItem(key);
    }
  },

  // Audit Logs for validation history
  getAdminAuditStorageKey(): string {
    const userId = localStorage.getItem('smkn1_session_user_id') || 'unknown';
    return `smkn1_admin_validation_audit_v1_${userId}`;
  },

  getAdminAuditLogs(): AuditLog[] {
    const key = this.getAdminAuditStorageKey();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  },

  saveAdminAuditLogs(logs: AuditLog[]) {
    const key = this.getAdminAuditStorageKey();
    localStorage.setItem(key, JSON.stringify(logs.slice(-500))); // limit to 500
  }
};
