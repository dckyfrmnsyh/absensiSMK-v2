import React, { useState } from 'react';
import { Calendar, Download, FileText, Trash2, CheckCircle2, Clock, AlertCircle, Image as ImageIcon, X, MapPin } from 'lucide-react';
import { AttendanceRecord } from '../types';

interface RiwayatTabProps {
  records: AttendanceRecord[];
  onExportBackup: () => void;
  onResetData: () => void;
  onGeneratePdf: (monthKey: string) => void;
}

export default function RiwayatTab({
  records,
  onExportBackup,
  onResetData,
  onGeneratePdf
}: RiwayatTabProps) {
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [lightboxPhoto, setLightboxPhoto] = useState<{ src: string; title: string } | null>(null);

  const getStatusStyle = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'Valid':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-100/80';
      case 'Ditolak':
        return 'bg-red-50 text-red-600 border border-red-100/80';
      default:
        return 'bg-amber-50 text-amber-600 border border-amber-100/80';
    }
  };

  const getStatusIcon = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'Valid':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'Ditolak':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-amber-400" />;
    }
  };

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

  const handleOpenPhoto = (photo: string | null, title: string) => {
    if (!photo) return;
    setLightboxPhoto({ src: photo, title });
  };

  const handlePdfSubmit = () => {
    if (!selectedMonth) return;
    onGeneratePdf(selectedMonth);
    setMonthPickerOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-black text-slate-800">Riwayat Absensi</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onExportBackup}
            className="flex items-center gap-1.5 text-xs bg-white text-cyan-600 font-bold border border-cyan-200 rounded-xl px-3 py-2 hover:bg-cyan-50/50 shadow-sm active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Ekspor
          </button>
          <button
            onClick={() => setMonthPickerOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-white text-emerald-600 font-bold border border-emerald-200 rounded-xl px-3 py-2 hover:bg-emerald-50/50 shadow-sm active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            PDF Bulanan
          </button>
          <button
            onClick={onResetData}
            className="flex items-center gap-1.5 text-xs bg-white text-red-600 font-bold border border-red-200 rounded-xl px-3 py-2 hover:bg-red-50/50 shadow-sm active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* History Grid */}
      {records.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 border border-slate-200 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <p className="text-sm font-bold text-slate-800">Belum ada riwayat absensi</p>
          <p className="text-xs text-slate-500 mt-1 font-semibold">Lakukan absen masuk hari ini untuk memulai catatan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-3xl p-4 border border-slate-200/80 hover:border-slate-300 shadow-sm transition-all duration-200"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 mb-3 gap-2">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 min-w-0">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{formatDateLabel(record.dateKey)}</span>
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusStyle(record.status)}`}>
                  {getStatusIcon(record.status)}
                  {record.status}
                </span>
              </div>

              {/* Checkin / Checkout Split Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {/* Check-In */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-2.5 rounded-2xl">
                  <button
                    onClick={() => handleOpenPhoto(record.masuk?.photo || null, `Foto Masuk - ${record.masuk?.time}`)}
                    disabled={!record.masuk?.photo}
                    className={`relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 active:scale-95 transition-transform border border-slate-200 flex items-center justify-center ${
                      record.masuk?.photo ? 'cursor-pointer hover:border-cyan-500' : 'opacity-40 cursor-not-allowed bg-slate-100'
                    }`}
                  >
                    {record.masuk?.photo ? (
                      <img src={record.masuk.photo} className="w-full h-full object-cover" alt="Masuk" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Masuk</p>
                    <p className="font-extrabold text-slate-800 text-sm">{record.masuk?.time || '--:--'}</p>
                  </div>
                </div>

                {/* Check-Out */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-2.5 rounded-2xl">
                  <button
                    onClick={() => handleOpenPhoto(record.keluar?.photo || null, `Foto Keluar - ${record.keluar?.time}`)}
                    disabled={!record.keluar?.photo}
                    className={`relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 active:scale-95 transition-transform border border-slate-200 flex items-center justify-center ${
                      record.keluar?.photo ? 'cursor-pointer hover:border-cyan-500' : 'opacity-40 cursor-not-allowed bg-slate-100'
                    }`}
                  >
                    {record.keluar?.photo ? (
                      <img src={record.keluar.photo} className="w-full h-full object-cover" alt="Keluar" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Keluar</p>
                    <p className="font-extrabold text-slate-800 text-sm">{record.keluar?.time || '--:--'}</p>
                  </div>
                </div>
              </div>

              {/* Location Text */}
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">
                  {record.masuk?.locationText || 'Lokasi tidak terdeteksi'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Month Picker Modal */}
      {monthPickerOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-slate-250 w-full max-w-sm rounded-3xl p-5 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800">PDF Bulanan</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed font-semibold">
              Pilih bulan laporan untuk menggenerasi dan mencetak data absensi resmi.
            </p>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bulan Laporan</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 rounded-xl px-3.5 py-3 text-sm font-semibold outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setMonthPickerOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePdfSubmit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/10 active:scale-95 transition-all cursor-pointer border-none"
              >
                Buat PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox Popup Modal */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 max-w-md w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col relative cursor-default"
          >
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="font-extrabold text-slate-800 text-xs truncate max-w-[80%]">
                {lightboxPhoto.title}
              </h3>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 p-1.5 rounded-full border-none cursor-pointer transition-all duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
              <img
                src={lightboxPhoto.src}
                alt="Full Absensi"
                className="max-h-[60vh] w-full object-contain rounded-2xl shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
