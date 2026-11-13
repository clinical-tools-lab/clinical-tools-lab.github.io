(function(root){
 'use strict';
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 async function derive(password,config){
  const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  const salt=Uint8Array.from(atob(config.salt),c=>c.charCodeAt(0));
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:config.iterations},base,{name:'AES-GCM',length:256},false,['decrypt']);
 }
 async function identifier(build,logical){const digest=await crypto.subtle.digest('SHA-256',encoder.encode(build+'\0'+logical));return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');}
 async function decrypt(key,logical,buffer){
  const bytes=new Uint8Array(buffer);if(bytes.length<32||decoder.decode(bytes.slice(0,4))!=='VAT1')throw Error('密文格式不正确');
  const zipped=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(4,16),additionalData:encoder.encode(logical)},key,bytes.slice(16));
  return new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 }
 function wave(buffer){
  const view=new DataView(buffer),length=view.getUint32(0,true),session=JSON.parse(decoder.decode(new Uint8Array(buffer,4,length)));let offset=4+length;
  for(const w of session.waves){for(const field of ['head','eye']){const n=w['_'+field+'_n'];w[field]=Array.from({length:n},()=>{const value=view.getFloat64(offset,true);offset+=8;return Number.isFinite(value)?value:null;});delete w['_'+field+'_n'];}}
  if(offset!==buffer.byteLength)throw Error('波形包长度不正确');return session;
 }
 root.VaultCrypto={derive,identifier,decrypt,wave,text:buffer=>decoder.decode(buffer)};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.VaultCrypto;
})(typeof window!=='undefined'?window:globalThis);
