import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, ShieldAlert } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'SUBMITTER':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'APPROVER':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'FINANCE_ADMIN':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo/Branding */}
        <div className="flex items-center space-x-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20">
            <span className="text-lg font-black text-white">IP</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">PayTrack</h1>
            <p className="text-[10px] text-slate-400">Enterprise Invoice Management</p>
          </div>
        </div>

        {/* User Stats & Logout */}
        {user && (
          <div className="flex items-center space-x-4">
            <div className="hidden items-center space-x-3 md:flex">
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{user.username}</p>
                <p className="text-[11px] text-slate-400">{user.email}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getRoleBadgeColor(user.role)}`}>
                {user.role.replace('_', ' ')}
              </span>
            </div>
            
            <div className="h-6 w-[1px] bg-slate-800 hidden md:block"></div>

            <button
              onClick={logout}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 focus:outline-none"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
