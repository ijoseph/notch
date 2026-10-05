import { useState, useRef, useEffect, useMemo } from 'react';
import type { Note } from '../../types';
import { noteMatches, revealMatch, clearFind } from '../../services/noteFind';
import { useStore } from '../../store';

interface FindBarProps {
  note: Note;
  onClose: () => void;
}

export default function FindBar({ note, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const mode = useStore(state => state.editorViewMode);
  const matches = useMemo(() => noteMatches(note, query), [note, query]);
  const selected = Math.min(currentMatch, Math.max(0, matches.length - 1));
  useEffect(() => { setCurrentMatch(0); }, [query, note.id]);
  useEffect(() => {
    if (mode === 'preview') { useStore.getState().setEditorViewMode('split'); return; }
    const match = matches[selected];
    if (!match) { clearFind(); return; }
    return revealMatch(match);
  }, [matches, selected, mode]);
  const matchCount = matches.length;
  const handleNext = () => setCurrentMatch(index => matches.length ? (index + 1) % matches.length : 0);
  const handlePrev = () => setCurrentMatch(index => matches.length ? (index + matches.length - 1) % matches.length : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  return (
    <div className="find-bar">
      <div className="find-bar-input-wrapper">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          autoCorrect="off" autoCapitalize="off" spellCheck={false}
          className="find-bar-input"
          placeholder="Find in note..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <span className="find-bar-count">
            {matchCount > 0 ? `${selected + 1} of ${matchCount}` : 'No results'}
          </span>
        )}
      </div>
      <button className="find-bar-btn" onClick={handlePrev} disabled={matchCount === 0} title="Previous (Shift+Enter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
      <button className="find-bar-btn" onClick={handleNext} disabled={matchCount === 0} title="Next (Enter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <button className="find-bar-btn" onClick={onClose} title="Close (Esc)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
