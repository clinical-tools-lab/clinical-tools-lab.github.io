(function(root){
  'use strict';
  function summary(tests){
    const people=new Set();let impulses=0;
    for(const t of tests){if(t.patient_key)people.add(t.patient_key);if(Number.isFinite(t.impulses))impulses+=t.impulses;}
    return {tests:tests.length,identities:people.size,impulses};
  }
  function select(tests,{query='',patient='',mode='all',representatives=new Set(),sort='date_desc'}={}){
    const q=query.trim().toLowerCase();
    const selected=tests.filter(t=>(!patient||t.patient_key===patient)&&(mode!=='representative'||representatives.has(t.test_key))&&
      (!q||[t.patient_key,t.test_key,t.date,t.test_type].join(' ').toLowerCase().includes(q)));
    return selected.sort((a,b)=>{
      const ad=a.date||'',bd=b.date||'';
      if(!ad&&bd)return 1;if(ad&&!bd)return -1;
      const cmp=ad.localeCompare(bd);return (sort==='date_asc'?cmp:-cmp)||a.test_key.localeCompare(b.test_key);
    });
  }
  function paginate(tests,page=0,size=10){
    size=[10,25,50].includes(Number(size))?Number(size):10;
    const pages=Math.max(1,Math.ceil(tests.length/size));
    page=Math.max(0,Math.min(Number.isFinite(page)?Math.floor(page):0,pages-1));
    return {items:tests.slice(page*size,(page+1)*size),page,pages,total:tests.length,start:tests.length?page*size+1:0,end:Math.min(tests.length,(page+1)*size)};
  }
  const api={summary,select,paginate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ExamLibrary=api;
})(typeof window!=='undefined'?window:null);
