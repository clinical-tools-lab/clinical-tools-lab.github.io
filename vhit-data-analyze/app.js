'use strict';
const D=window.DATA,W=window.WAVES,$=id=>document.getElementById(id);
if(D?.test_columns)D.tests=D.tests.map(row=>Object.fromEntries(D.test_columns.map((key,i)=>[key,row[i]])));
const names={VW_HITest:'vHIT · 甩头',VW_GazeTest:'凝视 / 自发眼震',VW_DynamicTest:'动态 / 位置检查',VW_VORTest:'视频前庭眼反射',VW_SaccadeTest:'扫视检查',VW_PursuitTest:'平滑追踪',VW_OKNTest:'视动检查'};
const fmt=n=>Number(n||0).toLocaleString('en-US'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),short=s=>(s||'').slice(2,12),median=a=>{a=a.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:null;},show=v=>v==null?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
let filtered=[],page=0,activeTab='overview',overviewStats=null,tableItems=[],viewRequest=0,tableRequest=0;
const countBy=(ts,fn)=>{const m={};for(const t of ts){const k=fn(t);if(k!=null&&k!=='')m[k]=(m[k]||0)+1;}return Object.entries(m);};
const kpi=(label,value,detail)=>`<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="detail">${esc(detail)}</div></div>`;
function baseChart(id){let el=$(id),w=Math.max(300,el.clientWidth),h=el.clientHeight;return {el,w,h,p:{l:48,r:15,t:18,b:39}};}
function empty(id,msg='当前筛选下没有可用数据'){$(id).innerHTML=`<div class="empty">${esc(msg)}</div>`;}
function bars(id,values){const max=Math.max(1,...values.map(v=>v[1]));$(id).innerHTML=values.map(([k,n])=>`<div class="bar-row"><div class="bar-title"><span>${esc(k)}</span><b>${fmt(n)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${n/max*100}%"></div></div></div>`).join('')||'<div class="empty">无记录</div>';}
function barChart(id,values,color='#16786b'){
 if(!values.length){empty(id);return;}
 const {el,w,h,p}=baseChart(id),pw=w-p.l-p.r,ph=h-p.t-p.b,max=Math.max(1,...values.map(x=>x[1]));let s='';
 for(let i=0;i<=4;i++){const y=p.t+ph*(1-i/4);s+=`<line class="gridline" x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}"/><text x="${p.l-8}" y="${y+3}" text-anchor="end">${show(max*i/4)}</text>`;}
 const gap=pw/values.length,bw=Math.max(1,gap*.65),stride=Math.ceil(values.length/(w<450?6:10));
 values.forEach(([label,n],i)=>{const x=p.l+i*gap+(gap-bw)/2,y=p.t+ph*(1-n/max);s+=`<rect x="${x}" y="${y}" width="${bw}" height="${ph*n/max}" fill="${color}" rx="2"><title>${esc(label)}: ${fmt(n)}</title></rect>`;if(i%stride===0)s+=`<text x="${x+bw/2}" y="${h-15}" text-anchor="middle">${esc(label)}</text>`;});
 el.innerHTML=`<svg role="img" aria-label="${esc(id)}柱状图" viewBox="0 0 ${w} ${h}">${s}</svg>`;
}
function histogram(id,values,n=16){values=values.filter(Number.isFinite);if(!values.length){empty(id);return;}let min=Math.min(...values),max=Math.max(...values);if(min===max)max=min+1;const step=(max-min)/n,counts=Array(n).fill(0);for(const v of values)counts[Math.min(n-1,Math.floor((v-min)/step))]++;barChart(id,counts.map((v,i)=>[show(min+i*step),v]));}
function scatter(ts,divisor){const pts=ts.filter(t=>t.left_gain_vor!=null&&t.right_gain_vor!=null);if(!pts.length){empty('scatter');return;}
 const {el,w,h,p}=baseChart('scatter'),pw=w-p.l-p.r,ph=h-p.t-p.b,values=pts.flatMap(t=>[t.LeftAvgGain/divisor,t.RightAvgGain/divisor]),lo=Math.min(0,...values),hi=Math.max(1,...values),range=hi-lo||1,x=v=>p.l+(v-lo)/range*pw,y=v=>p.t+ph-(v-lo)/range*ph;let s='';
 for(let i=0;i<=4;i++){const v=lo+range*i/4;s+=`<line class="gridline" x1="${p.l}" y1="${y(v)}" x2="${w-p.r}" y2="${y(v)}"/><text x="${p.l-7}" y="${y(v)+3}" text-anchor="end">${show(v)}</text><text x="${x(v)}" y="${h-19}" text-anchor="middle">${show(v)}</text>`;}
 s+=`<line x1="${x(lo)}" y1="${y(lo)}" x2="${x(hi)}" y2="${y(hi)}" stroke="#b2c4b5" stroke-dasharray="4 4"/>`;
 const stride=Math.max(1,Math.ceil(pts.length/2000));pts.forEach((t,i)=>{if(i%stride)return;s+=`<circle cx="${x(t.LeftAvgGain/divisor)}" cy="${y(t.RightAvgGain/divisor)}" r="2.7" fill="${t.high_gain_review?'#d48b47':'#16786b'}" fill-opacity=".4"><title>${esc(t.date)} / ${esc(t.test_type)} / L ${show(t.LeftAvgGain/divisor)} / R ${show(t.RightAvgGain/divisor)}</title></circle>`;});s+=`<text x="${w/2}" y="${h-2}" text-anchor="middle">左侧增益${divisor===1?'原值':'（无量纲）'} →</text><text x="${p.l}" y="10">右侧 ↑</text>`;el.innerHTML=`<svg role="img" aria-label="左右侧增益散点图" viewBox="0 0 ${w} ${h}">${s}</svg>`;
}
function overview(){const o=overviewStats;
 $('kpis').innerHTML=kpi('去重检查记录',fmt(o.tests),'按模块 + 检查 GUID 合并')+kpi('导出身份标识',fmt(o.identities),'同一自然人可能对应多个标识')+kpi('vHIT 检查',fmt(o.vhit_tests),`${fmt(o.vhit_impulses)} 次甩头记录`)+kpi('日期覆盖',o.first_date?o.first_date.slice(0,4)+'–'+o.last_date.slice(0,4):'—',`${fmt(o.repeated_identities)} 个身份有多项检查（含不同模块）`);
 const months=o.months;if(months.length){let y=Number(months[0][0].slice(0,4)),m=Number(months[0][0].slice(5)),last=months.at(-1)[0],map=new Map(months),complete=[];for(let i=0;i<1200;i++){const k=y+'-'+String(m).padStart(2,'0');if(k>last)break;complete.push([k,map.get(k)||0]);if(++m>12){m=1;y++;}}barChart('timeline',complete);}else empty('timeline');
 bars('modules',o.modules.map(([k,n])=>[names[k]||k,n]));barChart('ages',o.ages.map((n,i)=>[i===11?'110+':i*10+'–'+(i*10+9),n]),'#73a48b');
}
function vhit(){
 const plane=$('vhit-plane').value,ts=filtered.filter(t=>t.kind==='VW_HITest'&&(!plane||t.test_type===plane)),d=$('scaled').checked?1:100,both=ts.filter(t=>t.left_gain_vor!=null&&t.right_gain_vor!=null);
 $('vhit-kpis').innerHTML=kpi('vHIT 检查',fmt(ts.length),`${fmt(both.length)} 项双侧可分析 · ${plane||'平面合并'}`)+kpi('左方向增益中位数',show(median(both.map(t=>t.LeftAvgGain/d))),d===1?'XML 整数存储值':'VOR 增益 · 无量纲')+kpi('右方向增益中位数',show(median(both.map(t=>t.RightAvgGain/d))),d===1?'XML 整数存储值':'VOR 增益 · 无量纲')+kpi('设备未删除甩头',fmt(ts.reduce((n,t)=>n+t.active_impulses,0)),'设备保留不代表人工质控合格');
 $('gain-qc-note').textContent=`当前 ${fmt(ts.filter(t=>t.high_gain_review).length)} 项水平高增益待复核；${fmt(ts.filter(t=>t.calibration_default).length)} 项默认校准；${fmt(ts.length-both.length)} 项双侧数据不可分析。`+(!plane?' 全部平面混合仅供盘点，比较与解释应选择同一平面。':plane==='Lateral'?' 大于 1 不等同于疾病或测量错误，需结合校准、扫视和波形复核。':' 垂直平面的左右标签是导出刺激方向，不能直接套用水平双耳阈值。');
 scatter(ts,d);histogram('gains',both.flatMap(t=>[t.LeftAvgGain/d,t.RightAvgGain/d]));
 window.SaccadePanel.render(ts);
 window.TraceWorkbench.setTests(filtered.filter(t=>t.kind==='VW_HITest'),plane);
}
function tableQuery(){return window.DataClient.query({search:$('search').value.trim(),flag:$('flag').value,page,page_size:25});}
async function renderTable(){
 const token=++tableRequest,q=tableQuery();$('prev').disabled=true;$('next').disabled=true;
 const r=await window.DataClient.get('/api/tests',q);
 if(token!==tableRequest||activeTab!=='explorer'||q.toString()!==tableQuery().toString())return;
 tableItems=r.items;page=r.page;scope(r.scope_count);
 $('test-table').innerHTML=r.items.map(t=>`<tr><td>${esc(t.date||'未记录')}</td><td><span class="mono" title="${esc(t.patient_key)}">${short(t.patient_key)}</span><small>检查 ${short(t.test_key)}</small></td><td>${esc(names[t.kind]||t.kind)}<small>${esc(t.test_type)}</small>${t.kind==='VW_HITest'?`<button type="button" class="quiet" data-table-wave="${t.test_key}">查看波形 →</button>`:''}</td><td>${show(t.age)}</td><td>${show(t.left_gain_vor)} / ${show(t.right_gain_vor)}</td><td>${t.qc_flags?.length?`<small class="qc-warning">${esc(t.qc_flags.join(' · '))}</small>`:''}${t.abnormal==null?'—':`<span class="pill ${t.abnormal?'warn':''}">${!!t.abnormal}</span>`}</td><td>${t.copies} / ${t.versions}</td></tr>`).join('')||'<tr><td colspan="7">没有匹配记录</td></tr>';
 $('test-table').querySelectorAll('[data-table-wave]').forEach(b=>b.onclick=()=>inspectWave(b.dataset.tableWave));
 $('page-info').textContent=`${fmt(r.total)} 项 · 第 ${page+1} / ${r.pages} 页 · 每页 25 项`;$('prev').disabled=page===0;$('next').disabled=page===r.pages-1;
}
async function inspectWave(key){
 const selected=[...D.tests,...tableItems].find(t=>t.test_key===key);if(!selected)return;
 $('vhit-plane').value=selected.test_type;if(!await activateTab('vhit'))return;
 await window.TraceWorkbench.openTest(key);$('trace-session-meta').scrollIntoView({behavior:'smooth',block:'start'});
}
function quality(){const m=D.metrics,errors=D.status.filter(s=>s.status==='error').reduce((n,s)=>n+s.count,0);$('quality-kpis').innerHTML=kpi('XML 已处理 / 清单',fmt(m.xml_sources)+' / '+fmt(m.xml_inventory),'含字节重复文件与显式失败')+kpi('不同内容的 XML',fmt(m.raw_xml),'SHA-256 合并 · 无损压缩保存')+kpi('存在多个导出版本',fmt(m.tests_with_variants),'按检查子树内容区分')+kpi('解析失败',fmt(errors),'失败文件保留错误与源文件定位');
 const q=[['检查归档重复出现（超出首份）',m.repeated_test_appearances],['被标记删除的甩头',m.deleted_impulses],['头速 / 眼速长度不一致',m.wave_mismatch],['存在空波形的甩头',m.empty_wave],['独立报告 GUID',m.unique_report_ids],['其他结构化明细记录',m.records],['文件扫描错误',m.scan_errors],['完整 TXT 数值序列标准化','尚未进行'],['检查增益换算','厂家倍率 ×0.01 / ×0.0001 已核对']];$('quality-list').innerHTML=q.map(([k,v])=>`<div class="quality-row"><span>${esc(k)}</span><b>${typeof v==='number'?fmt(v):esc(v)}</b></div>`).join('');dictionary();}
