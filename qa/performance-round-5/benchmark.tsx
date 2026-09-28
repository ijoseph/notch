import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import NotePreview from '../../src/components/Preview/NotePreview';
import {exportNoteToPrintHTML} from '../../src/services/export';
const frame=()=>new Promise<void>(r=>requestAnimationFrame(()=>r()));
const results:any[]=[];
const stats=(values:number[])=>{values.sort((a,b)=>a-b);return {medianMs:+values[Math.floor(values.length/2)].toFixed(2),p95Ms:+values[Math.floor(values.length*.95)].toFixed(2),maxMs:+values.at(-1)!.toFixed(2)}};
for(const count of [20,100]) {
 const code=Array.from({length:40},(_,i)=>`const item${i} = { index: ${i}, label: "performance sample ${i}" };`).join('\n');
 let note:any={id:'perf',title:'Synthetic performance fixture',tags:[],bodyLoaded:true,cells:[{id:'active',type:'markdown',data:'Typing',sortOrder:0},...Array.from({length:count},(_,i)=>({id:`code${i}`,type:'code',language:'javascript',data:code,sortOrder:i+1}))]};
 for(let round=1;round<=3;round++) {
  const root=createRoot(document.getElementById('host')!);
  flushSync(()=>root.render(<NotePreview note={note}/>)); await frame();
  await exportNoteToPrintHTML(note);
  const inline:number[]=[],floating:number[]=[]; let htmlBytes=0;
  for(let edit=0;edit<30;edit++) {
   note={...note,cells:[{...note.cells[0],data:`Typing sample ${edit}`},...note.cells.slice(1)]};
   let start=performance.now(); flushSync(()=>root.render(<NotePreview note={note}/>)); inline.push(performance.now()-start); await frame();
   start=performance.now();const html=await exportNoteToPrintHTML(note);floating.push(performance.now()-start); htmlBytes=new TextEncoder().encode(html).length;await frame();
  }
  results.push({count,lines:count*40,round,inline:stats(inline),floatingSerialization:stats(floating),htmlBytes});
  root.unmount();
  document.getElementById('results')!.textContent=JSON.stringify({userAgent:navigator.userAgent,results},null,2);
  await fetch('/results',{method:'POST',body:document.getElementById('results')!.textContent});
 }
}
document.title='Round 5 complete';
