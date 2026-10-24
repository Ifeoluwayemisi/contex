import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Sparkles, 
  ArrowRight, 
  Brain, 
  SlidersHorizontal, 
  Check, 
  Calendar, 
  FileText,
  Tag
} from 'lucide-react';
import { SearchRefinements } from '../types';

interface SearchBarProps {
  onSearch: (query: string, recallMode?: boolean, refinements?: SearchRefinements) => void;
  isLoading: boolean;
  activeQuery: string;
  onClear: () => void;
  hasDocs: boolean;
  isRecallMode: boolean;
  onToggleRecallMode: (enabled: boolean) => void;
  refinements?: SearchRefinements;
  onUpdateRefinements?: (refinements: SearchRefinements) => void;
}

const EXAMPLE_QUERIES = [
  "I remember a document about a business acquisition campaign with campus outreach",
  "Which document mentions environment variables and deployment?",
  "Find research notes about machine learning and model evaluation",
  "I saved something with a budget section and financial planning but forgot the filename",
  "PostgreSQL replication runbook with failover steps"
];

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  activeQuery,
  onClear,
  hasDocs,
  isRecallMode,
  onToggleRecallMode,
  refinements = {},
  onUpdateRefinements
}) => {
  const [inputVal, setInputVal] = useState(activeQuery);
  const [showRefinements, setShowRefinements] = useState(false);
  const [mustIncludeInput, setMustIncludeInput] = useState(refinements.mustInclude?.join(', ') || '');
  const [docTypeHint, setDocTypeHint] = useState(refinements.docTypeHint || '');
  const [timeHint, setTimeHint] = useState(refinements.timeHint || '');

  useEffect(() => {
    setInputVal(activeQuery);
  }, [activeQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      const activeRef: SearchRefinements = {
        mustInclude: mustIncludeInput ? mustIncludeInput.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        docTypeHint: docTypeHint || undefined,
        timeHint: timeHint || undefined
      };
      if (onUpdateRefinements) onUpdateRefinements(activeRef);
      onSearch(inputVal.trim(), isRecallMode, activeRef);
    }
  };

  const handleChipClick = (query: string) => {
    setInputVal(query);
    onSearch(query, isRecallMode, refinements);
  };

  const handleClearClick = () => {
    setInputVal('');
    onClear();
  };

  const hasActiveRefinements = !!(
    (refinements.mustInclude && refinements.mustInclude.length > 0) ||
    refinements.docTypeHint ||
    refinements.timeHint
  );

  return (
    <div className="w-full space-y-3">
      {/* Top Recall Mode Mode Switch */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleRecallMode(!isRecallMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              isRecallMode
                ? 'bg-amber-100/80 text-amber-900 border-amber-300 shadow-2xs'
                : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200/70'
            }`}
            title="Recall Mode lets you describe imperfect memories and vague recollection clues in ordinary language."
          >
            <Brain className={`w-3.5 h-3.5 ${isRecallMode ? 'text-amber-700' : 'text-stone-400'}`} />
            <span>Recall Mode: {isRecallMode ? 'Active' : 'Off'}</span>
          </button>

          <span className="text-[11px] text-stone-400 hidden sm:inline">
            {isRecallMode 
              ? 'Describes what you remember without needing exact filenames or phrases.' 
              : 'Direct keyword search mode.'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowRefinements(!showRefinements)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
            hasActiveRefinements || showRefinements
              ? 'bg-stone-900 text-white border-stone-900'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Refine Clues</span>
          {hasActiveRefinements && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          )}
        </button>
      </div>

      {/* Main Search Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-4 pointer-events-none text-stone-400">
            <Search className={`w-5 h-5 ${isLoading ? 'animate-pulse text-amber-600' : ''}`} />
          </div>

          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              isRecallMode
                ? "Describe what you remember (e.g. 'document about business acquisition campaign with campus outreach and possibly a budget')..."
                : "Search keywords, filenames, or topics..."
            }
            className="w-full pl-12 pr-28 py-3.5 bg-white border border-stone-300/80 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-800 text-sm md:text-base shadow-xs transition-all"
            disabled={isLoading}
          />

          <div className="absolute right-2.5 flex items-center gap-1.5">
            {inputVal && (
              <button
                type="button"
                onClick={handleClearClick}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !inputVal.trim() || !hasDocs}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-2xs"
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Recalling...</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Optional Lightweight Clue Refinements Drawer */}
      {showRefinements && (
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-stone-700 font-medium">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-stone-600" />
              Optional Memory Anchors & Refinements
            </span>
            <button
              type="button"
              onClick={() => {
                setMustIncludeInput('');
                setDocTypeHint('');
                setTimeHint('');
                if (onUpdateRefinements) onUpdateRefinements({});
              }}
              className="text-[11px] text-stone-400 hover:text-stone-600 underline"
            >
              Reset filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-stone-500 mb-1 font-medium">
                Must mention word:
              </label>
              <input
                type="text"
                value={mustIncludeInput}
                onChange={(e) => setMustIncludeInput(e.target.value)}
                placeholder="e.g. outreach, budget"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-900 placeholder-stone-400 text-xs focus:outline-none focus:border-stone-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 mb-1 font-medium">
                Document type hint:
              </label>
              <select
                value={docTypeHint}
                onChange={(e) => setDocTypeHint(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-900 text-xs focus:outline-none focus:border-stone-500"
              >
                <option value="">Any format</option>
                <option value="PDF">PDF / Slides</option>
                <option value="Tutorial">Tutorial / Guide</option>
                <option value="Specification">Project Spec / Planning</option>
                <option value="Notes">Meeting Notes</option>
                <option value="Reference">Reference / Cheat Sheet</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 mb-1 font-medium">
                Time period hint:
              </label>
              <input
                type="text"
                value={timeHint}
                onChange={(e) => setTimeHint(e.target.value)}
                placeholder="e.g. 2026, Q3, October"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-900 placeholder-stone-400 text-xs focus:outline-none focus:border-stone-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Suggested Natural Language Queries from PRD */}
      <div className="flex items-center flex-wrap gap-1.5 text-xs text-stone-500 pt-0.5">
        <span className="font-medium text-stone-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-600" />
          Try recalling:
        </span>
        {EXAMPLE_QUERIES.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleChipClick(q)}
            disabled={isLoading || !hasDocs}
            className="px-2.5 py-1 rounded-full bg-stone-100/90 hover:bg-stone-200/80 text-stone-700 hover:text-stone-900 transition-colors border border-stone-200/60 disabled:opacity-50 text-[11px] sm:text-xs"
          >
            "{q}"
          </button>
        ))}
      </div>
    </div>
  );
};
