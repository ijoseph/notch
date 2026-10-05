import { loader } from '@monaco-editor/react';

// Served by the dev server and copied into every release. No CDN is required
// for a first launch, including Monaco's language workers and CSS.
loader.config({ paths: { vs: new URL('/monaco/vs', window.location.href).href } });

// Load keyboard extensions through the same AMD runtime as the editor. This
// avoids shipping a second Monaco instance (and keeps first-load work lazy).
let configured = false;
export async function loadKeyBinding(name: 'vim' | 'emacs'): Promise<any> {
  const monaco = await loader.init();
  const runtime = window as any;
  if (!configured) {
    runtime.define('monaco-editor/esm/vs/editor/editor.api', [], () => monaco);
    runtime.require.config({ paths: { 'notch-vim': '/bindings/vim', 'notch-emacs': '/bindings/emacs' } });
    configured = true;
  }
  return new Promise((resolve, reject) => runtime.require([`notch-${name}`], resolve, reject));
}
