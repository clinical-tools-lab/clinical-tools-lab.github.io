(function(root){
 'use strict';
 const keys=['gain','covert','overt','any','pr','speed','age'];
 function rows(tests,records,plane='Lateral',side='left',sampling='first'){
  let source=tests.filter(t=>t.kind==='VW_HITest'&&t.test_type===plane).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.test_key.localeCompare(b.test_key));
  if(sampling==='first'){const seen=new Set();source=source.filter(t=>{if(seen.has(t.patient_key))return false;seen.add(t.patient_key);return true;});}
  return source.map(t=>{const s=records[t.test_key]?.[side],raw=t[side==='left'?'LeftAvgVelocity':'RightAvgVelocity'];return {
   test_key:t.test_key,patient_key:t.patient_key,date:t.date,plane,side,high_gain_review:t.high_gain_review,calibration_default:t.calibration_default,
   gain:t[side+'_gain_vor'],covert:s?.complete?s.covert_percent:null,overt:s?.complete?s.overt_percent:null,any:s?.complete?s.any_percent:null,
   pr:s?.overall_pr??null,speed:Number.isFinite(raw)&&raw>0?raw*.01:null,age:t.age,n:s?.n??0
  };});
 }
 function ranks(a){const order=a.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),out=Array(a.length);for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].v===order[i].v)j++;const r=(i+j+1)/2;for(let k=i;k<j;k++)out[order[k].i]=r;i=j;}return out;}
 function pearson(a,b){
  if(a.length<3||a.length!==b.length)return null;
  let ma=0,mb=0,va=0,vb=0,cov=0;
  for(let i=0;i<a.length;i++){const dx=a[i]-ma,dy=b[i]-mb;ma+=dx/(i+1);mb+=dy/(i+1);va+=dx*(a[i]-ma);vb+=dy*(b[i]-mb);cov+=dx*(b[i]-mb);}
  if(va<=0||vb<=0)return null;return Math.max(-1,Math.min(1,cov/Math.sqrt(va*vb)));
 }
 function pairs(rows,x,y){return rows.filter(r=>Number.isFinite(r[x])&&Number.isFinite(r[y]));}
 function correlation(rows,x,y,method='spearman'){
  const p=pairs(rows,x,y),a=p.map(r=>r[x]),b=p.map(r=>r[y]);
  return {n:p.length,value:method==='pearson'?pearson(a,b):pearson(ranks(a),ranks(b))};
 }
 function matrix(rows,method='spearman'){const out={};for(let i=0;i<keys.length;i++)for(let j=i;j<keys.length;j++){const s=correlation(rows,keys[i],keys[j],method);out[keys[i]+':'+keys[j]]=s;out[keys[j]+':'+keys[i]]=s;}return out;}
 function quantile(values,q){if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),p=(a.length-1)*q,l=Math.floor(p);return a[l]*(1-(p-l))+a[Math.min(l+1,a.length-1)]*(p-l);}
 function bins(rows,x,y,count=8){
  const p=pairs(rows,x,y);if(!p.length)return [];
  let lo=Infinity,hi=-Infinity;for(const r of p){lo=Math.min(lo,r[x]);hi=Math.max(hi,r[x]);}
  const buckets=Array.from({length:hi===lo?1:count},()=>[]),step=(hi-lo)/count;
  for(const r of p)buckets[hi===lo?0:Math.min(count-1,Math.floor((r[x]-lo)/step))].push(r);
  return buckets.map((b,i)=>({lo:lo+i*step,hi:i===buckets.length-1?hi:lo+(i+1)*step,n:b.length,x:quantile(b.map(r=>r[x]),.5),median:quantile(b.map(r=>r[y]),.5),q1:quantile(b.map(r=>r[y]),.25),q3:quantile(b.map(r=>r[y]),.75)}));
 }
 const api={keys,rows,ranks,pearson,pairs,correlation,matrix,quantile,bins};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AssociationMath=api;
})(typeof window!=='undefined'?window:globalThis);
