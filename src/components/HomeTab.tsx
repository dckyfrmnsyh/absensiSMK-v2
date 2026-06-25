import React, { useState, useRef, useEffect } from 'react';
import { MapPin, User, LogIn, LogOut, CheckCircle, Clock, CloudUpload, RefreshCw, Camera, X } from 'lucide-react';
import { Profile, AttendanceRecord, LocationData } from '../types';

interface HomeTabProps {
  profile: Profile;
  todayRecord: AttendanceRecord | null;
  records: AttendanceRecord[];
  onAbsenSubmit: (type: 'masuk' | 'keluar', photoBase64: string, location: LocationData | null, locationText: string) => Promise<void>;
  syncStats: { pending: number; total: number; failedFinal: number };
  isOnline: boolean;
  onTriggerSync: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function HomeTab({
  profile,
  todayRecord,
  records,
  onAbsenSubmit,
  syncStats,
  isOnline,
  onTriggerSync,
  showToast
}: HomeTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [absenType, setAbsenType] = useState<'masuk' | 'keluar'>('masuk');
  
  // Camera & Location state
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationText, setLocationText] = useState('Mencari lokasi...');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stats calculation
  const totalHadir = records.filter(r => r.masuk).length;
  const totalPending = records.filter(r => r.status === 'Pending').length;

  const currentDayText = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const sudahMasuk = todayRecord && todayRecord.masuk;
  const sudahKeluar = todayRecord && todayRecord.keluar;

  let currentStatus = 'Belum Absen';
  let statusColor = 'bg-emerald-500';
  let timeInfoText = 'Belum ada catatan waktu.';

  if (sudahMasuk && !sudahKeluar) {
    currentStatus = 'Sedang PKL';
    statusColor = 'bg-blue-500';
    timeInfoText = `Masuk: ${todayRecord?.masuk?.time} • Status: ${todayRecord?.status}`;
  } else if (sudahMasuk && sudahKeluar) {
    currentStatus = 'Selesai PKL';
    statusColor = 'bg-gray-400';
    timeInfoText = `Masuk: ${todayRecord?.masuk?.time} • Keluar: ${todayRecord?.keluar?.time} • Status: ${todayRecord?.status}`;
  }

