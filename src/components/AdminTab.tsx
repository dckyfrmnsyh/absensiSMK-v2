import React, { useState, useEffect } from 'react';
import { 
  Shield, Search, Eye, FileSpreadsheet, Download, Upload, 
  AlertCircle, CheckCircle, Clock, X, ImageIcon, MapPin,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight 
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { AttendanceRecord, Profile, AuditLog } from '../types';
import { StorageService } from '../lib/db';
import { SupabaseAdapter } from '../lib/supabase';

interface AdminTabProps {
  records: AttendanceRecord[];
  onValidateRecord: (recordId: string, status: 'Valid' | 'Ditolak') => Promise<void>;
  isOnline: boolean;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function AdminTab({
  records,
  onValidateRecord,
  isOnline,
  showToast
}: AdminTabProps) {
  // Navigation & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ src: string; title: string } | null>(null);

  // Drag Scroll Table States
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeftState(tableContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Datatable Sorting & Pagination States
  const [sortField, setSortField] = useState<'nama' | 'dateKey' | 'time' | 'status'>('dateKey');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100000);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');

  // Excel Export States
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [exportClass, setExportClass] = useState('ALL');
  const [exportStatus, setExportStatus] = useState('ALL');
  const [classList, setClassList] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  // Excel Import States
  const [parsedStudents, setParsedStudents] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  // Extract classes from profiles to populate class filter
  useEffect(() => {
    const classes = Array.from(new Set(records.map(r => r.kelas).filter(Boolean)));
    setClassList(classes);
  }, [records]);

  // Active record for modal detail
  const activeRecord = records.find(r => r.id === selectedRecordId);

  // Filter records based on search terms and dropdown filters
  const filteredRecords = records.filter(r => {
    const q = searchTerm.toLowerCase();
    
    const searchMatch = !q || (
      r.nama.toLowerCase().includes(q) ||
      r.nis.toLowerCase().includes(q) ||
      r.kelas.toLowerCase().includes(q) ||
      r.dateKey.includes(q) ||
      r.status.toLowerCase().includes(q)
    );

    const statusMatch = statusFilter === 'ALL' || r.status === statusFilter;
    const classMatch = classFilter === 'ALL' || r.kelas === classFilter;

    return searchMatch && statusMatch && classMatch;
  });

  // Sort filtered records
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'nama') {
      valA = a.nama.toLowerCase();
      valB = b.nama.toLowerCase();
    } else if (sortField === 'dateKey') {
      valA = a.dateKey;
      valB = b.dateKey;
    } else if (sortField === 'status') {
      valA = a.status;
      valB = b.status;
    } else if (sortField === 'time') {
      valA = a.masuk?.time || a.keluar?.time || '';
      valB = b.masuk?.time || b.keluar?.time || '';
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Reset page number when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, classFilter, sortField, sortOrder]);

  const totalItems = sortedRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRecords = sortedRecords.slice(startIndex, startIndex + pageSize);

  const renderSortHeader = (label: string, field: 'nama' | 'dateKey' | 'time' | 'status') => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => {
          if (isActive) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortField(field);
            setSortOrder('asc');
          }
        }}
        className="flex items-center gap-1 hover:text-cyan-600 transition-colors font-bold uppercase tracking-wider text-[10px] bg-transparent border-none cursor-pointer focus:outline-none text-left"
      >
        {label}
        {isActive ? (
          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-cyan-600 inline-block" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-600 inline-block" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 inline-block" />
        )}
      </button>
    );
  };

  const getStatusStyle = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'Valid':
        return 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30';
      case 'Ditolak':
        return 'bg-red-950/40 text-red-400 border border-red-800/30';
      default:
        return 'bg-amber-950/40 text-amber-400 border border-amber-800/30';
    }
  };

  const getStatusIcon = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'Valid':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Ditolak':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-amber-400" />;
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

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WITA';
  };

  // Approval/Rejection validation action
  const handleValidateAction = async (status: 'Valid' | 'Ditolak') => {
    if (!selectedRecordId) return;
    try {
      await onValidateRecord(selectedRecordId, status);
      setSelectedRecordId(null);
    } catch (err: any) {
      console.error(err);
      showToast('Gagal validasi status: ' + (err.message || ''), 'error');
    }
  };

  // Download template import spreadsheet
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistem Absensi PKL SMKN 1 Tana Tidung';
      const sheet = workbook.addWorksheet('Template Roster Siswa');

      // Add titles
      sheet.mergeCells('A1:D1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'TEMPLATE IMPORT DATA SISWA PKL';
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: 'center' };

      sheet.mergeCells('A2:D2');
      const subCell = sheet.getCell('A2');
      subCell.value = 'Isi data mulai baris 5. Password default siswa baru: 123456. Jangan mengubah susunan kolom.';
      subCell.alignment = { horizontal: 'center' };

      // Headers
      const headerRow = sheet.getRow(4);
      headerRow.values = ['nis', 'nama', 'kelas', 'tempat_pkl'];
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Examples
      sheet.addRow(['12345678', 'M. Reza Pratama', 'XII RPL 1', 'PT. Teknologi Karya (Tarakan)']);
      sheet.addRow(['87654321', 'Ahmad Dani', 'XII TKJ 2', 'Dinas Kominfo Tana Tidung']);

      sheet.columns = [
        { width: 15 },
        { width: 25 },
        { width: 15 },
        { width: 30 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-import-siswa-pkl.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Template Excel berhasil diunduh', 'success');
    } catch (e: any) {
      console.error(e);
      showToast('Gagal memuat template Excel', 'error');
    }
  };

  // Upload and parse roster spreadsheet
  const handleUploadRoster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    showToast('Membaca file Excel...', 'info');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new Error('File Excel tidak memiliki worksheet.');
      }

      // Check header map
      const headersRow = sheet.getRow(4);
      const headers = [
        headersRow.getCell(1).value,
        headersRow.getCell(2).value,
        headersRow.getCell(3).value,
        headersRow.getCell(4).value
      ].map(h => String(h || '').trim().toLowerCase());

      if (headers[0] !== 'nis' || headers[1] !== 'nama' || headers[2] !== 'kelas' || headers[3] !== 'tempat_pkl') {
        throw new Error('Format kolom tidak cocok. Harap gunakan template yang sudah disediakan.');
      }

      const rows: any[] = [];
      const seenNis = new Set();

      // Read entries starting from row 5
      sheet.eachRow((row, rowNum) => {
        if (rowNum < 5) return;

        const rawNis = String(row.getCell(1).value || '').trim();
        const rawNama = String(row.getCell(2).value || '').trim();
        const rawKelas = String(row.getCell(3).value || '').trim();
        const rawTempat = String(row.getCell(4).value || '').trim();

        if (!rawNis && !rawNama && !rawKelas && !rawTempat) return;

        const errors: string[] = [];
        if (!rawNis) errors.push('NIS wajib diisi');
        if (!rawNama) errors.push('Nama wajib diisi');
        if (!rawKelas) errors.push('Kelas wajib diisi');
        if (!rawTempat) errors.push('Tempat PKL wajib diisi');
        if (rawNis && seenNis.has(rawNis)) errors.push('NIS terduplikat dalam file');

        if (rawNis) seenNis.add(rawNis);

        rows.push({
          rowNumber: rowNum,
          nis: rawNis,
          nama: rawNama,
          kelas: rawKelas,
          tempat_pkl: rawTempat,
          errors
        });
      });

      if (rows.length === 0) {
        throw new Error('Tidak ada data siswa yang valid dibaca dari file Excel.');
      }

      setParsedStudents(rows);
      showToast(`Berhasil membaca ${rows.length} baris data siswa`, 'success');
    } catch (err: any) {
      console.error('[Import] Error:', err);
      setParsedStudents([]);
      setFileName('');
      showToast(err.message || 'Gagal memproses file Excel', 'error');
    }
  };

  // Submit batch student imports
  const handleImportSubmit = async () => {
    const valid = parsedStudents.filter(p => p.errors.length === 0);
    if (valid.length === 0) {
      showToast('Tidak ada data siswa valid untuk diimport', 'warning');
      return;
    }

    if (!isOnline) {
      showToast('Import siswa hanya dapat dilakukan saat online/terhubung Supabase', 'warning');
      return;
    }

    setImporting(true);
    showToast('Mengunggah roster siswa ke database...', 'info');

    try {
      const students = valid.map(v => ({
        nis: v.nis,
        nama: v.nama,
        kelas: v.kelas,
        tempat_pkl: v.tempat_pkl
      }));

      const res = await SupabaseAdapter.adminUpsertStudents(students);
      showToast(`Roster berhasil diimport! Dibuat: ${res?.created || 0}, Diupdate: ${res?.updated || 0}`, 'success');
      setParsedStudents([]);
      setFileName('');
    } catch (err: any) {
      console.error('[Import submit] Error:', err);
      showToast(err.message || 'Gagal mengunggah data siswa', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Export filtered attendance records to Excel
  const handleExportExcel = async () => {
    setExporting(true);
    showToast('Membuat laporan Excel...', 'info');

    try {
      const filtered = records.filter(r => {
        const monthMatch = r.dateKey.startsWith(exportMonth);
        const classMatch = exportClass === 'ALL' || r.kelas === exportClass;
        const statusMatch = exportStatus === 'ALL' || r.status === exportStatus;
        return monthMatch && classMatch && statusMatch;
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistem Absensi PKL SMKN 1 Tana Tidung';
      const sheet = workbook.addWorksheet('Laporan Absensi', {
        views: [{ state: 'frozen', ySplit: 10 }]
      });

      // Title rows
      sheet.mergeCells('A1:L1');
      const title = sheet.getCell('A1');
      title.value = 'LAPORAN REKAPITULASI ABSENSI SISWA PKL';
      title.font = { bold: true, size: 16 };
      title.alignment = { horizontal: 'center' };

      sheet.mergeCells('A2:L2');
      const subtitle = sheet.getCell('A2');
      subtitle.value = 'SMK Negeri 1 Tana Tidung';
      subtitle.font = { bold: true, size: 12 };
      subtitle.alignment = { horizontal: 'center' };

      sheet.getCell('A4').value = 'Bulan Rekap';
      sheet.getCell('B4').value = exportMonth;
      sheet.getCell('A5').value = 'Filter Kelas';
      sheet.getCell('B5').value = exportClass === 'ALL' ? 'Semua Kelas' : exportClass;
      sheet.getCell('A6').value = 'Filter Status';
      sheet.getCell('B6').value = exportStatus === 'ALL' ? 'Semua Status' : exportStatus;
      sheet.getCell('A7').value = 'Tanggal Cetak';
      sheet.getCell('B7').value = new Date().toLocaleString('id-ID');

      // Table Headers at Row 10
      const headerRow = sheet.getRow(10);
      headerRow.values = [
        'No', 'Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Tempat PKL', 
        'Jam Masuk', 'Jam Keluar', 'Lokasi Masuk', 'Status', 'Divalidasi Pada', 'Validator'
      ];
      headerRow.height = 24;
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filtered.forEach((r, idx) => {
        const row = sheet.addRow([
          idx + 1,
          r.dateKey,
          r.nis,
          r.nama,
          r.kelas,
          r.tempatPkl,
          r.masuk?.time || '-',
          r.keluar?.time || '-',
          r.masuk?.locationText || '-',
          r.status,
          r.validatedAt ? new Date(r.validatedAt).toLocaleDateString('id-ID') : '-',
          r.validatedByName || '-'
        ]);

        // Status highlight
        const statusCell = row.getCell(10);
        if (r.status === 'Valid') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        } else if (r.status === 'Ditolak') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        }
      });

      sheet.columns = [
        { width: 5 }, { width: 12 }, { width: 15 }, { width: 25 }, { width: 12 }, { width: 25 },
        { width: 12 }, { width: 12 }, { width: 30 }, { width: 12 }, { width: 18 }, { width: 18 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-absensi-pkl-${exportMonth}-kelas-${exportClass}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Laporan Excel berhasil diunduh', 'success');
    } catch (err: any) {
      console.error('[Export] Error:', err);
      showToast('Gagal menggenerasi laporan Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  const getRecordValidationAudit = (record: AttendanceRecord): AuditLog[] => {
    // Collect from both stored audits and global audit store filtered by record ID
    const auditStore = StorageService.getAdminAuditLogs();
    const recordAudits = record.auditLog || [];
    const filteredStore = auditStore.filter(a => a.recordId === record.id);
    
    // Deduplicate
    const combined = [...recordAudits, ...filteredStore];
    const unique = new Map();
    combined.forEach(item => {
      unique.set(item.id, item);
    });
    return Array.from(unique.values()).sort((a, b) => new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime());
  };

  return (
    <div className="space-y-4">
      {/* Administrator Header */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-[0.06] text-cyan-600 pointer-events-none select-none z-0">
          <Shield className="w-40 h-40" />
        </div>
        <h2 className="text-lg font-black relative z-10 text-slate-800 flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-600" />
          Panel Administrator
        </h2>
        <p className="text-xs text-slate-500 mt-1.5 relative z-10 leading-relaxed font-semibold">
          Validasi data absensi, ekspor laporan rekapitulasi, dan unggah roster siswa baru.
        </p>
      </div>

      {/* Validation Panel Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-850">Validasi Absensi</h3>
              <span className="text-[10px] bg-cyan-100 text-cyan-700 font-extrabold px-2 py-0.5 rounded-full">
                {totalItems} Data
              </span>
            </div>
            {/* Horizontal Scroll Helper Badge */}
            <span className="text-[9px] font-bold text-cyan-600 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <span>↔ Geser Tabel</span>
            </span>
          </div>
          
          <div className="grid grid-cols-1 gap-2 md:flex md:items-center">
            {/* Table Search Bar - Placed prominently as the absolute first item */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-cyan-200 hover:border-cyan-400 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none transition-all shadow-sm shadow-cyan-600/5 placeholder:text-slate-400"
                placeholder="Cari nama atau NIS siswa..."
              />
            </div>

            <div className="flex gap-2">
              {/* Filter Kelas */}
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="flex-1 md:flex-initial bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl px-2.5 py-2.5 text-xs font-bold outline-none focus:border-cyan-500 transition-colors cursor-pointer min-w-[110px]"
              >
                <option value="ALL">Semua Kelas</option>
                {classList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Filter Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 md:flex-initial bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl px-2.5 py-2.5 text-xs font-bold outline-none focus:border-cyan-500 transition-colors cursor-pointer min-w-[110px]"
              >
                <option value="ALL">Semua Status</option>
                <option value="Pending">Pending</option>
                <option value="Valid">Valid</option>
                <option value="Ditolak">Ditolak</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Grid / Table */}
        {paginatedRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-semibold">
            Tidak ada data absensi yang sesuai pencarian atau filter.
          </div>
        ) : (
          <>
            {/* Fully swipeable/drag-scrollable table frame with visible scrollbars and indicators */}
            <div 
              ref={tableContainerRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className="overflow-x-auto select-none cursor-grab active:cursor-grabbing pb-2 transition-all duration-150 scroll-smooth focus:outline-none"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <table className="w-full text-left text-xs whitespace-nowrap table-auto min-w-[650px]">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">{renderSortHeader('Nama Siswa / NIS', 'nama')}</th>
                    <th className="px-4 py-3">{renderSortHeader('Tanggal Absen', 'dateKey')}</th>
                    <th className="px-4 py-3">{renderSortHeader('Waktu Masuk-Keluar', 'time')}</th>
                    <th className="px-4 py-3">{renderSortHeader('Status', 'status')}</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.map((r) => {
                    const checkin = r.masuk?.time || '--:--';
                    const checkout = r.keluar?.time || '--:--';
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-extrabold text-slate-800">{r.nama}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{r.kelas} • NIS: {r.nis}</p>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-700">
                          {formatDateLabel(r.dateKey)}
                        </td>
                        <td className="px-4 py-3.5 font-extrabold text-slate-700">
                          {checkin} - {checkout}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusStyle(r.status)}`}>
                            {getStatusIcon(r.status)}
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center animate-fade-in">
                          <button
                            type="button"
                            onClick={() => setSelectedRecordId(r.id)}
                            className="bg-slate-100 hover:bg-slate-200 text-cyan-600 px-3 py-1.5 rounded-xl font-bold border border-slate-200 transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
              {/* Page Size & Record Counts */}
              <div className="flex items-center gap-3">
                <span>Tampilkan</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={100000}>Semua</option>
                </select>
                <span>
                  {pageSize >= 100000 ? (
                    <>Menampilkan semua <strong className="text-slate-700">{totalItems}</strong> data</>
                  ) : (
                    <>
                      Menampilkan <strong className="text-slate-700">{totalItems === 0 ? 0 : startIndex + 1}</strong> - <strong className="text-slate-700">{Math.min(startIndex + pageSize, totalItems)}</strong> dari <strong className="text-slate-700">{totalItems}</strong> data
                    </>
                  )}
                </span>
              </div>

              {/* Page Navigation Buttons */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                    })
                    .map((page, index, array) => {
                      const isSelected = currentPage === page;
                      const showEllipsis = index > 0 && page - array[index - 1] > 1;

                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && <span className="px-1.5 text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/10 border-none'
                                : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Excel Exporter Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-black text-slate-850">Laporan Absensi Excel</h3>
          <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">
            Ekspor rekapitulasi data absensi bulanan siswa ke file Spreadsheet (.xlsx).
          </p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Pilih Bulan</label>
            <input
              type="month"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Filter Kelas</label>
            <select
              value={exportClass}
              onChange={(e) => setExportClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="ALL">Semua Kelas</option>
              {classList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Filter Status</label>
            <select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="ALL">Semua Status</option>
              <option value="Pending">Pending</option>
              <option value="Valid">Valid</option>
              <option value="Ditolak">Ditolak</option>
            </select>
          </div>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl py-3 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/10 cursor-pointer border-none"
          >
            {exporting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FileSpreadsheet className="w-4.5 h-4.5" />
                Ekspor Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Student Roster Import Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-black text-slate-850">Import Data Roster Siswa</h3>
          <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">
            Unggah berkas Excel berisi daftar data siswa baru untuk ditambahkan ke database.
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={handleDownloadTemplate}
              className="bg-slate-100 border border-slate-200 hover:bg-slate-200 text-cyan-600 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
            <label className="bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              Unggah File Excel
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleUploadRoster}
                className="hidden"
              />
            </label>
            <button
              onClick={handleImportSubmit}
              disabled={importing || parsedStudents.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border-none transition-colors"
            >
              {importing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Proses Unggah'
              )}
            </button>
          </div>

          {/* Roster Import Preview */}
          {fileName && (
            <div className="mt-2 text-xs border border-slate-200 rounded-2xl p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 truncate">Berkas: {fileName}</span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-600">
                  {parsedStudents.length} siswa ditemukan
                </span>
              </div>

              {/* Parsed List Preview */}
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
                {parsedStudents.map((st, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between text-xs gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800">{st.nama}</p>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">NIS: {st.nis} • Kelas: {st.kelas} • PKL: {st.tempat_pkl}</p>
                    </div>
                    <div>
                      {st.errors.length > 0 ? (
                        <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          {st.errors.join(', ')}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-0.5 rounded-md font-bold">
                          Valid
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Validation Detail Modal */}
      {selectedRecordId && activeRecord && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-lg">Detail Absensi Siswa</h3>
              <button
                onClick={() => setSelectedRecordId(null)}
                className="text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 p-1.5 rounded-full border-none cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Row */}
            <div className="space-y-3.5 text-sm mb-5">
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Siswa</span>
                <span className="font-black text-slate-800 text-right">{activeRecord.nama} ({activeRecord.kelas})</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Tanggal</span>
                <span className="font-extrabold text-slate-800 text-right">{formatDateLabel(activeRecord.dateKey)}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Masuk</span>
                <span className="font-extrabold text-slate-800 text-right">{activeRecord.masuk?.time || '-'}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Keluar</span>
                <span className="font-extrabold text-slate-800 text-right">{activeRecord.keluar?.time || '-'}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2 min-w-0">
                <span className="text-slate-500 font-medium flex-shrink-0">Lokasi Masuk</span>
                <span className="font-extrabold text-slate-800 text-right truncate pl-4">{activeRecord.masuk?.locationText || '-'}</span>
              </div>

              {/* Snapshot Photo Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => lightboxPhoto ? null : activeRecord.masuk?.photo && setLightboxPhoto({ src: activeRecord.masuk.photo, title: `Foto Masuk - ${activeRecord.nama}` })}
                  disabled={!activeRecord.masuk?.photo}
                  className="font-bold text-cyan-600 bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  Foto Masuk
                </button>
                <button
                  type="button"
                  onClick={() => lightboxPhoto ? null : activeRecord.keluar?.photo && setLightboxPhoto({ src: activeRecord.keluar.photo, title: `Foto Keluar - ${activeRecord.nama}` })}
                  disabled={!activeRecord.keluar?.photo}
                  className="font-bold text-cyan-600 bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  Foto Keluar
                </button>
              </div>

              {/* Audit Log Tracker */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Audit Trails</p>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                  {getRecordValidationAudit(activeRecord).length === 0 ? (
                    <p className="text-[11px] text-slate-400 font-semibold">Belum ada audit log validasi tercatat.</p>
                  ) : (
                    getRecordValidationAudit(activeRecord).map((log, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-[11px] leading-relaxed">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getStatusStyle(log.newStatus as any)}`}>
                            {log.newStatus}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {log.source === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <p className="text-slate-500 font-bold">{formatDateTime(log.validatedAt)}</p>
                        <p className="text-slate-700 font-extrabold mt-0.5">Divalidasi oleh: {log.adminName}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Validation Buttons Actions */}
            <div className="flex gap-4 border-t border-slate-100 pt-4 mt-6">
              <button
                onClick={() => handleValidateAction('Ditolak')}
                className="flex-1 bg-red-50 hover:bg-red-100/80 text-red-600 border border-red-250 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all cursor-pointer"
              >
                Tolak
              </button>
              <button
                onClick={() => handleValidateAction('Valid')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-600/10 active:scale-[0.98] transition-all cursor-pointer border-none"
              >
                Sahkan Valid
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Internal Photo Lightbox inside Admin */}
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
                alt="Full Snap"
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
