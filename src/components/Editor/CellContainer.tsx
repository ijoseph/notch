import { memo } from 'react';
import { useStore } from '../../store';
import type { Cell } from '../../types';
import TextCell from './cells/TextCell';
import CodeCell from './cells/CodeCell';
import MarkdownCell from './cells/MarkdownCell';
import LatexCell from './cells/LatexCell';
import DiagramCell from './cells/DiagramCell';

interface CellContainerProps {
  noteId: string;
  cell: Cell;
  isFocused: boolean;
  canDelete: boolean;
  // Stable, id-keyed handlers so this component can be memoized.
  onFocus: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigatePrev: (id: string) => void;
  onNavigateNext: (id: string) => void;
}

function CellContainer({
  noteId,
  cell,
  isFocused,
  canDelete,
  onFocus,
  onDelete,
  onNavigatePrev,
  onNavigateNext,
}: CellContainerProps) {
  const updateCell = useStore(state => state.updateCell);

  const handleDataChange = (data: string) => {
    updateCell(noteId, cell.id, { data });
  };

  const handleLanguageChange = (language: string) => {
    updateCell(noteId, cell.id, { language });
  };

  const handleDiagramTypeChange = (diagramType: 'sequence' | 'flow') => {
    updateCell(noteId, cell.id, { diagramType });
  };

  const handleFocus = () => onFocus(cell.id);

  const handleBackspaceEmpty = () => {
    if (canDelete && !cell.data.trim()) {
      onDelete(cell.id);
    }
  };

  const renderCell = () => {
    const commonProps = {
      data: cell.data,
      onChange: handleDataChange,
      onFocus: handleFocus,
      isFocused,
      onBackspaceEmpty: handleBackspaceEmpty,
      onNavigatePrev: () => onNavigatePrev(cell.id),
      onNavigateNext: () => onNavigateNext(cell.id),
    };

    switch (cell.type) {
      case 'text':
        return <TextCell {...commonProps} />;
      case 'code':
        return (
          <CodeCell
            {...commonProps}
            language={cell.language || 'javascript'}
            onLanguageChange={handleLanguageChange}
          />
        );
      case 'markdown':
        return <MarkdownCell {...commonProps} />;
      case 'latex':
        return <LatexCell {...commonProps} />;
      case 'diagram':
        return (
          <DiagramCell
            {...commonProps}
            diagramType={cell.diagramType || 'flow'}
            onDiagramTypeChange={handleDiagramTypeChange}
          />
        );
      default:
        return <TextCell {...commonProps} />;
    }
  };

  return (
    <div
      className={`cell cell-${cell.type} ${isFocused ? 'focused' : ''}`}
      onClick={handleFocus}
    >
      <div className="cell-content">{renderCell()}</div>
    </div>
  );
}

// Memoized so a store update (e.g. the debounced flush of the cell being edited)
// re-renders only the changed cell, not every cell in the note.
export default memo(CellContainer);
