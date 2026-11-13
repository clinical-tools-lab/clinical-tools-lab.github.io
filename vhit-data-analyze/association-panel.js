(function(){
 'use strict';
 const $=id=>document.getElementById(id),M=window.AssociationMath,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const vars={gain:['VOR 增益','增益','无量纲'],covert:['隐性扫视甩头比例','隐性','%'],overt:['显性扫视甩头比例','显性','%'],any:['任一类扫视甩头比例','任一类','%'],pr:['Overall PR score','PR','0–100'],speed:['平均头速','头速','°/s'],age:['检查时年龄','年龄','岁']};
 const N=n=>Number(n).toLocaleString('en-US'),f=n=>Number.isFinite(n)?n.toFixed(3):'—',v=n=>Number.isFinite(n)?Number(n.toFixed(2)).toLocaleString('en-US'):'—';
 let tests=[],rows=[],cache={},selectedRows=[],selection='全部有效配对',request=0;
 for(const id of ['rel-x','rel-y'])for(const [k,info] of Object.entries(vars))$(id).add(new Option(info[0],k));
 $('rel-x').value='speed';$('rel-y').value='gain';
 async function render(){
  const token=++request;
  const plane=$('rel-plane').value,side=$('rel-side').value,method=$('rel-method').value,sampling=$('rel-sampling').value;
  try{if(window.DataClient)await window.DataClient.ensureSaccades(plane);}catch(error){$('rel-scope').textContent=error.message;return;}
  if(token!==request)return;
  rows=M.rows(tests,window.SACCADES?.tests||{},plane,side,sampling);cache=M.matrix(rows,method);
  const x=$('rel-x').value,y=$('rel-y').value,stat=cache[x+':'+y],p=M.pairs(rows,x,y),ids=new Set(p.map(r=>r.patient_key)).size;
  $('rel-preset').value=[...$('rel-preset').options].some(o=>o.value===x+':'+y)?x+':'+y:'';
  const card=(label,value,detail)=>`<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="detail">${detail}</div></div>`;
  $('rel-kpis').innerHTML=card('当前方向检查',N(rows.length),`${plane} · ${side==='left'?'左':'右'}刺激方向`)+card('所选关系有效配对',N(p.length),`${N(rows.length-p.length)} 项至少一变量缺失`)+card('有效导出身份标识',N(ids),'标识不保证自然人唯一')+card(method==='spearman'?'Spearman ρ':'Pearson r',f(stat.value),'使用全部有效配对，未由绘图样本估算');
  $('rel-scope').textContent=`所选关系：${vars[x][0]} × ${vars[y][0]}。`+(sampling==='first'?'当前筛选内每个导出身份取最早日期的一项，同日按检查化名排序；左右方向与平面不合并。':'包含全部匹配检查，同一身份可重复出现；样本并非独立，不能按独立人作显著性推断。')+(stat.n<30?' 当前有效量不足 30，请谨慎解释。':'')+(x===y?' 当前横纵为同一变量，自相关不提供额外证据。':'');
  matrix();draw(p,x,y);sensitivity(x,y,method);selectedRows=p;selection='全部有效配对';list();
 }
 function matrix(){
  const x=$('rel-x').value,y=$('rel-y').value,keys=M.keys;let html='<div class="rel-matrix-corner">ρ / r · n</div>'+keys.map(k=>`<div class="rel-matrix-label">${vars[k][1]}</div>`).join('');
  for(const a of keys){html+=`<div class="rel-matrix-label">${vars[a][1]}</div>`;for(const b of keys){const s=cache[a+':'+b],value=s.value,alpha=Number.isFinite(value)?(.05+Math.abs(value)*.65):.025,color=value<0?`rgba(194,112,70,${alpha})`:`rgba(22,120,107,${alpha})`;
   html+=`<button type="button" class="rel-matrix-cell" style="background:${color}" data-rel-x="${a}" data-rel-y="${b}" aria-pressed="${a===x&&b===y}" aria-label="${vars[a][0]} 与 ${vars[b][0]}，相关 ${f(value)}，有效 ${s.n} 项"><strong>${a===b?'—':f(value)}</strong><small>n ${N(s.n)}</small></button>`;}}
  $('rel-matrix').innerHTML=html;$('rel-matrix').querySelectorAll('[data-rel-x]').forEach(b=>b.onclick=()=>{$('rel-x').value=b.dataset.relX;$('rel-y').value=b.dataset.relY;render();});
 }
 function draw(p,xkey,ykey){
  const el=$('rel-scatter'),w=Math.max(310,el.clientWidth),h=355,pad={l:55,r:20,t:22,b:52};
  if(!p.length){el.innerHTML='<p class="empty">当前没有有效配对，请检查平面与顶部筛选。</p>';$('rel-bins').innerHTML='';return;}
  const extent=key=>{let lo=Infinity,hi=-Infinity;for(const r of p){lo=Math.min(lo,r[key]);hi=Math.max(hi,r[key]);}if(['covert','overt','any','pr'].includes(key))return [0,100];if(lo===hi){lo-=.5;hi+=.5;}const d=(hi-lo)*.04;return [lo-d,hi+d];};
  const [xmin,xmax]=extent(xkey),[ymin,ymax]=extent(ykey),X=n=>pad.l+(n-xmin)/(xmax-xmin)*(w-pad.l-pad.r),Y=n=>h-pad.b-(n-ymin)/(ymax-ymin)*(h-pad.t-pad.b);
  let svg='';for(let i=0;i<=4;i++){const xv=xmin+(xmax-xmin)*i/4,yv=ymin+(ymax-ymin)*i/4;svg+=`<line class="gridline" x1="${pad.l}" y1="${Y(yv)}" x2="${w-pad.r}" y2="${Y(yv)}"/><text x="${pad.l-7}" y="${Y(yv)+4}" text-anchor="end">${v(yv)}</text><text x="${X(xv)}" y="${h-pad.b+18}" text-anchor="middle">${v(xv)}</text>`;}
  const bs=M.bins(p,xkey,ykey,8),good=bs.filter(b=>b.n>=10),stride=Math.max(1,Math.ceil(p.length/700));
  p.forEach((r,i)=>{if(i%stride)return;svg+=`<circle data-rel-test="${r.test_key}" tabindex="0" role="button" aria-label="打开检查 ${r.test_key}" cx="${X(r[xkey])}" cy="${Y(r[ykey])}" r="3" fill="${r.high_gain_review?'#8a7d9d':'#16786b'}" fill-opacity=".27"><title>${r.date} / ${r.test_key.slice(2,12)} / ${vars[xkey][1]} ${v(r[xkey])} / ${vars[ykey][1]} ${v(r[ykey])}</title></circle>`;});
  for(const b of good)svg+=`<line x1="${X(b.x)}" y1="${Y(b.q1)}" x2="${X(b.x)}" y2="${Y(b.q3)}" stroke="#c57943" stroke-width="5" opacity=".65"/><circle cx="${X(b.x)}" cy="${Y(b.median)}" r="4.5" fill="#b46b35"><title>分箱 n=${b.n}；中位数 ${v(b.median)}；IQR ${v(b.q1)}–${v(b.q3)}</title></circle>`;
  svg+=`<text x="${w/2}" y="${h-7}" text-anchor="middle">${vars[xkey][0]}（${vars[xkey][2]}）→</text><text x="${pad.l}" y="13">${vars[ykey][0]}（${vars[ykey][2]}）↑</text>`;
  el.innerHTML=`<svg role="group" aria-label="变量关联散点与分箱分布" viewBox="0 0 ${w} ${h}">${svg}</svg>`;
  el.querySelectorAll('[data-rel-test]').forEach(b=>{b.onclick=()=>open(b.dataset.relTest);b.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();open(b.dataset.relTest);}};});
  $('rel-bins').innerHTML=bs.map((b,i)=>`<button type="button" class="quiet" data-rel-bin="${i}" ${b.n?'':'disabled'}>${v(b.lo)}–${v(b.hi)}<small>n ${N(b.n)} · 中位 ${v(b.median)}</small></button>`).join('');
  $('rel-bins').querySelectorAll('[data-rel-bin]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.relBin),bin=bs[i],step=(bs.at(-1).hi-bs[0].lo)/bs.length;selectedRows=p.filter(r=>(step===0?0:Math.min(bs.length-1,Math.floor((r[xkey]-bs[0].lo)/step)))===i);selection=`${vars[xkey][1]} ${v(bin.lo)}–${v(bin.hi)}`;list();});
 }
 function sensitivity(x,y,method){
  const sets=[['当前样本',rows],['再排除水平高增益',rows.filter(r=>!r.high_gain_review)],['再排除默认校准',rows.filter(r=>!r.calibration_default)],['再同时排除两者',rows.filter(r=>!r.high_gain_review&&!r.calibration_default)]];
  $('rel-sensitivity').innerHTML=sets.map(([label,rs])=>{const s=M.correlation(rs,x,y,method);return `<tr><td>${label}</td><td>${N(s.n)}</td><td>${f(s.value)}</td></tr>`;}).join('');
 }
 function list(){
  $('rel-selection').textContent=`${selection}：${N(selectedRows.length)} 项方向检查；列表显示前 15 项，导出包含全部。`;
  const x=$('rel-x').value,y=$('rel-y').value;
  $('rel-exams').innerHTML=selectedRows.slice(0,15).map(r=>`<tr><td>${r.date}</td><td class="mono">${r.test_key.slice(2,12)}</td><td>${v(r[x])}</td><td>${v(r[y])}</td><td>${r.n}</td><td><button type="button" class="quiet" data-rel-open="${r.test_key}">查看波形 →</button></td></tr>`).join('')||'<tr><td colspan="6">没有匹配检查</td></tr>';
  $('rel-x-label').textContent=vars[x][0];$('rel-y-label').textContent=vars[y][0];$('rel-exams').querySelectorAll('[data-rel-open]').forEach(b=>b.onclick=()=>open(b.dataset.relOpen));
 }
 function open(key){window.dispatchEvent(new CustomEvent('trace:open-test',{detail:{key}}));}
 function download(){
  const fields=['test_key','patient_key','date','plane','side',...M.keys,'n','high_gain_review','calibration_default'],q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
  const extra=['selected_x','selected_y','method','sampling','selection','year_filter','cohort_filter'];
  const values=[$('rel-x').value,$('rel-y').value,$('rel-method').value,$('rel-sampling').value,selection,$('year').value,$('cohort').value];
  const csv='\uFEFF'+[fields.concat(extra).join(','),...selectedRows.map(r=>fields.map(k=>q(r[k])).concat(values.map(q)).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='vhit-association-pairs.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 ['rel-plane','rel-side','rel-method','rel-sampling','rel-x','rel-y'].forEach(id=>$(id).onchange=render);
 $('rel-preset').onchange=()=>{if(!$('rel-preset').value)return;const [x,y]=$('rel-preset').value.split(':');$('rel-x').value=x;$('rel-y').value=y;render();};
 $('rel-export').onclick=download;$('rel-clear-bin').onclick=()=>{selectedRows=M.pairs(rows,$('rel-x').value,$('rel-y').value);selection='全部有效配对';list();};
 window.AssociationPanel={setTests(ts){tests=ts;return render();}};
})();
