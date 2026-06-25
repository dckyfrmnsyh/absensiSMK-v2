import React, { useState } from 'react';
import { Shield, GraduationCap, User, Lock, ArrowRight } from 'lucide-react';
import { isSupabaseConfigured, SupabaseAdapter } from '../lib/supabase';
import { StorageService } from '../lib/db';

interface LoginProps {
  onLoginSuccess: (role: 'siswa' | 'admin', userId: string) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function Login({ onLoginSuccess, showToast }: LoginProps) {
  const [role, setRole] = useState<'siswa' | 'admin'>('siswa');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('Harap isi semua kolom login', 'warning');
      return;
    }

    setLoading(true);
    const configured = isSupabaseConfigured();

    try {
      if (configured) {
        showToast('Menghubungkan ke server...', 'info');
        const profile = await SupabaseAdapter.signInWithUsername(role, username, password);
        
        // Save session details
        localStorage.setItem('smkn1_session_user_id', profile.id);
        localStorage.setItem('smkn1_role', profile.role);
        localStorage.setItem('smkn1_session_role', profile.role);
        localStorage.setItem('smkn1_session_nis', profile.nis || '');
        StorageService.saveProfile(profile);

        showToast(`Selamat datang, ${profile.nama}!`, 'success');
        onLoginSuccess(profile.role, profile.id);
      } else {
        // Fallback Local Simulation Mode
        showToast('Menjalankan dalam Mode Simulasi Lokal', 'info');
        await new Promise((r) => setTimeout(r, 600));

        let mockUserId = 'local-user-id';
        let mockNis = '12345678';
        let mockNama = 'M. Reza Pratama';
        let mockKelas = 'XII RPL 1';
        let mockTempat = 'PT. Teknologi Karya (Tarakan)';

        if (role === 'admin') {
          mockUserId = 'local-admin-id';
          mockNis = '';
          mockNama = 'Admin Utama';
          mockKelas = '';
          mockTempat = '';
        } else {
          mockUserId = 'local-siswa-' + username;
          mockNis = username;
          mockNama = username === '12345678' ? 'M. Reza Pratama' : `Siswa ${username}`;
        }

        const profile = {
          id: mockUserId,
          nis: mockNis,
          nama: mockNama,
          kelas: mockKelas,
          tempatPkl: mockTempat,
          role: role
        };

        localStorage.setItem('smkn1_session_user_id', mockUserId);
        localStorage.setItem('smkn1_role', role);
        localStorage.setItem('smkn1_session_role', role);
        localStorage.setItem('smkn1_session_nis', mockNis);
        StorageService.saveProfile(profile);

        showToast(`Login Simulasi Berhasil sebagai ${role === 'admin' ? 'Admin' : mockNama}`, 'success');
        onLoginSuccess(role, mockUserId);
      }
    } catch (err: any) {
      console.error('[Login] Error:', err);
      showToast(err.message || 'Gagal login. Periksa username dan password Anda.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 flex flex-col justify-center relative">
      {/* Background Icon Accent */}
      <div className="absolute -right-12 -bottom-12 text-cyan-100/40 pointer-events-none select-none z-0">
        {role === 'siswa' ? (
          <GraduationCap className="w-64 h-64" />
        ) : (
          <Shield className="w-64 h-64" />
        )}
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white border border-slate-200/80 rounded-3xl flex justify-center items-center mx-auto mb-4 shadow-md p-1">
            <img 
              src="/logo.png" 
              alt="Logo SMK" 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer" 
            />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Absensi PKL</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1 animate-pulse">SMK Negeri 1 Tana Tidung</p>
        </div>

        {/* Role Tab Switcher */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl mb-6 relative z-10 border border-slate-200/50">
          <button
            type="button"
            onClick={() => setRole('siswa')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border-none cursor-pointer ${
              role === 'siswa'
                ? 'bg-white text-cyan-600 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <GraduationCap className="w-4.5 h-4.5" />
            Masuk Siswa
          </button>
          <button
            type="button"
            onClick={() => setRole('admin')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border-none cursor-pointer ${
              role === 'admin'
                ? 'bg-white text-cyan-600 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield className="w-4.5 h-4.5" />
            Masuk Admin
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              {role === 'siswa' ? 'Nomor Induk Siswa (NIS)' : 'Username Admin'}
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-slate-50/50 border border-slate-200 hover:border-slate-300 focus:border-cyan-500 focus:bg-white rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-cyan-100 outline-none transition-all duration-200"
                placeholder={role === 'siswa' ? 'Contoh: 12345678' : 'Masukkan username admin'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50/50 border border-slate-200 hover:border-slate-300 focus:border-cyan-500 focus:bg-white rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-cyan-100 outline-none transition-all duration-200"
                placeholder="Masukkan Password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl mt-6 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-cyan-600/10 flex justify-center items-center gap-2 cursor-pointer border-none"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Login
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center text-xs text-slate-600 font-semibold">
          <p className="leading-relaxed">
            {role === 'siswa'
              ? 'Siswa menggunakan NIS masing-masing sebagai username. Untuk akun demo ketik NIS 12345678.'
              : 'Admin panel digunakan untuk validasi absensi, impor data, dan rekap laporan bulanan.'}
          </p>
        </div>
      </div>
    </div>
  );
}
