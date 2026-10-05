import { create } from 'zustand';
export interface CodePreferences {
  theme: 'vs-dark' | 'vs' | 'hc-black'; tabSize: number; lineNumbers: boolean;
  invisibles: boolean; indentGuides: boolean; softTabs: boolean;
  keyBinding: 'default' | 'vim' | 'emacs';
}
export const defaultCodePreferences: CodePreferences = { theme: 'vs-dark', tabSize: 2, lineNumbers: true, invisibles: false, indentGuides: true, softTabs: true, keyBinding: 'default' };
export function parseCodePreferences(value: unknown): CodePreferences {
  const p = (value && typeof value === 'object' ? value : {}) as Partial<CodePreferences>;
  return { ...defaultCodePreferences,
    theme: ['vs-dark', 'vs', 'hc-black'].includes(p.theme!) ? p.theme! : 'vs-dark',
    tabSize: [2, 4, 8].includes(p.tabSize!) ? p.tabSize! : 2,
    keyBinding: ['default', 'vim', 'emacs'].includes(p.keyBinding!) ? p.keyBinding! : 'default',
    ...Object.fromEntries(['lineNumbers', 'invisibles', 'indentGuides', 'softTabs'].filter(key => typeof p[key as keyof CodePreferences] === 'boolean').map(key => [key, p[key as keyof CodePreferences]])),
  };
}
function read(): CodePreferences { try { return parseCodePreferences(JSON.parse(localStorage.getItem('notch.code') || '{}')); } catch { return defaultCodePreferences; } }
export const useCodePreferences = create<{ preferences: CodePreferences; update: (updates: Partial<CodePreferences>) => void }>((set, get) => ({
  preferences: read(),
  update: updates => { const preferences = parseCodePreferences({ ...get().preferences, ...updates }); localStorage.setItem('notch.code', JSON.stringify(preferences)); set({ preferences }); },
}));
if (typeof window !== 'undefined') window.addEventListener('storage', event => { if (event.key === 'notch.code') useCodePreferences.setState({ preferences: read() }); });
