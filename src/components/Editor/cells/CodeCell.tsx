import { useMemo } from 'react';
import CmEditor from '../cm/CmEditor';
import { languageExtension } from '../cm/languages';

interface CodeCellProps {
  data: string;
  language: string;
  onChange: (data: string) => void;
  onLanguageChange: (language: string) => void;
  onFocus: () => void;
  isFocused?: boolean;
  onBackspaceEmpty?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
}

export default function CodeCell({
  data,
  language,
  onChange,
  onFocus,
  isFocused,
  onBackspaceEmpty,
  onNavigatePrev,
  onNavigateNext,
}: CodeCellProps) {
  const languageExt = useMemo(() => languageExtension(language), [language]);

  return (
    <div className="cm-code-cell">
      <CmEditor
        value={data}
        onChange={onChange}
        onFocus={onFocus}
        isFocused={isFocused}
        language={languageExt}
        showLineNumbers
        maxHeight="500px"
        onBackspaceEmpty={onBackspaceEmpty}
        onNavigatePrev={onNavigatePrev}
        onNavigateNext={onNavigateNext}
      />
    </div>
  );
}
