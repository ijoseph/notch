const dir = import.meta.dir;
const build = await Bun.build({entrypoints:[`${dir}/search-ui.tsx`],outdir:`${dir}/dist-search`,target:'browser',minify:true,
  define:{'process.env.NODE_ENV':'"production"'}, plugins:[{name:'synthetic-search-transport',setup(build) {
    build.onLoad({filter:/src\/services\/search\.ts$/},()=>({loader:'ts',contents:`
      export async function searchNotes(query,options) {
        document.getElementById('requests').textContent = query + ':' + options.offset;
        await new Promise(resolve=>setTimeout(resolve,query==='slow'?3000:10));
        const count=query==='common'?125:1;
        return Array.from({length:count},(_,i)=>({id:String(i),title:query+' result '+String(i+1).padStart(3,'0'),notebookId:'qa',cells:[{type:'markdown',data:query+' body'}]})).slice(options.offset,options.offset+options.limit);
      }
    `}));
    build.onLoad({filter:/src\/store\/index\.ts$/},()=>({loader:'ts',contents:`
      const state={notebooks:[{id:'qa',name:'Synthetic notebook'}],selectNote:async(id)=>{document.getElementById('status').textContent='Selected '+id;}};
      export const useStore=selector=>selector(state); useStore.getState=()=>state;
    `}));
  }}]});
if(!build.success)throw new Error(build.logs.join('\n'));
Bun.serve({hostname:'127.0.0.1',port:1450,fetch(req){const path=new URL(req.url).pathname;
 if(path==='/search-ui.js'||path==='/search-ui.css')return new Response(Bun.file(`${dir}/dist-search${path}`));
 return new Response('<!doctype html><title>Search UI regression</title><link rel="stylesheet" href="/search-ui.css"><div id="host"></div><div style="position:fixed;bottom:0;z-index:9999;background:white;color:black">Last request: <span id="requests"></span> <span id="status"></span></div><script type="module" src="/search-ui.js"></script>',{headers:{'content-type':'text/html'}});
}});console.log('Ready at http://127.0.0.1:1450');
