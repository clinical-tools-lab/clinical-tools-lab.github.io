(function(root){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  function quantile(values,q){
    const a=values.filter(finite).sort((a,b)=>a-b);
    if(!a.length)return null;
    const p=(a.length-1)*q,i=Math.floor(p),f=p-i;
    return a[i]*(1-f)+a[Math.min(i+1,a.length-1)]*f;
  }
  function pointwise(waves,field){
    const n=waves.reduce((n,w)=>Math.max(n,(w[field]||[]).length),0);
    return Array.from({length:n},(_,i)=>{
      const values=waves.map(w=>w[field]?.[i]).filter(finite);
      return {n:values.length,median:quantile(values,.5),q1:quantile(values,.25),q3:quantile(values,.75)};
    });
  }
  function extent(waves,fields=['head','eye']){
    let low=0,high=0,found=false;
    for(const wave of waves)for(const field of fields)for(const v of wave[field]||[]){
      if(finite(v)){low=Math.min(low,v);high=Math.max(high,v);found=true;}
    }
    if(!found||low===high)return [low-.5,high+.5];
    const pad=(high-low)*.07;return [low-pad,high+pad];
  }
  function peakHead(wave){
    let index=null,value=null;
    (wave.head||[]).forEach((v,i)=>{if(finite(v)&&(index===null||Math.abs(v)>Math.abs(value))){index=i;value=v;}});
    return {index,value,absolute:index===null?null:Math.abs(value)};
  }
  function path(values,x,y){
    let d='',connected=false;
    values.forEach((v,i)=>{
      if(!finite(v)){connected=false;return;}
      d+=(connected?'L':'M')+x(i).toFixed(2)+','+y(v).toFixed(2);connected=true;
    });return d;
  }
  function band(summary,x,y){
    const segments=[];let current=[];
    summary.forEach((v,i)=>{
      if(finite(v.q1)&&finite(v.q3))current.push({i,...v});
      else if(current.length){segments.push(current);current=[];}
    });if(current.length)segments.push(current);
    return segments.map(a=>'M'+a.map(v=>`${x(v.i).toFixed(2)},${y(v.q3).toFixed(2)}`).join('L')+'L'+[...a].reverse().map(v=>`${x(v.i).toFixed(2)},${y(v.q1).toFixed(2)}`).join('L')+'Z').join('');
  }
  function crossCorrelation(head,eye,maxLag=20){
    const n=Math.min(head.length,eye.length),limit=Math.min(Math.max(0,Math.floor(maxLag)),Math.max(0,n-3)),curve=[];
    for(let lag=-limit;lag<=limit;lag++){
      let count=0,mh=0,me=0,vh=0,ve=0,cov=0;
      for(let i=Math.max(0,-lag);i<Math.min(head.length,eye.length-lag);i++){
        const h=head[i],e=eye[i+lag];if(!finite(h)||!finite(e))continue;
        count++;const dh=h-mh,de=e-me;mh+=dh/count;me+=de/count;vh+=dh*(h-mh);ve+=de*(e-me);cov+=dh*(e-me);
      }
      const value=count>=Math.max(3,Math.ceil(n*.7))&&vh>0&&ve>0?Math.max(-1,Math.min(1,cov/Math.sqrt(vh*ve))):null;
      curve.push({lag,n:count,value});
    }
    const valid=curve.filter(p=>finite(p.value)).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)||Math.abs(a.lag)-Math.abs(b.lag)||a.lag-b.lag);
    return {curve,best:valid[0]||null,zero:curve.find(p=>p.lag===0)||null,limit};
  }
  const api={finite,quantile,pointwise,extent,peakHead,path,band,crossCorrelation};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.SignalMath=api;
})(typeof window!=='undefined'?window:null);
