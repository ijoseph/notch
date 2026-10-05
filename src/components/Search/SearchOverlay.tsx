import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { searchNoteSummaries, type SearchSummary } from '../../services/search';
import { searchExcerpt } from '../../utils/searchExcerpt';
import './SearchOverlay.css';

interface SearchOverlayProps {
  onClose: () => void;
}

export default function SearchOverlay({ onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchSummary[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const keyboardSelection = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const notebooks = useStore(state => state.notebooks);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let current = true;
    if (!query.trim()) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      void searchNoteSummaries(query, { limit: 51, offset: page * 50 }).then(notes => {
        if (!current) return;
        setResults(notes.slice(0, 50));
        setHasMore(notes.length > 50);
        setSelectedIndex(0);
        setLoading(false);
      }).catch(() => {
        if (!current) return;
        setError('Unable to search notes. Please try again.');
        setLoading(false);
      });
    }, 150);
    return () => { current = false; clearTimeout(timer); };
  }, [query, page]);

  const clearResults = () => {
    setResults([]); setSelectedIndex(0); setHasMore(false); setError('');
  };
  const handleSearch = (q: string) => {
    clearResults(); setLoading(!!q.trim()); setPage(0); setQuery(q);
  };
  const changePage = (next: number) => {
    clearResults(); setLoading(true); setPage(next);
  };
  // Hover/keyboard selection should not rescan every result's cell bodies.
  const excerpts = useMemo(() => results.map(note => searchExcerpt([{ type: 'code', data: note.excerpt }], query)), [results, query]);

  const navigateToNote = useCallback((note: SearchSummary) => {
    const state = useStore.getState();
    void state.selectNote(note.id, true);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (keyboardSelection.current) {
      resultRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
      keyboardSelection.current = false;
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      keyboardSelection.current = true;
      e.preventDefault();
      setSelectedIndex(i => Math.max(0, Math.min(i + 1, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      keyboardSelection.current = true;
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigateToNote(results[selectedIndex]);
    }
  };

  const getNotebookName = (notebookId: string) => {
    return notebooks.find(n => n.id === notebookId)?.name || '';
  };

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search all notes"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={results[selectedIndex] ? `search-result-${selectedIndex}` : undefined}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="search-input"
            placeholder="Search all notes..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="search-kbd">esc</kbd>
        </div>
        {results.length > 0 && (
          <div className="search-results" id="search-results" role="listbox" aria-label="Matching notes">
            {results.map((note, index) => (
              <div
                key={note.id}
                id={`search-result-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                ref={element => { resultRefs.current[index] = element; }}
                className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => navigateToNote(note)}
                onMouseEnter={() => { keyboardSelection.current = false; setSelectedIndex(index); }}
              >
                <div className="search-result-title">{note.title}</div>
                <div className="search-result-meta">
                  <span className="search-result-notebook">{getNotebookName(note.notebookId)}</span>
                  <span className="search-result-preview">
                    {excerpts[index].map((part, partIndex) => part.matched
                      ? <mark key={partIndex}>{part.text}</mark>
                      : part.text)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {loading && <div className="search-no-results" role="status">Searching…</div>}
        {error && <div className="search-no-results" role="alert">{error}</div>}
        {!loading && !error && query.trim() && results.length === 0 && (
          <div className="search-no-results">No results found</div>
        )}
        {(page > 0 || hasMore) && <div className="search-pagination">
          <button disabled={page === 0 || loading} onClick={() => changePage(page - 1)}>Previous</button>
          <span>Page {page + 1}</span>
          <button disabled={!hasMore || loading} onClick={() => changePage(page + 1)}>Next</button>
        </div>}
      </div>
    </div>
  );
}
