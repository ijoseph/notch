import { LanguageSupport, LanguageDescription, StreamLanguage } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { markdown } from '@codemirror/lang-markdown';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { go } from '@codemirror/legacy-modes/mode/go';
import { swift } from '@codemirror/legacy-modes/mode/swift';

const stream = (mode: Parameters<typeof StreamLanguage.define>[0]) =>
  new LanguageSupport(StreamLanguage.define(mode));

// Resolve one of our language identifiers (and common aliases) to a CodeMirror
// language extension. Returns null for unknown languages (rendered as plain text).
export function languageExtension(lang: string): Extension | null {
  switch (lang.toLowerCase()) {
    case 'javascript':
    case 'js':
      return javascript();
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'ts':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'python':
    case 'py':
      return python();
    case 'rust':
    case 'rs':
      return rust();
    case 'c':
    case 'cpp':
    case 'c++':
      return cpp();
    case 'java':
      return java();
    case 'php':
      return php();
    case 'sql':
      return sql();
    case 'html':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'yaml':
    case 'yml':
      return yaml();
    case 'xml':
      return xml();
    case 'markdown':
    case 'md':
      return markdown({ codeLanguages: markdownCodeLanguages });
    case 'shell':
    case 'bash':
    case 'sh':
    case 'zsh':
      return stream(shell);
    case 'ruby':
    case 'rb':
      return stream(ruby);
    case 'go':
      return stream(go);
    case 'swift':
      return stream(swift);
    default:
      return null;
  }
}

// Language descriptions used to highlight fenced code blocks *inside* markdown
// cells, so e.g. ```sh blocks get full shell highlighting.
export const markdownCodeLanguages: LanguageDescription[] = [
  LanguageDescription.of({ name: 'javascript', alias: ['js', 'jsx'], support: javascript({ jsx: true }) }),
  LanguageDescription.of({ name: 'typescript', alias: ['ts', 'tsx'], support: javascript({ jsx: true, typescript: true }) }),
  LanguageDescription.of({ name: 'python', alias: ['py'], support: python() }),
  LanguageDescription.of({ name: 'rust', alias: ['rs'], support: rust() }),
  LanguageDescription.of({ name: 'cpp', alias: ['c', 'c++'], support: cpp() }),
  LanguageDescription.of({ name: 'java', support: java() }),
  LanguageDescription.of({ name: 'php', support: php() }),
  LanguageDescription.of({ name: 'sql', support: sql() }),
  LanguageDescription.of({ name: 'html', support: html() }),
  LanguageDescription.of({ name: 'css', support: css() }),
  LanguageDescription.of({ name: 'json', support: json() }),
  LanguageDescription.of({ name: 'yaml', alias: ['yml'], support: yaml() }),
  LanguageDescription.of({ name: 'xml', support: xml() }),
  LanguageDescription.of({ name: 'shell', alias: ['bash', 'sh', 'zsh'], support: stream(shell) }),
  LanguageDescription.of({ name: 'ruby', alias: ['rb'], support: stream(ruby) }),
  LanguageDescription.of({ name: 'go', support: stream(go) }),
  LanguageDescription.of({ name: 'swift', support: stream(swift) }),
];

// Markdown language support (with nested fenced-code highlighting) for md cells.
export function markdownExtension(): Extension {
  return markdown({ codeLanguages: markdownCodeLanguages });
}
