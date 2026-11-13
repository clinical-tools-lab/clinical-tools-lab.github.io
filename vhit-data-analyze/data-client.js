(function(){
 'use strict';
 const V=window.Vault,M=window.PagesModel;window.DATA={tests:[],catalog:[]};window.WAVES=[];window.SACCADES={tests:{}};
 let index=null,meta=null;const chunks=new Map();
 function query(extra={}){const q=new URLSearchParams();for(const id of ['cohort','year','kind','subtype']){const value=document.getElementById(id)?.value;if(value)q.set(id,value);}for(const [k,v] of Object.entries(extra))if(v!==undefined&&v!==null&&v!=='')q.set(k,String(v));return q;}
 async function bootstrap(){const result=await V.json('bootstrap');Object.assign(window.DATA,result);return result;}
 async function overview(q){try{return await V.json('overview:'+M.scope(q));}catch(error){if(error.status!==404)throw error;return {tests:0,identities:0,vhit_tests:0,vhit_impulses:0,first_date:null,last_date:null,repeated_identities:0,months:[],modules:[],ages:Array(12).fill(0),revision:window.DATA.generated};}}
 async function allIndex(){if(!index)index=V.json('table-index').then(M.index);return index;}
 async function records(selected){
  const blocks=[...new Set(selected.map(t=>Math.floor(t._row/256)))];
  for(let i=0;i<blocks.length;i+=4)await Promise.all(blocks.slice(i,i+4).map(async n=>{if(!chunks.has(n))chunks.set(n,await V.json('table:'+n));}));
  return selected.map(t=>chunks.get(Math.floor(t._row/256))[t._row%256]);
 }
 async function table(q){const all=await allIndex(),scope=all.filter(t=>M.matches(t,q)),selected=scope.filter(t=>M.matches(t,q,true,window.DATA.names)),size=Number(q.get('page_size')||25),pages=Math.max(1,Math.ceil(selected.length/size)),page=Math.min(Math.max(0,Number(q.get('page')||0)),pages-1);
  if(!Number.isInteger(size)||size<1||size>250)throw Error('无效的分页参数');
  return {items:await records(selected.slice(page*size,(page+1)*size)),total:selected.length,page,pages,page_size:size,scope_count:scope.length,revision:window.DATA.generated};}
 async function vhit(){if(!meta)meta=V.json('vhit').then(p=>p.rows.map(row=>Object.fromEntries(p.columns.map((k,i)=>[k,row[i]]))));const all=await meta,q=query();return {tests:all.filter(t=>M.matches(t,q)),scope_count:(await overview(q)).tests,revision:window.DATA.generated};}
 async function ensureSaccades(plane){await Promise.all((plane?[plane]:['Lateral','LARP','RALP']).map(async p=>{const payload=await V.json('saccades:'+p);for(const [key,sides] of Object.entries(payload.tests))window.SACCADES.tests[key]=Object.fromEntries(['left','right'].map(s=>[s,Object.fromEntries(payload.columns.map((k,i)=>[k,sides[s][i]]))]));}));}
 async function get(path,q=new URLSearchParams()){
  if(path==='/api/bootstrap')return bootstrap();if(path==='/api/overview')return overview(q);if(path==='/api/tests')return table(q);if(path==='/api/catalog')return V.json('catalog');if(path==='/api/session')return {authenticated:V.unlocked};throw Error('此分享不支持该数据请求');
 }
 async function exportTests(q){const selected=(await allIndex()).filter(t=>M.matches(t,q,true,window.DATA.names)),rows=await records(selected),url=URL.createObjectURL(new Blob([M.csv(rows,window.DATA.export_fields)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='vestibular-filtered-tests.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function invalidate(){V.clear();index=null;meta=null;chunks.clear();window.SACCADES.tests={};}
 window.addEventListener('pagehide',()=>{document.documentElement.classList.add('session-check');});
 window.addEventListener('pageshow',event=>{if(event.persisted)V.lock();});
 window.DataClient={query,get,memo:get,bootstrap,vhit,ensureSaccades,invalidate,exportTests,waveSession:async key=>window.VaultCrypto.wave(await V.binary('wave:'+key,true))};
})();
