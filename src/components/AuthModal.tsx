import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { authModal, closeAuthModal, login, signup } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (authModal.defaultTab) {
      setTab(authModal.defaultTab);
    }
    setError(null);
  }, [authModal.isOpen, authModal.defaultTab]);

  if (!authModal.isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 'login') {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password, name.trim());
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-stone-200 bg-stone-50/70 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-serif font-bold text-stone-900">
              {tab === 'login' ? 'Sign In to ContextKeeper' : 'Create ContextKeeper Account'}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {authModal.reason || 'Access your protected search history and saved queries.'}
            </p>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-stone-200 px-6 pt-2 bg-stone-50/30 gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
              tab === 'login'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(null); }}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
              tab === 'signup'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'signup' && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-stone-700">
                Your Name (optional)
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Chen"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 text-xs focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-800 transition-all disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-stone-700">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                disabled={isSubmitting}
                className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 text-xs focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-800 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-stone-700">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={isSubmitting}
                className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 text-xs focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-800 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 disabled:bg-stone-300 transition-colors shadow-xs cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                <span>{tab === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{tab === 'login' ? 'Sign In' : 'Create Free Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Privacy & Storage Transparency Note */}
          <div className="pt-3 border-t border-stone-200/80 text-[11px] text-stone-500 space-y-1">
            <div className="flex items-center gap-1.5 text-stone-600 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Local-First Document Safety</span>
            </div>
            <p className="leading-relaxed">
              Your indexed document files and folder handles remain strictly stored in your local browser and device. Only search history and account preferences are synchronized.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
