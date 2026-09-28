import {Database} from 'bun:sqlite';
import {mock} from 'bun:test';
const sql=new Database(':memory:');let reads=0,cellRows=0,cellBytes=0,record=false;
mock.module('@tauri-apps/plugin-sql',()=>({default:{load:async()=>({execute:async(q:string,v:any[]=[])=>sql.query(q).run(...v),select:async(q:string,v:any[]=[])=>{const rows:any[]=sql.query(q).all(...v);if(record){reads++;if(q.includes('SELECT * FROM cells')){cellRows+=rows.length;cellBytes+=rows.reduce((n,r)=>n+r.data.length,0)}}return rows;},close:async()=>{}})}}));
const db=await import('../../src/services/database');
const service=await import('../../src/services/search');
await db.initDatabase('sqlite:round5');const book=await db.createNotebook('Synthetic');
const body='common performance sample '+('const value = 123;\n'.repeat(600));
const insert=sql.transaction((from:number,to:number)=>{for(let i=from;i<to;i++){const id=`synthetic-${i}`;sql.query('INSERT INTO notes (id,notebook_id,title,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,book.id,`Common note ${i}`,i,0,0);sql.query('INSERT INTO cells (id,note_id,type,data,sort_order) VALUES (?,?,?,?,?)').run(`cell-${i}`,id,'markdown',body,0);sql.query('INSERT INTO notes_fts (rowid,note_id,title,content) SELECT rowid,id,title,? FROM notes WHERE id=?').run(body,id);}});
const results=[];let seeded=0;
for(const size of [100,1000,5000]){insert(seeded,size);seeded=size;for(const query of ['common','absent-token-zzzzz']){await service.searchNotes(query,{limit:50});const times=[];let returned=0;for(let run=0;run<5;run++){reads=0;cellRows=0;cellBytes=0;record=true;const start=performance.now();returned=(await service.searchNotes(query,{limit:50})).length;times.push(performance.now()-start);record=false;}times.sort((a,b)=>a-b);results.push({size,query,requestedLimit:50,returned,sqlReads:reads,hydratedCells:cellRows,hydratedBodyBytes:cellBytes,sqliteAndMappingMedianMs:+times[2].toFixed(2),maxMs:+times[4].toFixed(2)});}}
console.log(JSON.stringify({noteBodyBytes:body.length,iterations:5,results},null,2));
