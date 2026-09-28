const dir=import.meta.dir;
const build=await Bun.build({entrypoints:[`${dir}/benchmark.tsx`],outdir:`${dir}/dist`,target:'browser',minify:true,define:{'process.env.NODE_ENV':'"production"'}});
if(!build.success) throw new Error(build.logs.join('\n'));
Bun.serve({port:1449,hostname:'127.0.0.1',async fetch(req){
 const path=new URL(req.url).pathname;
 if(path==='/results' && req.method==='POST'){await Bun.write(`${dir}/${Bun.env.RESULTS_FILE ?? 'render-results.json'}`,await req.text());return new Response('OK');}
 if(path==='/benchmark.js')return new Response(Bun.file(`${dir}/dist/benchmark.js`));
 return new Response('<!doctype html><title>Notch Round 5</title><h1>Performance test</h1><pre id="results">Running…</pre><div id="host" style="width:700px"></div><script type="module" src="/benchmark.js"></script>',{headers:{'content-type':'text/html'}});
}});console.log('Ready: http://127.0.0.1:1449');
