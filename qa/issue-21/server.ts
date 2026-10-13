// bun qa/issue-21/server.ts; open http://127.0.0.1:1457 and Run regression.
const result = await Bun.build({
  entrypoints: [new URL('./editor.tsx', import.meta.url).pathname],
  outdir: '/private/tmp/notch-issue-21', target: 'browser', minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
if (!result.success) throw new Error(result.logs.join('\n'));
Bun.serve({ hostname: '127.0.0.1', port: 1457, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === '/editor.js' || path === '/editor.css') return new Response(Bun.file('/private/tmp/notch-issue-21' + path));
  return new Response('<!doctype html><title>Notch issue 21 regression</title><link rel="stylesheet" href="/editor.css"><div id="root"></div><script type="module" src="/editor.js"></script>', { headers: { 'Content-Type': 'text/html' } });
}});
console.log('Ready at http://127.0.0.1:1457');
