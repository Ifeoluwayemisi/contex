import React, { useState } from 'react';
import { 
  Folder, 
  FolderPlus, 
  Sparkles, 
  Layers, 
  Edit2, 
  Trash2, 
  Plus, 
  Check, 
  X,
  FileText
} from 'lucide-react';
import { SmartCollection, DocumentRecord } from '../types';

interface SmartCollectionsViewProps {
  collections: SmartCollection[];
  documents: DocumentRecord[];
  selectedCollection: string | null;
  onSelectCollection: (name: string | null) => void;
  onCreateCollection: (name: string) => void;
  onRenameCollection: (oldName: string, newName: string) => void;
  onDeleteCollection: (name: string) => void;
}

export const SmartCollectionsView: React.FC<SmartCollectionsViewProps> = ({
  collections,
  documents,
  selectedCollection,
  onSelectCollection,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
}) => {
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName.trim());
      setNewCollectionName('');
      setIsCreating(false);
    }
  };

  const handleStartRename = (name: string) => {
    setEditingName(name);
    setEditValue(name);
  };

  const handleSaveRename = (oldName: string) => {
    if (editValue.trim() && editValue.trim() !== oldName) {
      onRenameCollection(oldName, editValue.trim());
    }
    setEditingName(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
        <div>
          <h2 className="font-serif text-lg font-bold text-stone-900">
            Smart Collections
          </h2>
          <p className="text-xs text-stone-500">
            Automated suggestions and custom collections without manual folder overhead.
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Collection</span>
          </button>
        )}
      </div>

      {/* Create Collection Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Collection name (e.g. 'Frontend Architecture', 'Finance')..."
            className="flex-1 px-3 py-1.5 border border-stone-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-stone-800"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="p-1.5 text-stone-400 hover:text-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Collections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {collections.map((col) => {
          const isSelected = selectedCollection === col.name;
          const isEditing = editingName === col.name;

          return (
            <div
              key={col.id}
              onClick={() => onSelectCollection(isSelected ? null : col.name)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-2xs text-stone-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`p-1.5 rounded-lg ${isSelected ? 'bg-stone-800 text-amber-300' : 'bg-stone-100 text-stone-600'}`}>
                      <Folder className="w-4 h-4" />
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="px-2 py-0.5 text-xs text-stone-900 rounded bg-white border border-stone-300"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(col.name)}
                          className="p-1 text-emerald-600 hover:bg-stone-100 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="font-semibold text-xs sm:text-sm truncate">
                        {col.name}
                      </h3>
                    )}
                  </div>

                  {col.isAutoSuggested && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                      isSelected ? 'bg-stone-800 text-amber-200' : 'bg-amber-50 text-amber-900 border border-amber-200'
                    }`}>
                      <Sparkles className="w-2.5 h-2.5" />
                      Suggested
                    </span>
                  )}
                </div>

                {col.sampleTopics.length > 0 && (
                  <p className={`text-[11px] mt-2 line-clamp-1 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                    Topics: {col.sampleTopics.join(', ')}
                  </p>
                )}
              </div>

              <div className={`pt-2 border-t flex items-center justify-between text-xs ${
                isSelected ? 'border-stone-800 text-stone-300' : 'border-stone-100 text-stone-500'
              }`}>
                <span>{col.documentCount} {col.documentCount === 1 ? 'document' : 'documents'}</span>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleStartRename(col.name)}
                    className="p-1 hover:text-stone-900 rounded"
                    title="Rename collection"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteCollection(col.name)}
                    className="p-1 hover:text-rose-600 rounded"
                    title="Delete collection"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
