/* Direction-specific descriptive categories; no diagnosis or inferred enum mapping. */
(function(root){
 'use strict';
 const kinds=['covert','overt','any'];
 function gainState(gain,plane){
  if(!Number.isFinite(gain)||gain<0||!['Lateral','LARP','RALP'].includes(plane))return 'missing';
  if(gain<(plane==='Lateral'?.8:.7))return 'low';
  if(plane==='Lateral'&&gain>1.2)return 'high';
  return 'reference';
 }
 function present(side,kind='any',threshold=0){
  if(!side?.complete||!kinds.includes(kind))return null;
  const n=side.n,p=side[kind+'_positive'];
  if(!Number.isInteger(n)||n<=0||!Number.isInteger(p)||p<0||p>n)return null;
  return p>0&&(threshold===0||p/n>=threshold/100);
 }
 function summarize(tests,records,kind='any',threshold=0){
  const rows=[],groups={reference_yes:[],reference_no:[],low_yes:[],low_no:[],high:[],missing:[]};
  let completeTests=0,covertTests=0,overtTests=0,bothTests=0,neitherTests=0,referenceTests=0,referenceWithSaccades=0;
  const typeCounts={covert_only:0,overt_only:0,both:0,neither:0,missing:0};
  for(const t of tests){
   const rec=records[t.test_key]||{};
   const states=['left','right'].map(s=>gainState(t[s+'_gain_vor'],t.test_type));
   const cs=['left','right'].map(s=>present(rec[s],'covert',0)),os=['left','right'].map(s=>present(rec[s],'overt',0));
   const known=cs.every(x=>x!==null)&&os.every(x=>x!==null);
   if(known){
    completeTests++;const c=cs.some(Boolean),o=os.some(Boolean);covertTests+=c;overtTests+=o;bothTests+=c&&o;neitherTests+=!c&&!o;
    const inRange=states.every(s=>s==='reference');referenceTests+=inRange;
    referenceWithSaccades+=inRange&&['left','right'].some(s=>present(rec[s],kind,threshold)===true);
   }
   ['left','right'].forEach((side,i)=>{
    const v=rec[side]||{},p=present(v,kind,threshold),c=cs[i],o=os[i],gain=t[side+'_gain_vor'],state=states[i];
    typeCounts[c===null||o===null?'missing':c&&o?'both':c?'covert_only':o?'overt_only':'neither']++;
    const category=state==='missing'||p===null?'missing':state==='high'?'high':state+'_'+(p?'yes':'no');
    const row={test_key:t.test_key,patient_key:t.patient_key,date:t.date,plane:t.test_type,side,gain,state,category,present:p,...v};
    rows.push(row);groups[category].push(row);
   });
  }
  return {rows,groups,typeCounts,completeTests,covertTests,overtTests,bothTests,neitherTests,referenceTests,referenceWithSaccades};
 }
 const api={gainState,present,summarize};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.SaccadeMath=api;
})(typeof window!=='undefined'?window:globalThis);
