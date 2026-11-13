(function(){
 'use strict';
 const base=new URL('./',location.href),C=window.VaultCrypto;let key=null,config=null,resources=new Map(),dialog=null;const pending=new Map(),urls=new Set();
 async function binary(logical,wave=false){
  if(!key)throw Error('请先解锁看板');
  const id=await C.identifier(config.build,logical),path=(wave?config.wave_base:config.data_base).replace('{shard}',id[0]),url=new URL(id+'.bin',new URL(path,base));
  const response=await fetch(url,{cache:'force-cache',credentials:'omit'});if(!response.ok){const error=Error('数据读取失败（'+response.status+'）');error.status=response.status;throw error;}
  return C.decrypt(key,logical,await response.arrayBuffer());
 }
 function cached(logical){
  if(pending.has(logical))return pending.get(logical);
  const promise=binary(logical).catch(error=>{pending.delete(logical);throw error;});pending.set(logical,promise);
  while(pending.size>12)pending.delete(pending.keys().next().value);return promise;
 }
 async function json(logical){return JSON.parse(C.text(await cached(logical)));}
 function lock(){key=null;pending.clear();for(const url of urls)URL.revokeObjectURL(url);urls.clear();location.replace(base.href+location.hash);}
 function blob(bytes,mime){const url=URL.createObjectURL(new Blob([bytes],{type:mime}));urls.add(url);return url;}
 async function resource(path){
  const item=resources.get(path);if(!item)throw Error('此资源未包含在分享中');
  const bytes=await cached('resource:'+path);
  if(item.mime!=='text/html'){
   const a=document.createElement('a');a.href=blob(bytes,item.mime);a.download=path.split('/').at(-1);a.click();return;
  }
  const doc=new DOMParser().parseFromString(C.text(bytes),'text/html');
  for(const link of doc.querySelectorAll('link[rel="stylesheet"]'))link.href=new URL(link.getAttribute('href'),base).href;
  for(const img of doc.querySelectorAll('img[src]')){const src=img.getAttribute('src');if(resources.has(src))img.src=blob(await cached('resource:'+src),resources.get(src).mime);}
  for(const a of doc.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(resources.has(href)){a.dataset.vaultResource=href;a.href='#';a.removeAttribute('target');}else if(href.startsWith('/#')||href.startsWith('/index.html')||href==='index.html'){a.dataset.vaultClose=href.includes('#')?href.slice(href.indexOf('#')):'';a.href='#';}}
  const script=doc.createElement('script');script.src=new URL('doc-view.js',base).href;doc.body.append(script);
  if(!dialog){dialog=document.createElement('dialog');dialog.className='vault-dialog';dialog.innerHTML='<button type="button" class="quiet">关闭说明 ×</button><iframe title="研究说明"></iframe>';
   dialog.querySelector('button').onclick=()=>dialog.close();document.body.append(dialog);}
  dialog.querySelector('iframe').src=blob('<!doctype html>'+doc.documentElement.outerHTML,'text/html');dialog.showModal();
 }
 window.addEventListener('message',event=>{if(!dialog||event.source!==dialog.querySelector('iframe').contentWindow)return;
  if(event.data?.type==='atlas:close'){dialog.close();if(event.data.hash)location.hash=event.data.hash;}
  if(event.data?.type==='atlas:resource')resource(event.data.path).catch(error=>alert(error.message));
 });
 document.addEventListener('click',event=>{const a=event.target.closest?.('a[href]');if(!a||!key)return;
  const target=new URL(a.href,location.href);if(target.origin!==base.origin||!target.pathname.startsWith(base.pathname))return;
  const path=decodeURIComponent(target.pathname.slice(base.pathname.length));if(!resources.has(path))return;
  event.preventDefault();resource(path).catch(error=>alert(error.message));
 });
 window.Vault={binary,cached,json,lock,base,resource,clear(){pending.clear();},get unlocked(){return Boolean(key);}};
 document.getElementById('unlock-form').addEventListener('submit',async event=>{
  event.preventDefault();const input=document.getElementById('unlock-password'),button=document.getElementById('unlock-button'),status=document.getElementById('unlock-status');button.disabled=true;status.textContent='正在解密…';
  try{
   if(!crypto.subtle)throw Error('请使用支持加密的现代浏览器，通过 HTTPS 打开此页');
   config=await (await fetch(new URL('config.json',base),{cache:'no-store'})).json();key=await C.derive(input.value,config);input.value='';
   let app;try{app=await json('app');}catch(error){key=null;pending.clear();throw Error('密码不正确，或加密文件未完整加载。');}
   resources=new Map(app.resources.map(item=>[item.path,item]));
   const doc=new DOMParser().parseFromString(app.html,'text/html'),scripts=[...doc.querySelectorAll('script[src]')].map(s=>s.getAttribute('src'));
   doc.querySelectorAll('script').forEach(s=>s.remove());document.head.innerHTML=doc.head.innerHTML;document.body.innerHTML=doc.body.innerHTML;
   document.getElementById('pages-lock').onclick=lock;
   for(const src of scripts)await new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=new URL(src,base).href;node.onload=resolve;node.onerror=()=>reject(Error('页面脚本加载失败'));document.body.append(node);});
  }catch(error){const target=document.getElementById('unlock-status');if(target)target.textContent=error.message;else alert(error.message);button.disabled=false;}
 });
})();
