import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserSearchHistory, UserSavedSearch } from '../types';
import { getAuthToken } from '../lib/api';

interface SearchHistoryViewProps {
  onSelectQuery: (query: string) => void;
}

export const SearchHistoryView: React.FC<SearchHistoryViewProps> = ({ onSelectQuery }) => {
  const { user, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const [history, setHistory] = useState<UserSearchHistory[]>([]);
  const [savedSearches, setSavedSearches] = useState<UserSavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<UserSearchHistory | null>(null);
  const [saveLabel, setSaveLabel] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchHistoryAndSaved = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const [histRes, savedRes] = await Promise.all([
        fetch('/api/history', { headers }),
        fetch('/api/saved-searches', { headers })
      ]);

      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.history || []);
      }
      if (savedRes.ok) {
        const savedData = await savedRes.json();
        setSavedSearches(savedData.savedSearches || []);
      }
    } catch (err: any) {
      setError('Failed to load search history. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistoryAndSaved();
    }
  }, [user]);

  const handleDeleteHistory = async (id: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/history/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your entire search history?')) return;
    try {
      const token = getAuthToken();
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        setHistory([]);
      }
    } catch (err) {
      console.error('Failed to clear search history:', err);
    }
  };

  const handleOpenSaveModal = (item: UserSearchHistory) => {
    setSelectedHistoryItem(item);
    setSaveLabel(item.query);
    setSaveNotes('');
    setSaveModalOpen(true);
  };

  const handleSaveSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHistoryItem) return;
    setIsSaving(true);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          query: selectedHistoryItem.query,
          label: saveLabel.trim() || selectedHistoryItem.query,
          notes: saveNotes.trim(),
          filters: selectedHistoryItem.filters
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSavedSearches((prev) => [data.savedSearch, ...prev]);
        setSaveModalOpen(false);
        setSelectedHistoryItem(null);
      }
    } catch (err) {
      console.error('Failed to save search:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedSearch = async (id: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/saved-searches/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        setSavedSearches((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete saved search:', err);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="bg-amber-50/50 dark:bg-stone-900 border border-amber-200/70 dark:border-stone-800 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
            Protected Search History
          </h2>
          <p className="text-stone-600 dark:text-stone-400 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
            Personal search recollections and saved query probes are private to your user profile.
            Sign in or create an account to securely access past natural-language searches across sessions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={() => openAuthModal('signin')}
              className="px-5 py-2.5 rounded-xl font-medium text-sm bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white shadow transition"
            >
              Sign In to Your Account
            </button>
            <button
              onClick={() => openAuthModal('signup')}
              className="px-5 py-2.5 rounded-xl font-medium text-sm bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 transition"
            >
              Create Free Account
            </button>
          </div>
          <p className="mt-6 text-xs text-stone-500 dark:text-stone-500">
            Note: Your document files remain stored locally on your device. Authenticating protects your personal query records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
            Personal Search History
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">
            Past natural-language recollections and saved search probes for <span className="font-semibold text-stone-800 dark:text-stone-200">{user.email}</span>
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-stone-200/70 dark:bg-stone-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'recent'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            Recent Recollections ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'saved'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            Saved Searches ({savedSearches.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-stone-500 dark:text-stone-400">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-stone-400 border-t-amber-600 rounded-full mb-2"></div>
          <p className="text-sm">Loading your private search records...</p>
        </div>
      ) : activeTab === 'recent' ? (
        /* Recent Searches */
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400">
              Activity History
            </span>
            {history.length > 0 && (
              <button
                onClick={handleClearAllHistory}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition"
              >
                Clear All History
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="bg-stone-50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
              <svg className="w-10 h-10 mx-auto text-stone-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-base font-semibold text-stone-800 dark:text-stone-200 mb-1">
                No search history yet
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                When you search your document library using natural language, your queries and matched result counts will be securely tracked here for quick re-use.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-stone-900 dark:text-stone-100 text-sm truncate">
                        "{item.query}"
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                        {item.resultsCount} {item.resultsCount === 1 ? 'match' : 'matches'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                      <span>{new Date(item.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      {item.filters?.fileType && <span>Type: {item.filters.fileType}</span>}
                      {item.filters?.topic && <span>Topic: {item.filters.topic}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => onSelectQuery(item.query)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-1.5 shadow-xs"
                      title="Run this search query again"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Run Search
                    </button>
                    <button
                      onClick={() => handleOpenSaveModal(item)}
                      className="p-1.5 rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                      title="Save this search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteHistory(item.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      title="Delete from history"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Saved Searches */
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400">
              Bookmarked Queries
            </span>
          </div>

          {savedSearches.length === 0 ? (
            <div className="bg-stone-50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
              <svg className="w-10 h-10 mx-auto text-stone-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <h3 className="text-base font-semibold text-stone-800 dark:text-stone-200 mb-1">
                No saved searches yet
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                Save your most frequent or complex natural-language queries from the Recent Recollections tab to quickly repeat them anytime.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSearches.map((saved) => (
                <div
                  key={saved.id}
                  className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                        {saved.label}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-300 font-mono bg-stone-100 dark:bg-stone-800/80 px-2 py-1 rounded inline-block mb-1">
                      "{saved.query}"
                    </p>
                    {saved.notes && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 italic">
                        {saved.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => onSelectQuery(saved.query)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-1.5 shadow-xs"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Run Search
                    </button>
                    <button
                      onClick={() => handleDeleteSavedSearch(saved.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      title="Delete saved search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
              Save Search Query
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
              Bookmark this natural-language recollection for fast one-click re-execution.
            </p>

            <form onSubmit={handleSaveSearch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="e.g., Useful for quarterly reports or budget checks"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
                >
                  {isSaving ? 'Saving...' : 'Save Query'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
