import React, { useState } from 'react';
import { User, Clipboard, GraduationCap, MapPin, Bell, Download, Smartphone } from 'lucide-react';
import { Profile } from '../types';

interface ProfilTabProps {
  profile: Profile;
  onSaveProfile: (updated: Partial<Profile>) => Promise<void>;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onTriggerInstall: () => void;
}

export default function ProfilTab({
  profile,
  onSaveProfile,
  showToast,
  onTriggerInstall
}: ProfilTabProps) {
  const [nama, setNama] = useState(profile.nama);
  const [kelas, setKelas] = useState(profile.kelas);
  const [tempatPkl, setTempatPkl] = useState(profile.tempatPkl);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      showToast('Nama lengkap tidak boleh kosong', 'warning');
      return;
    }

    setSaving(true);
    try {
      await onSaveProfile({ nama, kelas, tempatPkl });
      showToast('Perubahan profil berhasil disimpan', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Gagal memperbarui profil: ' + (err.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nama || 'User')}&background=ecfeff&color=0891b2`;

  return (
    <div className="space-y-4">
      {/* Profile Pic Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 text-center shadow-sm">
        <div className="w-20 h-20 bg-slate-50 rounded-full mx-auto mb-3 overflow-hidden border-2 border-cyan-500 p-0.5 shadow-md">
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-full h-full rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="text-lg font-black text-slate-800">{nama || 'Nama Pengguna'}</h2>
        <p className="text-xs font-bold text-slate-400">Siswa Aktif • SMKN 1 Tana Tidung</p>
      </div>

      {/* Profile Form Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-850 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-600" />
          Data Diri Siswa
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Nomor Induk Siswa (NIS)
            </label>
            <div className="relative">
              <Clipboard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={profile.nis}
                readOnly
                className="w-full bg-slate-100 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm text-slate-400 cursor-not-allowed outline-none font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Nama Lengkap
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-cyan-500 rounded-2xl pl-12 pr-4 py-3 text-sm font-semibold text-slate-800 focus:ring-4 focus:ring-cyan-50 outline-none transition-all duration-250"
                placeholder="Masukkan nama lengkap"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Kelas / Rombel
            </label>
            <div className="relative">
              <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-cyan-500 rounded-2xl pl-12 pr-4 py-3 text-sm font-semibold text-slate-800 focus:ring-4 focus:ring-cyan-50 outline-none transition-all duration-250"
                placeholder="Contoh: XII RPL 1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Tempat PKL (Instansi/Industri)
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={tempatPkl}
                onChange={(e) => setTempatPkl(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-cyan-500 rounded-2xl pl-12 pr-4 py-3 text-sm font-semibold text-slate-800 focus:ring-4 focus:ring-cyan-50 outline-none transition-all duration-250"
                placeholder="Contoh: PT. Teknologi Karya"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl mt-4 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-cyan-600/15 flex justify-center items-center gap-2 cursor-pointer border-none"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Simpan Perubahan'
            )}
          </button>
        </form>
      </div>

      {/* Notifications Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-850 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
          <Bell className="w-4 h-4 text-cyan-600" />
          Pengingat Harian (PWA)
        </h3>

        <div className="space-y-4 text-xs">
          <p className="text-slate-500 leading-relaxed font-bold">
            Izin notifikasi diperlukan agar sistem dapat mengirimkan pengingat otomatis harian secara offline pada pukul <span className="text-cyan-600 font-extrabold">07:00</span> (Absen Masuk) dan <span className="text-cyan-600 font-extrabold">16:00</span> (Absen Keluar).
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={async () => {
                if (!('Notification' in window)) {
                  showToast('Perangkat atau browser Anda tidak mendukung notifikasi.', 'error');
                  return;
                }
                const res = await Notification.requestPermission();
                if (res === 'granted') {
                  showToast('Izin notifikasi berhasil diberikan!', 'success');
                } else {
                  showToast('Izin notifikasi ditolak/diblokir.', 'warning');
                }
              }}
              className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 px-4 rounded-2xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' ? 'Izin Aktif' : 'Aktifkan Izin'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!('Notification' in window)) {
                  showToast('Perangkat tidak mendukung notifikasi.', 'error');
                  return;
                }
                if (Notification.permission !== 'granted') {
                  showToast('Berikan izin notifikasi terlebih dahulu.', 'warning');
                  return;
                }

                // Try sending message to Service Worker for immediate display
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: 'TEST_NOTIFICATION',
                    title: 'Uji Coba Pengingat Absensi 🔔',
                    body: 'Halo! Pengingat harian sistem absensi PKL berhasil dikonfigurasi.'
                  });
                  showToast('Notifikasi uji coba dikirim melalui Service Worker!', 'success');
                } else {
                  // Fallback direct notification
                  new Notification('Uji Coba Pengingat Absensi 🔔', {
                    body: 'Halo! Pengingat harian sistem absensi PKL berhasil dikonfigurasi.',
                    icon: '/logo.png'
                  });
                  showToast('Notifikasi uji coba dikirim langsung dari browser!', 'success');
                }
              }}
              className="flex-1 bg-cyan-50 text-cyan-600 hover:bg-cyan-100/80 border border-cyan-200 font-bold py-3 px-4 rounded-2xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              Uji Coba Notifikasi
            </button>
          </div>
        </div>
      </div>

      {/* PWA Install Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-850 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
          <Download className="w-4 h-4 text-cyan-600" />
          Pasang Aplikasi Absensi (PWA)
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed font-bold mb-4">
          Unduh dan pasang aplikasi ini langsung di layar utama handphone atau komputer Anda untuk akses lebih cepat, stabil, hemat kuota, dan mendukung penuh penggunaan secara offline.
        </p>
        <button
          type="button"
          onClick={onTriggerInstall}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-cyan-600/15 flex justify-center items-center gap-2 cursor-pointer border-none"
        >
          <Smartphone className="w-4 h-4" />
          Pasang Aplikasi Sekarang
        </button>
      </div>
    </div>
  );
}
