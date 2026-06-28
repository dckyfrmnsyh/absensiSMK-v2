# Absensi SMK v2

Aplikasi absensi berbasis web dan PWA untuk mendukung kegiatan PKL/Prakerin siswa SMKN 1 Tana Tidung. Aplikasi ini memungkinkan siswa melakukan absensi masuk dan keluar dengan foto, lokasi, serta sinkronisasi data secara online maupun offline.

## Fitur Utama

- Login untuk siswa dan admin
- Absensi masuk/keluar dengan foto dan lokasi GPS
- Riwayat absensi harian dan status validasi
- Halaman profil siswa untuk mengubah data diri
- Panel admin untuk:
  - meninjau data absensi
  - memvalidasi atau menolak absensi
  - ekspor data ke Excel
  - impor data siswa dari file Excel
- Dukungan PWA untuk instalasi di perangkat mobile dan penggunaan offline
- Antrian sinkronisasi data saat koneksi terputus

## Teknologi yang Digunakan

- React + TypeScript
- Vite
- Express.js
- Supabase
- Tailwind CSS
- PWA support dengan service worker
- ExcelJS untuk ekspor/import data

## Prasyarat

- Node.js 18+ 
- npm

## Cara Menjalankan Secara Lokal

1. Install dependency:
   ```bash
   npm install
   ```

2. Buat file environment lokal:
   ```bash
   cp .env.example .env.local
   ```
   Jika file .env.example belum tersedia, cukup buat file .env.local secara manual.

3. Atur variabel environment yang dibutuhkan, misalnya:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Jalankan aplikasi:
   ```bash
   npm run dev
   ```

5. Buka aplikasi di browser:
   ```text
   http://localhost:3000
   ```

## Build untuk Production

```bash
npm run build
npm start
```

## Struktur Proyek

- src/components: komponen UI utama seperti home, admin, profil, dan login
- src/lib: konfigurasi database dan integrasi Supabase
- server.ts: server Express untuk menjalankan aplikasi
- public: aset PWA seperti manifest dan service worker

## Catatan

Aplikasi ini dirancang untuk mendukung absensi PKL dengan pengalaman yang sederhana, cepat, dan dapat diakses dari perangkat mobile maupun desktop.
