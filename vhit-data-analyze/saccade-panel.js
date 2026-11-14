(function(){
 'use strict';
 const $=id=>document.getElementById(id),M=window.SaccadeMath,N=n=>Number(n).toLocaleString('en-US');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={all:'全部方向',reference_yes:'增益参考内 · 达扫视条件',reference_no:'增益参考内 · 未达扫视条件',low_yes:'低于增益下限 · 达扫视条件',low_no:'低于增益下限 · 未达扫视条件',high:'水平高增益待复核',missing:'增益或扫视不可分析'};
 const show=n=>Number.isFinite(n)?n.toFixed(2):'—';
 let current=[],result=null,selected='all',kind='any',threshold=0;
 function median(a){a=a.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:null;}
 function render(tests){
  current=tests;kind=$('saccade-kind').value;threshold=Number($('saccade-threshold').value);
  if(!window.SACCADES){$('saccade-summary').textContent='扫视提取数据未加载，请运行 scripts/research_saccades.py 并刷新。';return;}
  result=M.summarize(tests,window.SACCADES.tests,kind,threshold);
  const s=result,total=tests.length,card=(label,value,detail)=>`<div class="kpi"><div class="label">${label}</div><div class="value">${N(value)}</div><div class="detail">${detail}</div></div>`;
  $('saccade-kpis').innerHTML=card('含隐性扫视的检查',s.covertTests,`任一方向至少一次 · / ${N(s.completeTests)} 项`)+card('含显性扫视的检查',s.overtTests,`任一方向至少一次 · / ${N(s.completeTests)} 项`)+card('两类均出现的检查',s.bothTests,'可在不同方向 / 不同甩头出现')+card('双方向增益参考内仍达扫视条件',s.referenceWithSaccades,`/ ${N(s.referenceTests)} 项双方向参考内检查`);
  $('saccade-summary').textContent=`检查级统计：${N(s.completeTests)} / ${N(total)} 项双方向扫视记录完整，其中 ${N(s.neitherTests)} 项未检出两类扫视。联合分类共 ${N(s.rows.length)} 个刺激方向。前三张卡统计至少一次检出，末张卡随所选扫视条件变化。`;
  const definitions=[['covert_only','仅隐性'],['overt_only','仅显性'],['both','两类都有'],['neither','均未检出'],['missing','扫视不可分析']];
  $('saccade-types').innerHTML=definitions.map(([key,label])=>`<div><span>${label}</span><strong>${N(s.typeCounts[key])}</strong><small>方向</small></div>`).join('');
  const cell=key=>`<button type="button" class="saccade-cell" data-saccade-group="${key}" aria-pressed="${selected===key}"><span>${labels[key]}</span><strong>${N(s.groups[key].length)}</strong><small>方向 · ${s.rows.length?(100*s.groups[key].length/s.rows.length).toFixed(1):'0.0'}% 的当前方向</small></button>`;
  $('saccade-matrix').innerHTML=['reference_no','reference_yes','low_no','low_yes'].map(cell).join('');
  $('saccade-extra').innerHTML=['all','high','missing'].map(key=>`<button class="quiet" type="button" data-saccade-group="${key}" aria-pressed="${selected===key}">${labels[key]} · ${N(key==='all'?s.rows.length:s.groups[key].length)}</button>`).join('');
  const pr=s.rows.map(r=>r.overall_pr).filter(Number.isFinite),cp=s.rows.map(r=>r.covert_pr).filter(Number.isFinite),op=s.rows.map(r=>r.overt_pr).filter(Number.isFinite);
  $('saccade-pr').textContent=`有效 Overall PR：${N(pr.length)} 个方向，中位数 ${show(median(pr))}；隐性 PR：${N(cp.length)} 个方向，中位数 ${show(median(cp))}；显性 PR：${N(op.length)} 个方向，中位数 ${show(median(op))}。按有效方向统计；-1 记为缺失，0 保留。`;
  document.querySelectorAll('[data-saccade-group]').forEach(b=>b.onclick=()=>{selected=b.dataset.saccadeGroup;render(current);});
  draw();list();
 }
 function chosen(){return !result?[]:selected==='all'?result.rows:result.groups[selected];}
 function draw(){
  const el=$('saccade-scatter'),w=Math.max(300,el.clientWidth),h=270,p={l:48,r:18,t:25,b:38},rows=chosen().filter(r=>r.state!=='missing'&&r.complete&&Number.isFinite(r[kind+'_percent']));
  if(!rows.length){el.innerHTML='<p class="empty">当前分类没有可绘制的方向</p>';return;}
  const max=Math.max(1.5,...rows.map(r=>r.gain)),x=v=>p.l+v/max*(w-p.l-p.r),y=v=>h-p.b-v/100*(h-p.t-p.b);
  let svg='';for(let v=0;v<=100;v+=25)svg+=`<line class="gridline" x1="${p.l}" y1="${y(v)}" x2="${w-p.r}" y2="${y(v)}"/><text x="${p.l-7}" y="${y(v)+4}" text-anchor="end">${v}%</text>`;
  for(let i=0;i<=4;i++)svg+=`<text x="${x(max*i/4)}" y="${h-18}" text-anchor="middle">${(max*i/4).toFixed(2)}</text>`;
  if(threshold>0)svg+=`<line x1="${p.l}" y1="${y(threshold)}" x2="${w-p.r}" y2="${y(threshold)}" stroke="#d48b47" stroke-dasharray="5 4"/>`;
  const planes=new Set(current.map(t=>t.test_type));if(planes.size===1){const plane=[...planes][0];for(const g of plane==='Lateral'?[.8,1.2]:[.7])svg+=`<line x1="${x(g)}" y1="${p.t}" x2="${x(g)}" y2="${h-p.b}" stroke="#80988a" stroke-dasharray="5 4"/>`;}
  const stride=Math.max(1,Math.ceil(rows.length/1200));rows.forEach((r,i)=>{if(i%stride)return;svg+=`<circle tabindex="0" role="button" aria-label="打开 ${esc(r.test_key)} ${r.side} 波形" data-saccade-test="${r.test_key}" cx="${x(r.gain)}" cy="${y(r[kind+'_percent'])}" r="3" fill="${r.state==='low'?'#c77943':r.state==='high'?'#8a7d9d':'#16786b'}" fill-opacity=".4"><title>${esc(r.date)} / ${r.plane} / ${r.side} / 增益 ${show(r.gain)} / 扫视 ${show(r[kind+'_percent'])}% / PR ${show(r.overall_pr)}</title></circle>`;});
  svg+=`<text x="${w/2}" y="${h-1}" text-anchor="middle">同方向 VOR 增益 →</text><text x="${p.l}" y="13">含所选扫视的甩头比例 ↑</text>`;
  el.innerHTML=`<svg role="group" aria-label="增益与扫视比例，可点选波形" viewBox="0 0 ${w} ${h}">${svg}</svg>`;
  el.querySelectorAll('[data-saccade-test]').forEach(el=>{el.onclick=()=>open(el.dataset.saccadeTest);el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();open(el.dataset.saccadeTest);}};});
 }
 function open(key){window.dispatchEvent(new CustomEvent('trace:open-test',{detail:{key}}));}
 function list(){
  const rows=chosen(),tests=new Set(rows.map(r=>r.test_key));
  $('saccade-selection').textContent=`${labels[selected]}：${N(rows.length)} 个方向，涉及 ${N(tests.size)} 项去重检查。展示日期最新的前 20 个方向，可导出全部匹配方向。`;
  $('saccade-exams').innerHTML=[...rows].sort((a,b)=>b.date.localeCompare(a.date)||a.test_key.localeCompare(b.test_key)||a.side.localeCompare(b.side)).slice(0,20).map(r=>`<tr><td>${esc(r.date)}<small>${r.plane} · ${r.side==='left'?'左刺激':'右刺激'}</small></td><td class="mono">${esc(r.test_key.slice(2,12))}</td><td>${show(r.gain)}</td><td>${r.complete?r.covert_positive+' / '+r.n:'—'}</td><td>${r.complete?r.overt_positive+' / '+r.n:'—'}</td><td>${show(r.overall_pr)}</td><td><button type="button" class="quiet" data-saccade-open="${r.test_key}">查看波形 →</button></td></tr>`).join('')||'<tr><td colspan="7">没有匹配方向</td></tr>';
  $('saccade-exams').querySelectorAll('[data-saccade-open]').forEach(b=>b.onclick=()=>open(b.dataset.saccadeOpen));
 }
 function download(){
  const fields=['test_key','patient_key','date','plane','side','gain','state','category','n','known','covert_positive','overt_positive','any_positive','covert_percent','overt_percent','any_percent','covert_events','overt_events','overall_pr','covert_pr','overt_pr','classification_raw'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const lines=[fields.concat(['saccade_kind','threshold_percent','gain_policy']).join(','),...chosen().map(r=>fields.map(k=>q(r[k])).concat([q(kind),q(threshold),q('Lateral:0.8-1.2;vertical:>=0.7(no upper norm)')]).join(','))];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='vhit-gain-saccades-'+selected+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 ['saccade-kind','saccade-threshold'].forEach(id=>$(id).addEventListener('change',()=>render(current)));
 $('saccade-export').onclick=download;
 window.SaccadePanel={render};
})();