function dictionary(){const q=$('dict-search').value.toLowerCase(),cs=D.catalog.filter(r=>(r.kind+' '+r.field).toLowerCase().includes(q));$('dict-info').textContent=`共 ${fmt(cs.length)} 个匹配字段，显示前 120 项。出现次数按不同内容的 XML 统计，可能包含检查的多个版本。`;$('dict-table').innerHTML=cs.slice(0,120).map(r=>`<tr><td>${esc(r.kind)}</td><td>${esc(r.field)}</td><td>${fmt(r.occurrences)}</td><td>${r.occurrences?(100*r.numeric_count/r.occurrences).toFixed(1):0}%</td><td>${fmt(r.empty_count)}</td><td>${show(r.min_raw)} → ${show(r.max_raw)}</td></tr>`).join('');}
function scope(n){$('scope').textContent=`筛选 ${fmt(n)} / ${fmt(D.metrics.tests)} 项检查`;}
async function update(){if(['Lateral','LARP','RALP'].includes($('subtype').value))$('vhit-plane').value=$('subtype').value;page=0;return renderActive();}
async function renderActive(){
 const token=++viewRequest,tab=activeTab,el=$(tab);$('load-status').textContent='正在按当前筛选读取数据…';el.classList.add('is-loading');
 try{
  if(tab==='overview'){const r=await window.DataClient.get('/api/overview',window.DataClient.query());if(token!==viewRequest)return false;overviewStats=r;scope(r.tests);overview();}
  if(tab==='vhit'||tab==='relations'){
   const r=await window.DataClient.vhit();if(token!==viewRequest)return false;
   filtered=r.tests;D.tests=filtered;scope(r.scope_count);
   if(tab==='vhit'){await window.DataClient.ensureSaccades($('vhit-plane').value);if(token!==viewRequest)return false;vhit();}
   else await window.AssociationPanel.setTests(filtered);
  }
  if(tab==='explorer')await renderTable();
  if(tab==='quality'){const r=await window.DataClient.memo('/api/catalog',new URLSearchParams());if(token!==viewRequest)return false;D.catalog=r.catalog;$('scope').textContent='质量统计：全库 '+fmt(D.metrics.tests)+' 项';quality();}
  if(token!==viewRequest)return false;
  $('load-status').textContent='已按需加载 · 汇总不含逐条记录，检查明细按页读取。';return true;
 }catch(error){if(token===viewRequest)$('load-status').textContent=error.message+'。可点击“刷新数据”重试。';return false;}
 finally{if(token===viewRequest)el.classList.remove('is-loading');}
}
async function activateTab(tab){
 activeTab=tab;document.querySelectorAll('nav button,.tab').forEach(x=>x.classList.remove('active'));document.querySelector(`nav button[data-tab="${tab}"]`).classList.add('active');$(tab).classList.add('active');
 const titles={overview:'让归档成为可探索的数据。',vhit:'从平均指标，深入每一次甩头。',relations:'从单项指标，走向关联与核验。',explorer:'每项检查，都可以追溯。',quality:'先理解数据，再解释结果。'};$('title').textContent=titles[tab];return renderActive();
}
async function init(){
 await window.DataClient.bootstrap();
for(const y of D.filters.years.filter(x=>/^\d{4}$/.test(x)))$('year').add(new Option(y,y));for(const k of D.filters.kinds)$('kind').add(new Option(names[k]||k,k));for(const k of D.filters.subtypes)$('subtype').add(new Option(k,k));
 if(D.metrics.xml_sources<D.metrics.xml_inventory)document.querySelector('.header-badge').textContent=`提取中 ${fmt(D.metrics.xml_sources)} / ${fmt(D.metrics.xml_inventory)}`;
 const ext={};D.files.forEach(f=>ext[f.extension]=(ext[f.extension]||0)+f.count);$('filetypes').innerHTML=Object.entries(ext).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([e,n])=>`<span>${esc(e)} · ${fmt(n)}</span>`).join('');
 document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
 ['cohort','year','kind','subtype'].forEach(id=>$(id).addEventListener('change',update));$('reset').onclick=()=>{['year','kind','subtype'].forEach(id=>$(id).value='');$('cohort').value='basic';$('vhit-plane').value='Lateral';$('search').value='';$('flag').value='';update();};$('scaled').onchange=()=>renderActive();$('vhit-plane').onchange=()=>{if(['Lateral','LARP','RALP'].includes($('subtype').value))$('subtype').value=$('vhit-plane').value;update();};let searchTimer;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;renderActive();},180);};$('flag').onchange=()=>{page=0;renderActive();};$('prev').onclick=()=>{page--;renderActive();};$('next').onclick=()=>{page++;renderActive();};$('dict-search').oninput=dictionary;
 $('export').onclick=()=>{if(window.DataClient.exportTests)window.DataClient.exportTests(tableQuery()).catch(error=>{$('load-status').textContent=error.message;});else location.assign('/api/tests-export?'+tableQuery());};
 $('data-refresh').onclick=async()=>{window.DataClient.invalidate();window.TraceWorkbench.invalidate();try{await window.DataClient.bootstrap();$('generated').textContent='数据快照 '+D.generated.slice(0,16).replace('T',' ')+' UTC';await update();}catch(error){$('load-status').textContent=error.message;}};
 $('generated').textContent='提取视图更新 '+D.generated.slice(0,16).replace('T',' ')+' UTC';let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(renderActive,180);});await update();}
async function openTraceHash(){
 if(location.hash==='#associations'){await activateTab('relations');$('associations').scrollIntoView({block:'start'});}
 if(['#trace-workbench','#gain-saccades'].includes(location.hash)){await activateTab('vhit');$(location.hash.slice(1)).scrollIntoView({block:'start'});}
}
window.addEventListener('hashchange',openTraceHash);
window.addEventListener('trace:open-test',event=>inspectWave(event.detail.key));
window.addEventListener('trace:reset-library',()=>{['year','kind','subtype','search','flag'].forEach(id=>$(id).value='');$('cohort').value='all';update();});
init().then(openTraceHash).catch(error=>{$('load-status').textContent=error.message+'。请先构建本地缓存后刷新。';});
