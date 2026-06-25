import React, { useState, useEffect } from 'react';
import { Home, Clock, User, Shield, GraduationCap, ClipboardCheck } from 'lucide-react';
import Header from './components/Header';
import HomeTab from './components/HomeTab';
import RiwayatTab from './components/RiwayatTab';
import ProfilTab from './components/ProfilTab';
import AdminTab from './components/AdminTab';
import Login from './components/Login';
import Toast, { ToastMessage } from './components/Toast';
import { Profile, AttendanceRecord, QueueItem, LocationData, AuditLog } from './types';
import { isSupabaseConfigured, SupabaseAdapter } from './lib/supabase';
import { Queue, StorageService } from './lib/db';

export default function App() {
  // Session States
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'siswa' | 'admin' | null>(null);

  // App States
  const [profile, setProfile] = useState<Profile>(StorageService.getProfile());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'riwayat' | 'profil' | 'admin'>('home');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStats, setSyncStats] = useState({ pending: 0, total: 0, failedFinal: 0 });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Toast Helper
  // ---------------------------------------------------------------------------
  const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ---------------------------------------------------------------------------
  // Sync Engine & Hydration
  // ---------------------------------------------------------------------------
  const updateQueueStats = async () => {
    const stats = await Queue.getStats();
    setSyncStats(stats);
  };

  const mergeRecordsPreserveLocal = (
    local: AttendanceRecord[],
    remote: AttendanceRecord[]
  ): AttendanceRecord[] => {
    const mergedMap = new Map<string, AttendanceRecord>();

    // Put local records in map
    for (const item of local) {
      if (item.dateKey) {
        mergedMap.set(item.dateKey, item);
      }
    }

    // Combine with remote, keeping local camera images if remote doesn't have them yet
    for (const item of remote) {
      if (!item.dateKey) continue;

      const localItem = mergedMap.get(item.dateKey);
      if (!localItem) {
        mergedMap.set(item.dateKey, item);
        continue;
      }

      mergedMap.set(item.dateKey, {
        ...localItem,
        ...item,
        // Keep local images if remote is empty
        masuk: item.masuk || localItem.masuk ? {
          ...(localItem.masuk || {}),
          ...(item.masuk || {}),
          photo: item.masuk?.photo || localItem.masuk?.photo || null
        } as any : null,
        keluar: item.keluar || localItem.keluar ? {
          ...(localItem.keluar || {}),
          ...(item.keluar || {}),
          photo: item.keluar?.photo || localItem.keluar?.photo || null
        } as any : null,
        status: item.status || localItem.status || 'Pending',
        updatedAt: item.updatedAt || localItem.updatedAt
      });
    }

    return Array.from(mergedMap.values());
  };

  const hydrateFromSupabase = async () => {
    if (!navigator.onLine || !isSupabaseConfigured()) return;

    try {
      const activeUser = await SupabaseAdapter.getProfile(
        localStorage.getItem('smkn1_session_user_id') || ''
      );

      if (activeUser) {
        setProfile(activeUser);
        StorageService.saveProfile(activeUser);
      }

      const remoteRecords = await SupabaseAdapter.fetchRemoteRecords();
      if (Array.isArray(remoteRecords)) {
        const localRecords = StorageService.getRecords();
        const merged = mergeRecordsPreserveLocal(localRecords, remoteRecords);
        StorageService.saveRecords(merged);
        setRecords(merged);
      }
    } catch (err) {
      console.warn('[Sync] Hydration error, fallback used:', err);
    }
  };

  const runSync = async () => {
    if (!navigator.onLine) {
      await updateQueueStats();
      return;
    }

    try {
      const queue = await Queue.getAll();
      if (queue.length === 0) {
        await hydrateFromSupabase();
        await updateQueueStats();
        return;
      }

      showToast('Mensinkronkan antrean data offline...', 'info');

      for (const item of queue) {
        if (!navigator.onLine) break;

        try {
          if (item.payload.type === 'ABSEN' && item.payload.record) {
            const record = item.payload.record as AttendanceRecord;
            const actionType = item.payload.entryType || (item.payload.record.keluar ? 'keluar' : 'masuk');
            await SupabaseAdapter.syncAttendanceRecord(record, actionType);
          } else if (item.payload.type === 'PROFILE_UPDATE' && item.payload.profile) {
            await SupabaseAdapter.syncProfile(item.payload.profile);
          } else if (item.payload.type === 'ADMIN_STATUS_UPDATE' && item.payload.recordId && item.payload.status) {
            await SupabaseAdapter.syncAdminStatus(item.payload.recordId, item.payload.status as any);
          }

          // Delete from queue on success
          await Queue.remove(item.id);
        } catch (err: any) {
          console.warn('[Sync] Queue item failed, will retry:', item.id, err);
          const currentAttempts = item.attempts + 1;
          
          if (currentAttempts >= 5) {
            await Queue.markFinalFailed(item.id, err.message || 'Retry limits reached', currentAttempts);
          } else {
            await Queue.markFailed(item.id, err.message || 'Sync failed');
          }
        }
      }

      await hydrateFromSupabase();
      await updateQueueStats();
      showToast('Sinkronisasi data berhasil diselesaikan', 'success');
    } catch (err) {
      console.warn('[Sync] Error running queue sync:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Check auth and initial cache load
  // ---------------------------------------------------------------------------
  const checkAuth = async () => {
    try {
      const configured = isSupabaseConfigured();
      if (configured) {
        const { data: { session } } = await SupabaseAdapter.getSession();
        if (session && session.user) {
          const fetchedProfile = await SupabaseAdapter.getProfile(session.user.id);
          if (fetchedProfile) {
            const role = fetchedProfile.role;
            setUserId(session.user.id);
            setUserRole(role);
            setProfile(fetchedProfile);
            StorageService.saveProfile(fetchedProfile);
            
            // Set session storage details
            localStorage.setItem('smkn1_session_user_id', session.user.id);
            localStorage.setItem('smkn1_role', role);
            localStorage.setItem('smkn1_session_role', role);
            localStorage.setItem('smkn1_session_nis', fetchedProfile.nis || '');
            
            // Hydrate and redirect to active screens
            const cachedRecords = StorageService.getRecords();
            setRecords(cachedRecords);
            setActiveTab(role === 'admin' ? 'admin' : 'home');
            setAuthChecked(true);

            // Background sync
            setTimeout(() => runSync(), 100);
            return;
          }
        }
      }

      // Local Cache Fallback
      const cachedUserId = localStorage.getItem('smkn1_session_user_id');
      const cachedRole = localStorage.getItem('smkn1_role') as Profile['role'];

      if (cachedUserId && cachedRole) {
        setUserId(cachedUserId);
        setUserRole(cachedRole);
        setProfile(StorageService.getProfile());
        setRecords(StorageService.getRecords());
        setActiveTab(cachedRole === 'admin' ? 'admin' : 'home');
      }
    } catch (e) {
      console.warn('[Auth] Error checking session:', e);
    } finally {
      setAuthChecked(true);
      await updateQueueStats();
    }
  };

  useEffect(() => {
    checkAuth();

    // Event listener connection monitoring
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Koneksi internet terdeteksi. Memulai sinkronisasi data.', 'success');
      runSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Koneksi internet terputus. Mode offline aktif.', 'warning');
      updateQueueStats();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Focus triggers auto sync
    const handleFocus = () => runSync();
    window.addEventListener('focus', handleFocus);

    // Ask for Notification permission on startup/login
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        Notification.requestPermission().then((permission) => {
          console.log('[Notification] Status izin:', permission);
        });
      }, 3000); // Friendly delay
    }

    // Backup client-side check for 07:00 and 16:00 daily reminder
    let lastClientReminderMasuk = '';
    let lastClientReminderKeluar = '';
    
    const clientCheckInterval = setInterval(() => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const dateStr = now.toDateString();

      // 07:00 (Absen Masuk)
      if (hours === 7 && minutes === 0 && lastClientReminderMasuk !== dateStr) {
        lastClientReminderMasuk = dateStr;
        new Notification('Waktunya Absen Masuk!', {
          body: 'Selamat pagi! Jangan lupa melakukan absen masuk magang hari ini.',
          icon: 'https://rhdoyrpfsggakwlnjnpx.supabase.co/storage/v1/object/public/attendance-photos/icon-192.png'
        });
      }

      // 16:00 (Absen Keluar)
      if (hours === 16 && minutes === 0 && lastClientReminderKeluar !== dateStr) {
        lastClientReminderKeluar = dateStr;
        new Notification('Waktunya Absen Keluar!', {
          body: 'Selamat sore! Jangan lupa melakukan absen keluar magang sebelum pulang.',
          icon: 'https://rhdoyrpfsggakwlnjnpx.supabase.co/storage/v1/object/public/attendance-photos/icon-192.png'
        });
      }
    }, 30000); // Check every 30 seconds

    // Service Worker Registration and Sync Message Listening
    let handleSwMessage: any = null;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((reg) => {
          console.log('[ServiceWorker] Berhasil didaftarkan:', reg.scope);
        })
        .catch((err) => {
          console.warn('[ServiceWorker] Gagal registrasi:', err);
        });

      handleSwMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'ABSENSI_SYNC_REQUEST') {
          console.log('[ServiceWorker] Menerima ABSENSI_SYNC_REQUEST, sinkronisasi...');
          runSync();
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      clearInterval(clientCheckInterval);
      if (handleSwMessage && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Siswa Attendance Actions
  // ---------------------------------------------------------------------------
  const handleAbsenSubmit = async (
    type: 'masuk' | 'keluar',
    photoBase64: string,
    location: LocationData | null,
    locationText: string
  ) => {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    
    // Retrieve current logs
    const cachedRecords = StorageService.getRecords();
    let record = cachedRecords.find((r) => r.dateKey === dateKey && r.user_id === userId);

    const entryDetail = {
      type,
      time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      isoTime: now.toISOString(),
      location,
      locationText,
      photo: photoBase64,
      createdAt: now.toISOString()
    };

    if (!record) {
      // Create new record if check-in for the day
      record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        user_id: userId || 'local-user',
        dateKey,
        status: 'Pending',
        nis: profile.nis,
        nama: profile.nama,
        kelas: profile.kelas,
        tempatPkl: profile.tempatPkl,
        validatedAt: null,
        validatedBy: null,
        masuk: null,
        keluar: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      cachedRecords.push(record);
    }

    if (type === 'masuk') {
      record.masuk = entryDetail;
    } else {
      record.keluar = entryDetail;
    }

    record.updatedAt = now.toISOString();

    // Cache updated logs
    const updatedRecords = [...cachedRecords];
    StorageService.saveRecords(updatedRecords);
    setRecords(updatedRecords);

    // Add task payload in IndexedDB sync queue
    try {
      await Queue.add({
        type: 'ABSEN',
        record,
        entryType: type,
        action: 'UPSERT'
      });
      await updateQueueStats();

      showToast(`Absen ${type === 'masuk' ? 'masuk' : 'keluar'} berhasil disimpan ke penyimpanan lokal.`, 'success');
      
      // Trigger sync
      setTimeout(() => runSync(), 100);
    } catch (e) {
      console.error('[DB] Queue error:', e);
      showToast('Gagal memproses antrean sinkronisasi offline.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Profile Editor Action
  // ---------------------------------------------------------------------------
  const handleSaveProfile = async (updated: Partial<Profile>) => {
    const current = StorageService.getProfile();
    const fullUpdatedProfile: Profile = {
      ...current,
      ...updated,
      id: userId || current.id
    };

    // Save changes locally
    StorageService.saveProfile(fullUpdatedProfile);
    setProfile(fullUpdatedProfile);

    // Add profile payload to sync queue
    try {
      await Queue.add({
        type: 'PROFILE_UPDATE',
        profile: fullUpdatedProfile
      });
      await updateQueueStats();

      // Trigger sync
      setTimeout(() => runSync(), 100);
    } catch (e) {
      console.error(e);
      showToast('Gagal memasukkan pembaruan profil ke antrean.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Admin Action Validation
  // ---------------------------------------------------------------------------
  const handleValidateRecord = async (recordId: string, status: 'Valid' | 'Ditolak') => {
    const cachedRecords = StorageService.getRecords();
    const record = cachedRecords.find((r) => r.id === recordId);
    if (!record) return;

    const oldStatus = record.status;
    const nowIso = new Date().toISOString();

    const audit: AuditLog = {
      id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'ADMIN_VALIDATION_AUDIT',
      recordId: record.id,
      targetNis: record.nis,
      targetNama: record.nama,
      targetKelas: record.kelas,
      targetDateKey: record.dateKey,
      oldStatus,
      newStatus: status,
      adminId: userId || 'local-admin',
      adminName: profile.nama || 'Admin',
      adminRole: 'admin',
      source: navigator.onLine ? 'online' : 'offline',
      synced: navigator.onLine,
      validatedAt: nowIso,
      serverValidatedAt: null,
      createdAt: nowIso,
      userAgent: navigator.userAgent
    };

    // Apply updates locally
    record.status = status;
    record.validatedAt = nowIso;
    record.validatedBy = userId;
    record.validatedByName = profile.nama;
    record.updatedAt = nowIso;
    
    if (!record.auditLog) record.auditLog = [];
    record.auditLog = [audit, ...record.auditLog];

    StorageService.saveRecords(cachedRecords);
    setRecords([...cachedRecords]);

    // Save audit log globally in storage
    const audits = StorageService.getAdminAuditLogs();
    StorageService.saveAdminAuditLogs([audit, ...audits]);

    // Add to queue
    try {
      await Queue.add({
        type: 'ADMIN_STATUS_UPDATE',
        recordId,
        status,
        validatedAt: nowIso,
        audit
      });
      await updateQueueStats();

      showToast(`Absensi ${record.nama} disahkan sebagai ${status.toUpperCase()} locally.`, 'success');

      // Trigger sync
      setTimeout(() => runSync(), 100);
    } catch (e) {
      console.error(e);
      showToast('Gagal memproses validasi ke antrean offline.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Excel Backup Backup Downloader
  // ---------------------------------------------------------------------------
  const handleExportBackup = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        profile,
        records,
        adminAuditLogs: userRole === 'admin' ? StorageService.getAdminAuditLogs() : []
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-absensi-pkl-${profile.nis || 'siswa'}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data berhasil diekspor sebagai JSON backup', 'success');
    } catch (e) {
      showToast('Gagal mengekspor data backup', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Reset Data Handler
  // ---------------------------------------------------------------------------
  const handleResetData = () => {
    setConfirmModal({
      title: 'Reset Data Absensi',
      message: 'Apakah Anda yakin ingin menghapus seluruh riwayat absensi lokal pada perangkat ini? Profil data Anda tidak akan dihapus.',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      onConfirm: () => {
        StorageService.clearRecords();
        setRecords([]);
        showToast('Seluruh riwayat absensi lokal berhasil dihapus.', 'success');
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Monthly PDF Official Report Generator (A4 printable popup layout)
  // ---------------------------------------------------------------------------
  const handleGeneratePdf = (monthKey: string) => {
    const formatDateLabel = (dateKey: string) => {
      const d = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return dateKey;
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };

    // Filter records for selected month
    const monthlyRecords = records
      .filter((r) => r.dateKey.startsWith(monthKey))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    const totalDays = monthlyRecords.length;
    const validDays = monthlyRecords.filter((r) => r.status === 'Valid').length;
    const rejectedDays = monthlyRecords.filter((r) => r.status === 'Ditolak').length;
    const pendingDays = monthlyRecords.filter((r) => r.status === 'Pending').length;

    // Build Rows HTML safely
    const rowsHtml = monthlyRecords.length === 0
      ? `<tr><td colspan="7" style="text-align:center; padding:15px; font-weight: bold; color: #555;">Tidak ada data absensi untuk bulan pilihan ini.</td></tr>`
      : monthlyRecords.map((r, idx) => {
          const checkin = r.masuk?.time || '--:--';
          const checkout = r.keluar?.time || '--:--';
          const coordinates = r.masuk?.locationText || '-';
          
          let note = 'Hadir';
          if (r.status === 'Ditolak') note = 'Perlu Perbaikan';
          else if (r.status === 'Pending') note = 'Menunggu Validasi';
          else if (!r.masuk) note = 'Tanpa Keterangan';
          else if (r.masuk && !r.keluar) note = 'Belum Absen Keluar';

          return `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td>${formatDateLabel(r.dateKey)}</td>
              <td style="text-align: center; font-weight: bold;">${checkin}</td>
              <td style="text-align: center; font-weight: bold;">${checkout}</td>
              <td>${coordinates}</td>
              <td style="text-align: center; font-weight: bold;">${r.status}</td>
              <td>${note}</td>
            </tr>
          `;
        }).join('');

    const formattedMonthName = new Date(
      Number(monthKey.split('-')[0]),
      Number(monthKey.split('-')[1]) - 1,
      1
    ).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const htmlReport = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Laporan Absensi PKL - ${profile.nama}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Times New Roman', Times, serif; color: #000; margin: 0; padding: 20px; background-color: #f1f5f9; display: flex; justify-content: center; }
          .document { background-color: #fff; width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; }
          .header-title { text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-table { width: 100%; border: none; font-size: 11pt; border-collapse: collapse; margin-bottom: 25px; }
          .info-table td { padding: 5px 0; vertical-align: top; }
          .info-table td:first-child { width: 150px; font-weight: bold; }
          .info-table td:nth-child(2) { width: 15px; text-align: center; }
          
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 10pt; }
          .data-table th, .data-table td { border: 1px solid #000; padding: 8px 10px; text-align: left; vertical-align: middle; }
          .data-table th { background-color: #f8fafc; font-weight: bold; text-align: center; text-transform: uppercase; font-size: 9pt; }
          
          .summary-title { font-weight: bold; font-size: 11pt; margin-bottom: 8px; text-transform: uppercase; }
          .summary-list { padding-left: 20px; margin: 0 0 35px 0; font-size: 11pt; list-style-type: square; }
          .summary-list li { margin-bottom: 5px; }

          .signatures-table { width: 100%; border: none; border-collapse: collapse; margin-top: 50px; font-size: 11pt; }
          .signatures-table td { width: 33.33%; border: none; text-align: center; vertical-align: top; padding: 0; }
          .signature-space { height: 75px; }

          .print-footer { font-size: 9pt; font-style: italic; color: #64748b; margin-top: 60px; border-top: 1px solid #e2e8f0; pt-3; }
          .btn-container { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 100; }
          .btn-action { background-color: #1e3a8a; color: #fff; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
          .btn-action.secondary { background-color: #64748b; }

          @media print {
            body { background-color: transparent; padding: 0; }
            .document { box-shadow: none; padding: 0; width: 100%; min-height: auto; }
            .btn-container { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="btn-container">
          <button class="btn-action" onclick="window.print()">Cetak / Simpan PDF</button>
          <button class="btn-action secondary" onclick="window.close()">Tutup</button>
        </div>

        <div class="document">
          <div class="header-title">LAPORAN REKAPITULASI ABSENSI PKL SISWA</div>

          <table class="info-table">
            <tr><td>Nama Lengkap</td><td>:</td><td>${profile.nama}</td></tr>
            <tr><td>NIS / NISN</td><td>:</td><td>${profile.nis}</td></tr>
            <tr><td>Kelas / Rombel</td><td>:</td><td>${profile.kelas}</td></tr>
            <tr><td>Tempat PKL</td><td>:</td><td>${profile.tempatPkl}</td></tr>
            <tr><td>Bulan / Periode</td><td>:</td><td>${formattedMonthName}</td></tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 5%">No</th>
                <th style="width: 25%">Hari, Tanggal</th>
                <th style="width: 12%">Jam Masuk</th>
                <th style="width: 12%">Jam Keluar</th>
                <th style="width: 25%">Koordinat GPS</th>
                <th style="width: 10%">Status</th>
                <th style="width: 11%">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary-title">Rekapitulasi Absensi:</div>
          <ul class="summary-list">
            <li>Total Hari PKL Aktif : <b>${totalDays} Hari</b></li>
            <li>Kehadiran Disahkan (Valid) : <b style="color: green;">${validDays} Hari</b></li>
            <li>Absensi Ditolak (Perlu Revisi) : <b style="color: red;">${rejectedDays} Hari</b></li>
            <li>Menunggu Persetujuan (Pending) : <b style="color: orange;">${pendingDays} Hari</b></li>
          </ul>

          <table class="signatures-table">
            <tr>
              <td>
                Mengetahui,<br>
                Pembimbing Industri / Instansi
                <div class="signature-space"></div>
                (....................................................)
              </td>
              <td>
                <br>
                Siswa Praktikan
                <div class="signature-space"></div>
                <u><b>${profile.nama}</b></u><br>
                NIS. ${profile.nis}
              </td>
              <td>
                Menyetujui,<br>
                Guru Pembimbing Sekolah
                <div class="signature-space"></div>
                (....................................................)
              </td>
            </tr>
          </table>

          <div class="print-footer">
            * Laporan diunduh dan dicetak melalui Sistem Informasi Absensi PKL SMKN 1 Tana Tidung.<br>
            * Waktu cetak dokumen: ${new Date().toLocaleString('id-ID')} WITA.
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Popup diblokir oleh browser. Harap izinkan popup untuk menampilkan dokumen laporan.', 'error');
      return;
    }

    printWindow.document.write(htmlReport);
    printWindow.document.close();
  };

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  const handleLogout = () => {
    setConfirmModal({
      title: 'Keluar Aplikasi',
      message: 'Apakah Anda yakin ingin logout dari aplikasi? Seluruh data antrean yang belum disinkronkan akan dihapus dari perangkat ini.',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
      onConfirm: async () => {
        try {
          if (isSupabaseConfigured()) {
            await SupabaseAdapter.signOut();
          }
        } catch (_) {}

        // Complete local cleanup
        localStorage.removeItem('smkn1_session_user_id');
        localStorage.removeItem('smkn1_role');
        localStorage.removeItem('smkn1_session_role');
        localStorage.removeItem('smkn1_session_nis');
        localStorage.removeItem('smkn1_profile_v1');
        localStorage.removeItem('smkn1_active_records_key_v2');
        localStorage.removeItem('smkn1_records_v1_admin_all');
        sessionStorage.clear();

        // Clear and delete IndexedDB
        try {
          const deleteRequest = indexedDB.deleteDatabase('absensi_sync_db');
          deleteRequest.onsuccess = () => {
            console.log('[IndexedDB] Database absensi_sync_db berhasil dihapus saat logout.');
          };
          deleteRequest.onerror = () => {
            console.warn('[IndexedDB] Gagal menghapus database absensi_sync_db:', deleteRequest.error);
          };
        } catch (e) {
          console.warn('[IndexedDB] Error menghapus database:', e);
        }

        setUserId(null);
        setUserRole(null);
        setRecords([]);
        setProfile({
          id: '',
          nis: '12345678',
          nama: 'M. Reza Pratama',
          kelas: 'XII RPL 1',
          tempatPkl: 'PT. Teknologi Karya (Tarakan)',
          role: 'siswa'
        });
        setSyncStats({ pending: 0, total: 0, failedFinal: 0 });

        showToast('Anda berhasil keluar dari sesi aplikasi.', 'success');
      }
    });
  };

  // Login handler
  const handleLoginSuccess = (role: 'siswa' | 'admin', loggedUserId: string) => {
    setUserId(loggedUserId);
    setUserRole(role);
    setProfile(StorageService.getProfile());
    setRecords(StorageService.getRecords());
    setActiveTab(role === 'admin' ? 'admin' : 'home');
    runSync();
  };

  // Loading screen before auth checked
  if (!authChecked) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100 text-slate-800">
        <div className="text-center flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-gray-500">Memverifikasi sesi absensi...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login Component
  if (!userId) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100 p-4">
        <Login onLoginSuccess={handleLoginSuccess} showToast={showToast} />
        <Toast toasts={toasts} removeToast={removeToast} />
      </div>
    );
  }

  // Find today's record for active home state
  const todayKey = new Date().toISOString().split('T')[0];
  const todayRecord = records.find((r) => r.dateKey === todayKey && r.user_id === userId) || null;

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-100 font-sans">
      <div className="w-full max-w-md h-[100dvh] bg-gray-50 relative shadow-2xl flex flex-col overflow-hidden sm:rounded-3xl sm:h-[90vh] sm:border border-gray-250">
        
        {/* Header */}
        <Header onLogout={handleLogout} />

        {/* Tabs Panels Display Wrapper */}
        <main className="flex-1 overflow-y-auto pb-24 relative bg-gray-50 p-4">
          {activeTab === 'home' && (
            <HomeTab
              profile={profile}
              todayRecord={todayRecord}
              records={records}
              onAbsenSubmit={handleAbsenSubmit}
              syncStats={syncStats}
              isOnline={isOnline}
              onTriggerSync={runSync}
              showToast={showToast}
            />
          )}

          {activeTab === 'riwayat' && (
            <RiwayatTab
              records={records}
              onExportBackup={handleExportBackup}
              onResetData={handleResetData}
              onGeneratePdf={handleGeneratePdf}
            />
          )}

          {activeTab === 'profil' && (
            <ProfilTab
              profile={profile}
              onSaveProfile={handleSaveProfile}
              showToast={showToast}
            />
          )}

          {activeTab === 'admin' && userRole === 'admin' && (
            <AdminTab
              records={records}
              onValidateRecord={handleValidateRecord}
              isOnline={isOnline}
              showToast={showToast}
            />
          )}
        </main>

        {/* Footer Navigation Bar */}
        <nav className="absolute bottom-0 w-full bg-white border-t border-gray-150 flex justify-around items-center pb-safe pt-2.5 pb-2.5 z-20 shadow-lg">
          {userRole !== 'admin' ? (
            <>
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center w-16 bg-transparent border-none cursor-pointer transition-colors ${
                  activeTab === 'home' ? 'text-blue-900 font-bold' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Home className="w-5.5 h-5.5 mb-1" />
                <span className="text-[10px]">Home</span>
              </button>
              <button
                onClick={() => setActiveTab('riwayat')}
                className={`flex flex-col items-center w-16 bg-transparent border-none cursor-pointer transition-colors ${
                  activeTab === 'riwayat' ? 'text-blue-900 font-bold' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Clock className="w-5.5 h-5.5 mb-1" />
                <span className="text-[10px]">Riwayat</span>
              </button>
              <button
                onClick={() => setActiveTab('profil')}
                className={`flex flex-col items-center w-16 bg-transparent border-none cursor-pointer transition-colors ${
                  activeTab === 'profil' ? 'text-blue-900 font-bold' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <User className="w-5.5 h-5.5 mb-1" />
                <span className="text-[10px]">Profil</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex flex-col items-center w-24 bg-transparent border-none cursor-pointer transition-colors ${
                  activeTab === 'admin' ? 'text-blue-900 font-bold' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Shield className="w-5.5 h-5.5 mb-1" />
                <span className="text-[10px]">Admin Panel</span>
              </button>
              <button
                onClick={() => setActiveTab('profil')}
                className={`flex flex-col items-center w-24 bg-transparent border-none cursor-pointer transition-colors ${
                  activeTab === 'profil' ? 'text-blue-900 font-bold' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <User className="w-5.5 h-5.5 mb-1" />
                <span className="text-[10px]">Profil</span>
              </button>
            </>
          )}
        </nav>

        {/* Global Toast Overlay Container */}
        <Toast toasts={toasts} removeToast={removeToast} />

        {/* Custom Confirmation Dialog Modal */}
        {confirmModal && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white border border-slate-200/80 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
              <h3 className="font-extrabold text-slate-800 text-base mb-2">{confirmModal.title}</h3>
              <p className="text-xs text-slate-500 font-bold mb-6 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-755 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer transition-colors"
                >
                  {confirmModal.cancelText || 'Batal'}
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 cursor-pointer transition-colors"
                >
                  {confirmModal.confirmText || 'Konfirmasi'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
