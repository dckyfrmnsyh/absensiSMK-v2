export interface Profile {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  tempatPkl: string;
  role: 'siswa' | 'admin';
}

export interface LocationData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

export interface AttendanceEntry {
  type: 'masuk' | 'keluar';
  time: string;
  localTime?: string;
  isoTime: string | null;
  location: LocationData | null;
  locationText: string;
  photo: string | null; // base64 string
  createdAt?: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  dateKey: string; // YYYY-MM-DD
  status: 'Pending' | 'Valid' | 'Ditolak';
  nis: string;
  nama: string;
  kelas: string;
  tempatPkl: string;
  validatedAt: string | null;
  validatedBy: string | null;
  validatedByName?: string | null;
  masuk: AttendanceEntry | null;
  keluar: AttendanceEntry | null;
  createdAt: string;
  updatedAt: string;
  auditLog?: AuditLog[];
}

export interface AuditLog {
  id: string;
  type: 'ADMIN_VALIDATION_AUDIT';
  recordId: string;
  targetNis: string;
  targetNama: string;
  targetKelas: string;
  targetDateKey: string;
  oldStatus: string;
  newStatus: string;
  adminId: string;
  adminName: string;
  adminRole: string;
  source: 'online' | 'offline';
  synced: boolean;
  validatedAt: string;
  serverValidatedAt: string | null;
  createdAt: string;
  userAgent: string;
}

export interface QueueItem {
  id: string;
  ownerId: string;
  payload: {
    type: 'ABSEN' | 'PROFILE_UPDATE' | 'ADMIN_STATUS_UPDATE';
    record?: any;
    entryType?: 'masuk' | 'keluar';
    profile?: any;
    recordId?: string;
    status?: string;
    validatedAt?: string;
    audit?: any;
    action?: string;
  };
  status: 'pending' | 'failed_final';
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}
export type LaporanHarianEntry = {
  id: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:mm
  end: string;    // HH:mm
  uraian: string;
};

export type LaporanHarianProfileMeta = {
  namaSiswa: string;
  nis: string;
  kelas: string;
  tempatPkl?: string;
};