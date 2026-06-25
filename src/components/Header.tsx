import React from 'react';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  onLogout: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  return (
    <header className="bg-white px-4 py-3.5 flex items-center justify-between border-b border-slate-150 z-20 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white border border-slate-200/80 rounded-xl overflow-hidden flex justify-center items-center shadow-sm p-0.5">
          <img 
            src="/logo.png" 
            alt="Logo SMK" 
            className="w-full h-full object-contain" 
            referrerPolicy="no-referrer" 
          />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-800 leading-tight">SMK Negeri 1 Tana Tidung</h2>
          <p className="text-[11px] font-bold text-slate-400">Sistem Absensi PKL</p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 border-none bg-transparent cursor-pointer"
        title="Keluar dari Aplikasi"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </header>
  );
}
