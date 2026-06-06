import type { Extension } from '@codemirror/state';
import { vim } from '@replit/codemirror-vim';
import { emacs } from '@replit/codemirror-emacs';
import type { EditorKeymapMode } from '../../../types';

// Resolve the user's chosen keybinding mode to the matching CodeMirror
// extension. `emacs` includes the mark/region + kill-ring machinery (C-Space,
// C-w, M-w, C-y, …); `vim` provides modal editing with Ex commands.
export function keymapModeExtension(mode: EditorKeymapMode): Extension {
  switch (mode) {
    case 'vim':
      return vim();
    case 'emacs':
      return emacs();
    default:
      return [];
  }
}
