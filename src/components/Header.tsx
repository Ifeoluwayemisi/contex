import React, { useState } from 'react';
import { 
  Upload, 
  BookOpen, 
  Trash2,
  User,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { ModelInfo } from '../types';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  modelInfo: ModelInfo | null;
  onOpenUpload: () => void;
  onOpenModelInfo: () => void;
  onClearLibrary: () => void;
  totalDocs: number;
}

export const Header: React.FC<HeaderProps> = ({
  modelInfo,
  onOpenUpload,
  onOpenModelInfo,
  onClearLibrary,
  totalDocs
}) => {
  const { user, logout, openAuthModal } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="border-b border-stone-200 bg-[#fdfdfc]/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Wordmark and Tagline */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-stone-900 text-stone-100 flex items-center justify-center shadow-xs shrink-0">
            <BookOpen className="w-5 h-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold tracking-tight text-stone-900">
                ContextKeeper
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100/70 text-amber-900 border border-amber-300/60">
                Recall Mode
              </span>
            </div>
            <p className="text-xs text-stone-500 truncate hidden sm:block">
              Your files remember, so you don't have to.
            </p>
          </div>
        </div>

        {/* Center / Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Gemma Model Status Badge */}
          <button
            onClick={onOpenModelInfo}
            title="Click to view Gemma model diagnostics and privacy info"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-colors shadow-2xs"
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  modelInfo?.status === 'available' ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  modelInfo?.status === 'available' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
              </span>
              <span className="font-medium hidden sm:inline">Gemma 4 26B</span>
              <span className="text-[10px] uppercase font-mono px-1 py-0.2 bg-stone-100 rounded text-stone-600">
                Runtime
              </span>
            </div>
          </button>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Files</span>
          </button>

          {/* User Account / Auth Button */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs text-stone-800 hover:bg-stone-50 transition shadow-2xs"
              >
                <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px]">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[100px] truncate hidden sm:inline font-medium">{user.email}</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-xl shadow-lg py-2 z-50 text-xs">
                    <div className="px-3 py-2 border-b border-stone-100">
                      <p className="text-stone-500 text-[11px]">Signed in as</p>
                      <p className="font-semibold text-stone-900 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('signin')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg transition-colors"
            >
              <User className="w-3.5 h-3.5 text-stone-600" />
              <span>Sign In</span>
            </button>
          )}

          {/* Clear Library if documents exist */}
          {totalDocs > 0 && (
            <button
              onClick={onClearLibrary}
              title="Clear stored local library"
              className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
