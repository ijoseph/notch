import {Database} from 'bun:sqlite';
import {mock} from 'bun:test';
const sql=new Database(':memory:');
mock.module('@tauri-apps/plugin-sql',()=>({default:{load:async()=>({execute:async(q:string,v:any[]=[])=>sql.query(q).run(...v),select:async(q:string,v:any[]=[])=>sql.query(q).all(...v),close:async()=>{}})}}));
const db=await import('../../src/services/database');
const resources=await import('../../src/services/resources');
await db.initDatabase('sqlite:retention');const book=await db.createNotebook('Synthetic');
const ids=[];
for(let i=0;i<30;i++){const note=await db.createNote(book.id,`Synthetic ${i}`);const resource=await db.createResource(note.id,'synthetic.png','image/png',Buffer.alloc(2*1024*1024,i).toString('base64'));ids.push(resource.id);await resources.loadResourcesForNote(note.id);}
const before={visitedNotes:30,cachedResources:ids.filter(id=>!!resources.getResourceDataUrl(id)).length,retainedDataUrlCharacters:ids.reduce((sum,id)=>sum+(resources.getResourceDataUrl(id)?.length??0),0)};
await db.initDatabase('sqlite:retention-new-library');
console.log(JSON.stringify({beforeLibrarySwitch:before,afterLibrarySwitchCachedResources:ids.filter(id=>!!resources.getResourceDataUrl(id)).length},null,2));
