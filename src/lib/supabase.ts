import { createClient } from '@supabase/supabase-js';
import { Profile, AttendanceRecord, AuditLog } from '../types';

// Default keys from user's code, or from environment variables
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || 'https://rhdoyrpfsggakwlnjnpx.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZG95cnBmc2dnYWt3bG5qbnB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTk4MzcsImV4cCI6MjA5NzUzNTgzN30.w_Re8_OLjcpTGjd1sLyD9DJZpw0zFXPIqI55JJxcp7A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('PASTE_') &&
    !SUPABASE_ANON_KEY.includes('PASTE_')
  );
};

export function usernameToEmail(role: 'siswa' | 'admin', username: string): string {
  const clean = String(username || '').trim().toLowerCase();
  return role === 'admin'
    ? `${clean}@admin.absensi.local`
    : `${clean}@siswa.absensi.local`;
}

export const SupabaseAdapter = {
  async getSession() {
    if (!isSupabaseConfigured()) return { data: { session: null }, error: null };
    try {
      return await supabase.auth.getSession();
    } catch (err) {
      console.warn('[Supabase] Gagal mengambil session:', err);
      return { data: { session: null }, error: err };
    }
  },

  async signInWithUsername(role: 'siswa' | 'admin', username: string, pass: string): Promise<Profile> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase belum terkonfigurasi.');
    }

    try {
      await supabase.auth.signOut().catch(() => {});
    } catch (e) {
      console.warn('[Supabase] signOut error:', e);
    }

    const email = usernameToEmail(role, username);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('User data is empty after authentication.');
    }

    // Retrieve corresponding profile
    const profile = await this.getProfile(data.user.id);
    if (!profile) {
      throw new Error('Profile data not found in database.');
    }

    if (profile.role !== role) {
      await supabase.auth.signOut().catch(() => {});
      throw new Error(`Akun ini terdaftar sebagai ${profile.role.toUpperCase()}, bukan ${role.toUpperCase()}`);
    }

    return profile;
  },

  async signOut() {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut().catch(() => {});
    }
  },

  async getProfile(userId: string): Promise<Profile | null> {
    if (!isSupabaseConfigured() || !userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Supabase] Gagal mengambil profil:', error);
      return null;
    }

    return {
      id: data.id,
      nis: data.nis || '',
      nama: data.nama || '',
      kelas: data.kelas || '',
      tempatPkl: data.tempat_pkl || '',
      role: data.role || 'siswa'
    };
  },

  async syncProfile(profile: Profile): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('profiles')
      .update({
        nama: profile.nama,
        kelas: profile.kelas,
        tempat_pkl: profile.tempatPkl
      })
      .eq('id', profile.id);

    if (error) {
      console.error('[Supabase] Gagal sync profile:', error);
      throw error;
    }

    return true;
  },

  async fetchRemoteRecords(): Promise<AttendanceRecord[]> {
    if (!isSupabaseConfigured()) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const userProfile = await this.getProfile(user.id);
    const isAdmin = userProfile?.role === 'admin';

    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        user_id,
        date_key,
        status,
        nis_snapshot,
        nama_snapshot,
        kelas_snapshot,
        tempat_pkl_snapshot,
        validated_at,
        validated_by,
        created_at,
        updated_at,
        siswa:profiles!attendance_records_user_id_fkey (id, nis, nama, kelas, tempat_pkl, role),
        validator:profiles!attendance_records_validated_by_fkey (id, nama, role),
        attendance_entries (
          id,
          type,
          local_time,
          client_iso_time,
          location_lat,
          location_lng,
          location_accuracy,
          location_text,
          photo_path,
          created_at
        )
      `)
      .order('date_key', { ascending: false });

    // Filter by user if not admin
    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] Gagal fetch records:', error);
      throw error;
    }

    const mapped: AttendanceRecord[] = [];

    for (const row of (data || [])) {
      const entries = Array.isArray(row.attendance_entries) ? row.attendance_entries : [];
      const siswa = (row.siswa || {}) as any;
      const validator = (row.validator || {}) as any;

      const record: AttendanceRecord = {
        id: row.id,
        user_id: row.user_id,
        dateKey: row.date_key,
        status: row.status || 'Pending',
        nis: row.nis_snapshot || siswa.nis || '',
        nama: row.nama_snapshot || siswa.nama || 'Siswa',
        kelas: row.kelas_snapshot || siswa.kelas || '',
        tempatPkl: row.tempat_pkl_snapshot || siswa.tempat_pkl || '',
        validatedAt: row.validated_at || null,
        validatedBy: row.validated_by || null,
        validatedByName: validator.nama || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        masuk: null,
        keluar: null
      };

      for (const entry of entries) {
        const type = String(entry.type || '').toLowerCase();
        const photoPath = entry.photo_path || null;
        let photoUrl = photoPath;

        // Create signed URL for private storage path
        if (photoPath && !photoPath.startsWith('data:') && !photoPath.startsWith('http')) {
          try {
            const { data: signData, error: signError } = await supabase.storage
              .from('attendance-photos')
              .createSignedUrl(photoPath, 3600); // 1 hour expiry
            if (!signError && signData) {
              photoUrl = signData.signedUrl;
            }
          } catch (err) {
            console.warn('[Supabase Storage] Gagal generate signed URL:', err);
          }
        }

        const normalized = {
          type: type as 'masuk' | 'keluar',
          time: entry.local_time || '',
          isoTime: entry.client_iso_time || null,
          location: {
            latitude: entry.location_lat ?? null,
            longitude: entry.location_lng ?? null,
            accuracy: entry.location_accuracy ?? null
          },
          locationText: entry.location_text || '',
          photo: photoUrl,
          createdAt: entry.created_at
        };

        if (type === 'keluar') {
          record.keluar = normalized;
        } else {
          record.masuk = normalized;
        }
      }

      mapped.push(record);
    }

    return mapped;
  },

  async uploadPhoto(userId: string, dateKey: string, entryType: string, photoBase64: string): Promise<string | null> {
    if (!photoBase64 || !photoBase64.startsWith('data:image/')) {
      return photoBase64;
    }

    try {
      const base64Parts = photoBase64.split(',');
      if (base64Parts.length < 2) return null;
      const base64Data = base64Parts[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      // Build private storage path
      const filePath = `${userId}/${dateKey}-${entryType}.jpg`;

      const { data, error } = await supabase.storage
        .from('attendance-photos')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[Supabase Storage] Gagal upload foto:', error);
        throw error;
      }

      return data.path;
    } catch (err) {
      console.error('[Supabase Storage] Error converting/uploading base64:', err);
      return null;
    }
  },

  async syncAttendanceRecord(record: AttendanceRecord, entryType: 'masuk' | 'keluar'): Promise<any> {
    if (!isSupabaseConfigured()) return null;

    const entry = entryType === 'keluar' ? record.keluar : record.masuk;
    if (!entry) return null;

    let photoPath = entry.photo || null;

    // Convert and upload photo if it is base64 string
    if (photoPath && photoPath.startsWith('data:image/')) {
      const uploadedPath = await this.uploadPhoto(record.user_id, record.dateKey, entryType, photoPath);
      if (uploadedPath) {
        photoPath = uploadedPath;
      }
    }

    // Use RPC function "submit_attendance_entry" as defined in database schema
    const { data, error } = await supabase.rpc('submit_attendance_entry', {
      p_type: entryType,
      p_client_iso_time: entry.isoTime || new Date().toISOString(),
      p_lat: entry.location?.latitude ?? null,
      p_lng: entry.location?.longitude ?? null,
      p_accuracy: entry.location?.accuracy ?? null,
      p_location_text: entry.locationText || null,
      p_photo_path: photoPath
    });

    if (error) {
      console.error('[Supabase] Gagal submit entry via RPC:', error);
      throw error;
    }

    return data;
  },

  async syncAdminStatus(recordId: string, status: 'Pending' | 'Valid' | 'Ditolak'): Promise<any> {
    if (!isSupabaseConfigured()) return null;

    // Use RPC function "validate_attendance" as defined in database schema
    const { data, error } = await supabase.rpc('validate_attendance', {
      p_record_id: recordId,
      p_status: status
    });

    if (error) {
      console.error('[Supabase] Gagal validate record via RPC:', error);
      throw error;
    }

    return data;
  },

  async adminUpsertStudents(students: { nis: string; nama: string; kelas: string; tempat_pkl: string }[]): Promise<any> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase.functions.invoke('admin-upsert-students', {
      body: { students }
    });

    if (error) {
      console.error('[Supabase] Gagal invoke admin-upsert-students:', error);
      throw error;
    }

    return data;
  }
};