  // Camera handling
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    setPhotoData(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser Anda tidak mendukung akses kamera.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });

      setVideoStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('[Camera] Access error:', err);
      setCameraError('Gagal mengakses kamera. Harap izinkan akses kamera Anda.');
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
  };

  // Location handling
  const getGpsLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    setLocation(null);
    setLocationText('Mencari lokasi GPS...');

    if (!navigator.geolocation) {
      setGpsError('Geolocation tidak didukung oleh browser ini.');
      setLocationText('GPS tidak didukung');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lng = Number(pos.coords.longitude.toFixed(7));
        const acc = Math.round(pos.coords.accuracy);

        setLocation({ latitude: lat, longitude: lng, accuracy: acc });
        setLocationText(`${lat}, ${lng} (Akurasi: ±${acc}m)`);
        setGpsLoading(false);
      },
      (err) => {
        console.warn('[GPS] Gagal mengambil lokasi:', err);
        // Fallback simulated location for PC/Offline testing
        const simulatedLat = -3.312345;
        const simulatedLng = 117.594321;
        const simulatedAcc = 15;
        
        setLocation({ latitude: simulatedLat, longitude: simulatedLng, accuracy: simulatedAcc });
        setLocationText(`${simulatedLat}, ${simulatedLng} (Lokasi Simulasi)`);
        setGpsLoading(false);
        showToast('Gagal memuat GPS. Menggunakan koordinat simulasi untuk absensi.', 'info');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Capture Photo
  const capturePhoto = () => {
    if (!videoStream || !videoRef.current || !canvasRef.current) {
      showToast('Kamera belum siap', 'warning');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const width = 640;
      const ratio = video.videoHeight / video.videoWidth;
      const height = Math.round(width * ratio);

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      setPhotoData(dataUrl);
      stopCamera();
    }
  };

  const handleOpenAbsenModal = (type: 'masuk' | 'keluar') => {
    if (type === 'masuk' && sudahMasuk) {
      showToast('Anda sudah absen masuk hari ini', 'warning');
      return;
    }
    if (type === 'keluar' && !sudahMasuk) {
      showToast('Absen masuk harus dilakukan terlebih dahulu', 'warning');
      return;
    }
    if (type === 'keluar' && sudahKeluar) {
      showToast('Anda sudah absen keluar hari ini', 'warning');
      return;
    }

    setAbsenType(type);
    setModalOpen(true);
  };

  // Trigger camera and GPS on modal open
  useEffect(() => {
    if (modalOpen) {
      startCamera();
      getGpsLocation();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [modalOpen]);

  // Submit absensi
  const handleAbsenSubmit = async () => {
    if (!photoData) {
      showToast('Silakan ambil foto terlebih dahulu', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await onAbsenSubmit(absenType, photoData, location, locationText);
      setModalOpen(false);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Gagal menyimpan absensi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 flex justify-between items-center relative overflow-hidden shadow-sm">
        <div className="absolute -right-6 -top-6 text-cyan-100/40 pointer-events-none select-none z-0">
          <User className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <h2 className="text-lg font-extrabold text-slate-800 leading-tight">Halo, {profile.nama} 👋</h2>
          <p className="text-xs text-slate-500 mt-1.5 font-bold tracking-wide">
            NIS: {profile.nis} • {profile.kelas}
          </p>
          <p className="text-xs font-bold text-cyan-600 mt-1.5 flex items-center gap-1 bg-cyan-50 border border-cyan-100/80 px-2.5 py-1 rounded-lg w-fit">
            <MapPin className="w-3.5 h-3.5" />
            {profile.tempatPkl}
          </p>
        </div>
      </div>

      {/* Main Absensi Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 text-center relative overflow-hidden shadow-sm">
        <div className={`absolute top-0 left-0 w-full h-1.5 ${statusColor}`} />
        
        <div className="mb-6">
          <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Status Hari Ini</p>
          <h3 className="text-2xl font-black text-slate-800">{currentStatus}</h3>
          <p className="text-xs text-slate-500 font-bold mt-1.5">{currentDayText}</p>
          <p className="text-[11px] font-bold text-cyan-600 mt-2 bg-cyan-50 border border-cyan-100/80 px-3 py-1 rounded-full w-fit mx-auto">
            {timeInfoText}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => handleOpenAbsenModal('masuk')}
            disabled={Boolean(sudahMasuk)}
            className={`flex-1 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer border-none ${
              !sudahMasuk
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed'
            }`}
          >
            <LogIn className="w-5 h-5" />
            Masuk
          </button>
          <button
            onClick={() => handleOpenAbsenModal('keluar')}
            disabled={!sudahMasuk || Boolean(sudahKeluar)}
            className={`flex-1 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer border-none ${
              sudahMasuk && !sudahKeluar
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/10 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed'
            }`}
          >
            <LogOut className="w-5 h-5" />
            Keluar
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/80 flex justify-center items-center">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kehadiran</p>
            <p className="text-lg font-extrabold text-slate-800 leading-tight">
              {totalHadir} <span className="text-xs font-bold text-slate-400">Hari</span>
            </p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100/80 flex justify-center items-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</p>
            <p className="text-lg font-extrabold text-slate-800 leading-tight">
              {totalPending} <span className="text-xs font-bold text-slate-400">Data</span>
            </p>
          </div>
        </div>
      </div>

      {/* Connectivity & Offline Sync Widget */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-2xl flex justify-center items-center flex-shrink-0 ${
            isOnline ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/80' : 'bg-amber-50 text-amber-600 border border-amber-100/80'
          }`}>
            <CloudUpload className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-slate-800">Status Sinkronisasi</p>
              <button
                onClick={onTriggerSync}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-cyan-600 transition-colors bg-transparent border-none cursor-pointer"
                title="Sinkronisasi Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mt-1 font-semibold">
              {isOnline
                ? 'Terhubung dengan server. Data absensi disinkronkan langsung.'
                : 'Offline. Absensi baru disimpan di memori HP dan otomatis dikirim saat online kembali.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isOnline ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/80' : 'bg-red-50 text-red-600 border border-red-100/80'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                {syncStats.pending} Antrean
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Absen Capture Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-end sm:items-center backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-lg">
                Konfirmasi Absen {absenType.toUpperCase()}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full border-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Location Box */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-200/80 text-center flex flex-col items-center">
              <MapPin className={`w-6 h-6 mb-1.5 ${gpsLoading ? 'text-cyan-600 animate-bounce' : 'text-emerald-500'}`} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lokasi Terdeteksi</p>
              <p className={`text-xs font-bold ${gpsError ? 'text-red-500' : 'text-slate-800'}`}>
                {locationText}
              </p>
            </div>

            {/* Camera View Box */}
            <div className="relative w-full h-56 bg-slate-950 border border-slate-200 rounded-2xl mb-4 overflow-hidden flex items-center justify-center">
              {cameraLoading && (
                <div className="text-center text-slate-400 text-xs">
                  <Camera className="w-8 h-8 animate-pulse mx-auto mb-2 text-cyan-600" />
                  Mengakses kamera...
                </div>
              )}
              {cameraError && (
                <p className="text-xs text-red-400 text-center px-6 leading-relaxed font-semibold">
                  {cameraError}
                </p>
              )}

              {/* Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${
                  videoStream && !photoData ? 'block' : 'hidden'
                }`}
              />

              {/* Photo Preview */}
              {photoData && (
                <img
                  src={photoData}
                  className="absolute inset-0 w-full h-full object-cover"
                  alt="Capture Preview"
                  referrerPolicy="no-referrer"
                />
              )}

              {/* Hidden Canvas */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Action Buttons */}
            {!photoData ? (
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!videoStream}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-cyan-600/10 active:scale-[0.98] transition-all flex justify-center items-center gap-2 cursor-pointer border-none"
              >
                <Camera className="w-5 h-5" />
                Ambil Foto
              </button>
            ) : (
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  Ulangi Foto
                </button>
                <button
                  type="button"
                  onClick={handleAbsenSubmit}
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-600/10 active:scale-[0.98] transition-all flex justify-center items-center gap-2 cursor-pointer border-none"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Kirim Absensi'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
