import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Download, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { LaporanHarianEntry, LaporanHarianProfileMeta } from '../types';
import type { Profile } from '../types';

type Props = {
  profile: Profile;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  initialMonth?: string; // YYYY-MM
};

const STORAGE_KEY = 'lkh_siswa_entries_v2';

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDateID(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function bulanLabel(bulanRaw: string) {
  // bulanRaw = YYYY-MM
  if (!bulanRaw) return '';
  const [y, m] = bulanRaw.split('-');
  const idx = parseInt(m, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return '';
  return `${MONTHS_ID[idx]} ${y}`;
}

function loadEntries(): LaporanHarianEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as LaporanHarianEntry[];
  } catch {
    return [];
  }
}

function saveEntries(entries: LaporanHarianEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function LaporanHarianSiswaTab({ profile, showToast, initialMonth }: Props) {
  const [entries, setEntries] = useState<LaporanHarianEntry[]>(() => loadEntries());

  const [bulanLaporan, setBulanLaporan] = useState<string>(() => {
    if (initialMonth) return initialMonth;
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  });

  // add states
  const [addDate, setAddDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [addStart, setAddStart] = useState<string>('07:30');
  const [addEnd, setAddEnd] = useState<string>('09:00');
  const [addUraian, setAddUraian] = useState<string>('');

  // edit states
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editStart, setEditStart] = useState<string>('');
  const [editEnd, setEditEnd] = useState<string>('');
  const [editUraian, setEditUraian] = useState<string>('');

  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  const grouped = useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
    );
    const map = new Map<string, LaporanHarianEntry[]>();
    for (const e of sorted) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return { sorted, map };
  }, [entries]);

  const totalDays = grouped.map.size;

  const meta: LaporanHarianProfileMeta = useMemo(() => {
    return {
      namaSiswa: (profile as any).nama ?? (profile as any).namaSiswa ?? '',
      nis: (profile as any).nis ?? '',
      kelas: (profile as any).kelas ?? '',
      tempatPkl: (profile as any).tempatPkl,
    };
  }, [profile]);

  const excelRows = useMemo(() => {
    // meniru logika exportExcel:
    // urut per tanggal lalu waktu
    // Hari, Tanggal diisi hanya baris pertama per tanggal
    const sorted = [...entries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
    );

    const map = new Map<string, LaporanHarianEntry[]>();
    for (const e of sorted) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }

    let no = 1;
    const orderedDates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

    const rows: Array<{
      no: number;
      dateLabel: string; // kosong jika bukan baris pertama untuk tanggal tsb
      timeRange: string;
      uraian: string;
      id: string;
    }> = [];

    for (const date of orderedDates) {
      const rowsForDate = (map.get(date) ?? []).slice().sort((a, b) => a.start.localeCompare(b.start));
      const dateLabel = formatDateID(date);

      for (let i = 0; i < rowsForDate.length; i++) {
        const r = rowsForDate[i];
        rows.push({
          no: no++,
          dateLabel: i === 0 ? dateLabel : '',
          timeRange: `${r.start}-${r.end}`,
          uraian: r.uraian,
          id: r.id,
        });
      }
    }

    return rows;
  }, [entries]);

  const sortedAll = useMemo(() => {
    return [...entries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
    );
  }, [entries]);

  function addEntry() {
    const date = addDate;
    const start = addStart;
    const end = addEnd;
    const uraian = addUraian.trim();

    if (!date) return showToast('⚠️ Pilih tanggal terlebih dahulu', 'warning');
    if (!start || !end) return showToast('⚠️ Isi waktu mulai dan selesai', 'warning');
    if (!uraian) return showToast('⚠️ Isi uraian kegiatan', 'warning');

    const next = [...entries, { id: uid(), date, start, end, uraian }];
    setEntries(next);
    setAddUraian('');
    showToast('✅ Kegiatan ditambahkan', 'success');
  }

  function deleteEntry(id: string) {
    if (!confirm('Hapus kegiatan ini?')) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    showToast('🗑 Kegiatan dihapus', 'success');
  }

  function openEdit(id: string) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    setEditId(id);
    setEditDate(e.date);
    setEditStart(e.start);
    setEditEnd(e.end);
    setEditUraian(e.uraian);
  }

  function closeEdit() {
    setEditId(null);
  }

  function saveEdit() {
    if (!editId) return;

    const uraian = editUraian.trim();
    if (!editDate) return showToast('⚠️ Tanggal wajib diisi', 'warning');
    if (!uraian) return showToast('⚠️ Uraian wajib diisi', 'warning');

    setEntries((prev) =>
      prev.map((e) =>
        e.id === editId ? { ...e, date: editDate, start: editStart, end: editEnd, uraian } : e,
      ),
    );
    closeEdit();
    showToast('✅ Kegiatan diperbarui', 'success');
  }

  async function exportExcel() {
  if (entries.length === 0) return showToast('⚠️ Tidak ada data untuk diekspor', 'warning');

  const { default: ExcelJS } = await import('exceljs');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Laporan Kegiatan Harian');

  // ===== Kolom & style dasar =====
  // Tabel akan ditaruh di B-E (No, Hari/Tanggal, Waktu, Uraian)
  ws.getColumn(1).width = 3;   // Kolom A (margin kecil)
  ws.getColumn(2).width = 11;   // B: No
  ws.getColumn(3).width = 22;  // C: Hari, Tanggal
  ws.getColumn(4).width = 14;  // D: Waktu
  ws.getColumn(5).width = 60;  // E: Uraian

  ws.properties.defaultRowHeight = 18;

  const dark = '1A1714';
  const lightGray = 'F3F4F6';

  const headerFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF' + dark },
  };

  const thinBorder = {
    top: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    left: { style: 'thin' as const },
    right: { style: 'thin' as const },
  };

  const setCell = (addr: string, value: any, opts?: Partial<ExcelJS.Cell> & any) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    if (opts?.font) cell.font = opts.font;
    if (opts?.alignment) cell.alignment = opts.alignment;
    if (opts?.fill) cell.fill = opts.fill;
    if (opts?.border) cell.border = opts.border;
    if (opts?.numFmt) cell.numFmt = opts.numFmt;
    return cell;
  };

  // ===== Judul (merge B1:E1) =====
  ws.mergeCells('B1:E1');
  setCell('B1', 'FORMULIR LAPORAN KEGIATAN HARIAN SISWA', {
    font: { bold: true, size: 12, color: { argb: 'FF111827' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
  });
  ws.getRow(1).height = 24;

  // Blank row 2
  ws.getRow(2).height = 6;

  // ===== Identitas =====
  const rowNama = 3;
  setCell(`B${rowNama}`, 'Nama Siswa', {
    font: { bold: true, size: 10, color: { argb: 'FF374151' } },
  });
  setCell(`C${rowNama}`, ':', {
    font: { bold: true, size: 10, color: { argb: 'FF374151' } },
    alignment: { horizontal: 'center' },
  });
  ws.mergeCells(`D${rowNama}:E${rowNama}`);
  setCell(`D${rowNama}`, meta.namaSiswa || '-', {
    font: { bold: true, size: 10, color: { argb: 'FF111827' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  const rowNis = 4;
  setCell(`B${rowNis}`, 'NIS', { font: { bold: true, size: 10, color: { argb: 'FF374151' } } });
  setCell(`C${rowNis}`, ':', { font: { bold: true, size: 10, color: { argb: 'FF374151' } } , alignment: { horizontal: 'center' }});
  ws.mergeCells(`D${rowNis}:E${rowNis}`);
  setCell(`D${rowNis}`, meta.nis || '-', {
    font: { bold: true, size: 10, color: { argb: 'FF111827' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  const rowKelas = 5;
  setCell(`B${rowKelas}`, 'Kelas', { font: { bold: true, size: 10, color: { argb: 'FF374151' } } });
  setCell(`C${rowKelas}`, ':', { font: { bold: true, size: 10, color: { argb: 'FF374151' } }, alignment: { horizontal: 'center' }});
  ws.mergeCells(`D${rowKelas}:E${rowKelas}`);
  setCell(`D${rowKelas}`, meta.kelas || '-', {
    font: { bold: true, size: 10, color: { argb: 'FF111827' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  const rowTempat = 6;
  setCell(`B${rowTempat}`, 'Tempat PKL', { font: { bold: true, size: 10, color: { argb: 'FF374151' } } });
  setCell(`C${rowTempat}`, ':', { font: { bold: true, size: 10, color: { argb: 'FF374151' } }, alignment: { horizontal: 'center' }});
  ws.mergeCells(`D${rowTempat}:E${rowTempat}`);
  setCell(`D${rowTempat}`, meta.tempatPkl || '-', {
    font: { bold: true, size: 10, color: { argb: 'FF111827' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  const rowBulan = 7;
  setCell(`B${rowBulan}`, 'Bulan', { font: { bold: true, size: 10, color: { argb: 'FF374151' } } });
  setCell(`C${rowBulan}`, ':', { font: { bold: true, size: 10, color: { argb: 'FF374151' } }, alignment: { horizontal: 'center' }});
  ws.mergeCells(`D${rowBulan}:E${rowBulan}`);
  setCell(`D${rowBulan}`, bulanLabel(bulanLaporan) || '-', {
    font: { bold: true, size: 10, color: { argb: 'FF111827' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  // ===== Header tabel (Row 9 kosong, Table Header Row 10) =====
  // Biar konsisten dengan data yang kamu tampil sekarang, kita set header tabel di baris 9.
  const tableHeaderRow = 9;

  setCell(`B${tableHeaderRow}`, 'No', { 
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: headerFill,
    border: thinBorder,
  });
  setCell(`C${tableHeaderRow}`, 'Hari, Tanggal', { 
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    fill: headerFill,
    border: thinBorder,
  });
  setCell(`D${tableHeaderRow}`, 'Waktu', { 
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: headerFill,
    border: thinBorder,
  });
  setCell(`E${tableHeaderRow}`, 'Uraian Kegiatan', { 
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    fill: headerFill,
    border: thinBorder,
  });

  ws.getRow(tableHeaderRow).height = 20;

  // ===== Isi tabel =====
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  );

  const map = new Map<string, LaporanHarianEntry[]>();
  for (const e of sorted) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }

  const orderedDates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

  let no = 1;
  let currentRow = tableHeaderRow + 1;

  const lastDate = sorted.length ? sorted[sorted.length - 1].date : null;

  for (const date of orderedDates) {
    const rowsForDate = (map.get(date) ?? []).slice().sort((a, b) => a.start.localeCompare(b.start));
    const dateLabel = formatDateID(date);

    for (let i = 0; i < rowsForDate.length; i++) {
      const r = rowsForDate[i];

      // B: No
      setCell(`B${currentRow}`, no++, {
        font: { bold: true, size: 10, color: { argb: 'FF111827' } },
        alignment: { horizontal: 'center', vertical: 'top', wrapText: true },
        border: thinBorder,
      });

      // C: Hari, Tanggal (hanya baris pertama)
      setCell(`C${currentRow}`, i === 0 ? dateLabel : '', {
        font: { bold: true, size: 10, color: { argb: 'FF111827' } },
        alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
        border: thinBorder,
      });

      // D: Waktu
      setCell(`D${currentRow}`, `${r.start}-${r.end}`, {
        font: { bold: true, size: 10, color: { argb: 'FF111827' } },
        alignment: { horizontal: 'center', vertical: 'top', wrapText: true },
        border: thinBorder,
      });

      // E: Uraian Kegiatan
      setCell(`E${currentRow}`, r.uraian, {
        font: { bold: false, size: 10, color: { argb: 'FF111827' } },
        alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
        border: thinBorder,
      });

      currentRow++;
    }
  }

  const lastDataRow = currentRow - 1;

  // ===== Tanda tangan (merge B:E) =====
  // Sisipkan 1 baris kosong dulu
  currentRow += 1;

  
  
  setCell(`E${currentRow}`, `Tana Tidung, ${lastDate ? formatDateID(lastDate) : '-'}`, {
    font: { bold: true, size: 10, color: { argb: 'FF111827' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  currentRow++;

  
  setCell(`E${currentRow}`, 'Pembimbing Industri / PKL', {
    font: { bold: true, size: 10, color: { argb: 'FF111827' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  currentRow += 3; // ruang tanda tangan

  
  setCell(`E${currentRow}`, 'Nama Pembimbing Industri / PKL', {
    font: { bold: true, size: 10, color: { argb: 'FF111827' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  // ===== Download file =====
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const safeNama = (meta.namaSiswa || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_');
  const fname = `Laporan_Kegiatan_Harian_Siswa_${safeNama}_${bulanLaporan}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(url);

  showToast('✅ File Excel berhasil diunduh', 'success');
}

  function loadSampleData() {
    if (entries.length > 0 && !confirm('Data saat ini akan ditimpa. Lanjutkan?')) return;

    const sample: LaporanHarianEntry[] = [
      { id: uid(), date: '2026-06-03', start: '07:30', end: '08:15', uraian: 'Apel Pagi & briefing PKL' },
      { id: uid(), date: '2026-06-03', start: '08:30', end: '11:30', uraian: 'Input data administrasi dan rekap kegiatan' },

      { id: uid(), date: '2026-06-04', start: '07:30', end: '09:00', uraian: 'Membantu penataan dokumen/surat masuk' },
      { id: uid(), date: '2026-06-04', start: '09:15', end: '12:00', uraian: 'Menyusun template laporan & format dokumen' },

      { id: uid(), date: '2026-06-05', start: '07:30', end: '10:00', uraian: 'Praktik bantuan teknis (setup komputer/perangkat)' },
      { id: uid(), date: '2026-06-05', start: '10:15', end: '12:00', uraian: 'Instal aplikasi pendukung kerja' },

      { id: uid(), date: '2026-06-10', start: '07:30', end: '09:30', uraian: 'Membantu desain poster/infografis sederhana' },
      { id: uid(), date: '2026-06-10', start: '10:00', end: '12:00', uraian: 'Revisi materi desain & export file' },

      { id: uid(), date: '2026-06-12', start: '07:30', end: '11:00', uraian: 'Survey/observasi proses kerja di lapangan' },
      { id: uid(), date: '2026-06-12', start: '13:00', end: '15:00', uraian: 'Pembuatan ringkasan hasil observasi & rekomendasi' },
    ];

    setEntries(sample);
    showToast('📄 Data contoh dimuat', 'success');
  }

  function clearAll() {
    if (!confirm('Hapus semua data kegiatan siswa?')) return;
    setEntries([]);
    showToast('🗑 Semua data dihapus', 'success');
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-2xl font-black text-slate-800">
              Laporan Kegiatan Harian Siswa
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1.5">
              {entries.length} kegiatan · {totalDays} hari
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
                <CalendarDays className="w-4 h-4 text-slate-500" />
                <span>Bulan</span>
              </div>
              <input
                type="month"
                value={bulanLaporan}
                onChange={(e) => setBulanLaporan(e.target.value)}
                className="border border-slate-200 rounded-2xl px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={loadSampleData}
              className="px-3 py-2 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
            >
              📄 Muat Contoh
            </button>
            <button
              onClick={exportExcel}
              className="px-3 py-2 rounded-2xl bg-amber-800 text-white text-sm font-bold hover:bg-amber-700 inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Unduh Excel
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-2 rounded-2xl bg-red-50 text-red-700 text-sm font-bold border border-red-200 hover:bg-red-100 inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Semua
            </button>
          </div>
        </div>
      </div>

      {/* Layout: kiri form, kanan preview Excel */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-5">
        {/* Form add */}
        <aside className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
          <h3 className="font-extrabold text-slate-800 mb-4">Tambah Kegiatan</h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-extrabold text-slate-500 mb-1 block">Tanggal</label>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">Mulai</label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="time"
                    value={addStart}
                    onChange={(e) => setAddStart(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl pl-9 pr-3 py-2 text-sm bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">Selesai</label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="time"
                    value={addEnd}
                    onChange={(e) => setAddEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl pl-9 pr-3 py-2 text-sm bg-slate-50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-500 mb-1 block">Uraian Kegiatan</label>
              <textarea
                value={addUraian}
                onChange={(e) => setAddUraian(e.target.value)}
                placeholder="Deskripsi kegiatan..."
                className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm bg-slate-50 min-h-[100px]"
              />
            </div>

            <button
              onClick={addEntry}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-2xl inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Tambah Kegiatan
            </button>

            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              Data tersimpan offline (localStorage). Sinkronisasi bisa ditambahkan setelah Anda tentukan skema Supabase-nya.
            </p>
          </div>
        </aside>

        {/* Preview Excel */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200/70">
            <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
              Preview Format Excel
            </p>
          </div>

          <div className="p-4">
            {/* Judul formulir (baris 1 di Excel) */}
            <div className="text-center">
              <p className="text-[12px] font-extrabold text-slate-900">
                FORMULIR LAPORAN KEGIATAN HARIAN SISWA
              </p>
            </div>

            <div className="h-2" />

            {/* Baris identitas (sesuai exportExcel) */}
            <div className="space-y-1 text-[12px] font-bold text-slate-800">
              <div className="flex gap-2">
                <span className="w-[110px] text-slate-600">Nama Siswa</span>
                <span className="text-slate-400">:</span>
                <span className="flex-1">{meta.namaSiswa || '-'}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-[110px] text-slate-600">NIS</span>
                <span className="text-slate-400">:</span>
                <span className="flex-1">{meta.nis || '-'}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-[110px] text-slate-600">Kelas</span>
                <span className="text-slate-400">:</span>
                <span className="flex-1">{meta.kelas || '-'}</span>
              </div>
              {meta.tempatPkl ? (
                <div className="flex gap-2">
                  <span className="w-[110px] text-slate-600">Tempat PKL</span>
                  <span className="text-slate-400">:</span>
                  <span className="flex-1">{meta.tempatPkl}</span>
                </div>
              ) : null}
              <div className="flex gap-2">
                <span className="w-[110px] text-slate-600">Bulan</span>
                <span className="text-slate-400">:</span>
                <span className="flex-1">{bulanLabel(bulanLaporan) || '-'}</span>
              </div>
            </div>

            {/* Blank row */}
            <div className="h-4" />

            {/* Tabel header Excel (tampilkan 4 kolom seperti export: No, Hari, Tanggal, Waktu, Uraian) */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 520 }}>
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="text-left px-3 py-2 text-[11px]" style={{ width: 52 }}>
                      No
                    </th>
                    <th className="text-left px-3 py-2 text-[11px]" style={{ width: 260 }}>
                      Hari, Tanggal
                    </th>
                    <th className="text-left px-3 py-2 text-[11px]" style={{ width: 120 }}>
                      Waktu
                    </th>
                    <th className="text-left px-3 py-2 text-[11px]">
                      Uraian Kegiatan
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {excelRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-slate-500 font-bold">
                        Belum ada data kegiatan
                      </td>
                    </tr>
                  ) : (
                    excelRows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 align-top text-slate-700 font-extrabold text-[12px]">
                          {r.no}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-800 font-extrabold text-[12px]">
                          {r.dateLabel ? r.dateLabel : <span className="text-slate-400"> </span>}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-800 font-extrabold text-[12px] whitespace-nowrap">
                          {r.timeRange}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-800 font-semibold text-[12px]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 break-words pr-1">{r.uraian}</div>

                            {/* Kontrol Edit/Hapus (tidak mengubah struktur 4 kolom) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                className="w-8 h-8 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center"
                                onClick={() => openEdit(r.id)}
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                className="w-8 h-8 rounded-2xl bg-red-50 text-red-700 border border-red-100 flex items-center justify-center"
                                onClick={() => deleteEntry(r.id)}
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Blank rows (mirip struktur Excel) */}
            <div className="h-4" />

            {/* Tanda tangan (sesuai urutan & teks di exportExcel kamu) */}
            <div className="mt-2 text-[12px] font-bold text-slate-800">
              <div className="flex justify-end">
                <div className="w-full max-w-[360px] text-right">
                  <p>
                    {sortedAll.length
                      ? `Tana Tidung, ${formatDateID(sortedAll[sortedAll.length - 1].date)}`
                      : 'Tana Tidung, -'}
                  </p>
                </div>
              </div>

              <div className="h-1" />

              <div className="flex justify-end">
                <div className="w-full max-w-[360px] text-right">
                  <p>Pembimbing Industri / PKL</p>
                </div>
              </div>

              <div className="h-10" />

              <div className="flex justify-end">
                <div className="w-full max-w-[360px] text-right">
                  <p>Nama Pembimbing Industri / PKL</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ringkas bawah */}
          <div className="px-4 py-3 border-t bg-slate-50 text-[11px] font-extrabold text-slate-600">
            Total kegiatan bulan ini: {entries.length}
          </div>
        </section>
      </div>

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-800">✏️ Edit Kegiatan</h3>
              <button
                onClick={closeEdit}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full border-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">Tanggal</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-500 mb-1 block">Mulai</label>
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-500 mb-1 block">Selesai</label>
                  <input
                    type="time"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">Uraian Kegiatan</label>
                <textarea
                  value={editUraian}
                  onChange={(e) => setEditUraian(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm bg-slate-50 min-h-[100px]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeEdit}
                className="px-3 py-2 rounded-2xl border border-slate-200 text-slate-700 font-extrabold"
              >
                Batal
              </button>
              <button
                onClick={saveEdit}
                className="px-3 py-2 rounded-2xl bg-amber-800 text-white font-extrabold hover:bg-amber-700"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}