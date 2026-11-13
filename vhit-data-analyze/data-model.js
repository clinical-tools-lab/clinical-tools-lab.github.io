(function(root){
 'use strict';
 function cohort(t,mode='basic'){if(mode==='all')return true;if(!t.basic_qc)return false;if(['no_high','strict'].includes(mode)&&t.high_gain_review)return false;if(['no_default','strict'].includes(mode)&&t.calibration_default)return false;return true;}
 function matches(t,q,search=false,names={}){
  if(!cohort(t,q.get('cohort')||'basic'))return false;
  if(q.get('year')&&!t.date.startsWith(q.get('year')))return false;
  if(q.get('kind')&&q.get('kind')!==t.kind)return false;
  if(q.get('subtype')&&q.get('subtype')!==t.test_type)return false;
  if(search){const text=(q.get('search')||'').trim().toLowerCase();if(text&&![t.patient_key,t.test_key,t.date,t.kind,t.test_type,names[t.kind]||''].join(' ').toLowerCase().includes(text))return false;
   const flag=q.get('flag');if(flag==='null'&&t.abnormal!=null)return false;if(['0','1'].includes(flag)&&String(t.abnormal)!==flag)return false;}
  return true;
 }
 function index(payload){return payload.rows.map((row,i)=>({...Object.fromEntries(payload.columns.map((k,j)=>[k,payload.dictionaries[k]?payload.dictionaries[k][row[j]]:row[j]])),_row:i}));}
 function scope(q){return JSON.stringify([q.get('cohort')||'basic',q.get('year')||'',q.get('kind')||'',q.get('subtype')||'']);}
 function csv(rows,fields){const quote=v=>{if(Array.isArray(v))v=v.join(';');let s=String(v??'');if(typeof v==='string'&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return '\uFEFF'+[fields.join(','),...rows.map(r=>fields.map(k=>quote(r[k])).join(','))].join('\r\n');}
 const api={cohort,matches,index,scope,csv};root.PagesModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
