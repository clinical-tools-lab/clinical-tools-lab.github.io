(function(){
  'use strict';
  const M=window.SignalMath,L=window.ExamLibrary,$=id=>document.getElementById(id);
  const C={head:'#16786b',eye:'#d48b47',left:'#4777b4',right:'#9466ab',deleted:'#9aa49e'};
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=2)=>M.finite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
  const short=s=>String(s||'').slice(2,12);
  let tests=[],testMap=new Map(),session=null,currentKey='',selectedKey='',sample=0,request=0,loadingKey='',initialized=false;
  const cache=new Map();let chartGeometry=null,preferredPlane='Lateral',fullSummary=null;
  const library={query:'',patient:'',mode:'all',sort:'date_desc',page:0,size:10};
  function representativeKeys(){if(window.DATA.representative_test_keys)return new Set(window.DATA.representative_test_keys);return new Set((window.WAVES||[]).map(w=>w.test_key));}
  function libraryRows(){return L.select(tests,{...library,representatives:representativeKeys()});}
  function settings(){return {head:$('trace-head').checked,eye:$('trace-eye').checked,summary:$('trace-summary').checked,deleted:$('trace-deleted').checked};}
  function visible(){return (session?.waves||[]).filter(w=>settings().deleted||w.deleted===false);}
  function selected(){return visible().find(w=>w.impulse_key===selectedKey)||null;}
  function ordinal(w){return (session?.waves||[]).findIndex(v=>v.impulse_key===w.impulse_key)+1;}
  function sideName(side){return side==='left'?'左刺激':side==='right'?'右刺激':'方向未记录';}
  function waveLabel(w){return `${sideName(w.side)} #${String(ordinal(w)).padStart(2,'0')} · 增益 ${fmt(w.gain_vor,4)}${w.deleted?' · 设备删除':''}`;}
  function empty(id,msg){$(id).innerHTML=`<div class="empty">${escape(msg)}</div>`;}
  function svgChart(id,range,n,height){
    const width=Math.max(260,$(id).clientWidth),h=height,p={l:49,r:15,t:22,b:34},[lo,hi]=range;
    const x=i=>p.l+i/Math.max(1,n-1)*(width-p.l-p.r),y=v=>p.t+(hi-v)/(hi-lo)*(h-p.t-p.b);
    let grid='';
    for(let i=0;i<5;i++){
      const value=lo+(hi-lo)*i/4,px=(n-1)*i/4;
      grid+=`<line x1="${p.l}" x2="${width-p.r}" y1="${y(value)}" y2="${y(value)}" class="gridline"/><text x="${p.l-8}" y="${y(value)+3}" text-anchor="end">${fmt(value,1)}</text>`;
      grid+=`<text x="${x(px)}" y="${h-14}" text-anchor="middle">${Math.round(px)}</text>`;
    }
    if(lo<=0&&hi>=0)grid+=`<line x1="${p.l}" x2="${width-p.r}" y1="${y(0)}" y2="${y(0)}" stroke="#a8b8ac" stroke-dasharray="3 4"/>`;
    return {width,h,p,x,y,grid,svg:body=>`<svg viewBox="0 0 ${width} ${h}" role="img" aria-label="${escape(id)}，横轴为原导出采样点索引">${grid}${body}</svg>`};
  }
  function attachSelection(container){
    container.querySelectorAll('[data-impulse]').forEach(el=>{
      const choose=()=>chooseWave(el.dataset.impulse);
      el.addEventListener('click',choose);
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
    });
  }
  function drawOverlay(side,range,n){
    const id='trace-overlay-'+side,ws=visible().filter(w=>w.side===side),s=settings();
    $('trace-count-'+side).textContent=`${ws.length} 条${ws.some(w=>w.deleted)?' · 含设备删除':''}`;
    if(!ws.length){empty(id,'该方向没有当前可显示的甩头');return;}
    if(!s.head&&!s.eye){empty(id,'请选择头速或眼速');return;}
    const g=svgChart(id,range,n,235);let body='';
    if(s.summary){
      for(const field of ['head','eye']){
        if(!s[field])continue;
        const summary=M.pointwise(ws,field),color=C[field];
        body+=`<path d="${M.band(summary,g.x,g.y)}" fill="${color}" opacity=".10"/>`;
        body+=`<path d="${M.path(summary.map(v=>v.median),g.x,g.y)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6 4"/>`;
      }
    }
    const ordered=[...ws.filter(w=>w.impulse_key!==selectedKey),...ws.filter(w=>w.impulse_key===selectedKey)];
    for(const wave of ordered){
      const focus=wave.impulse_key===selectedKey;let lines='';
      for(const field of ['head','eye']){
        if(!s[field])continue;const d=M.path(wave[field],g.x,g.y),color=wave.deleted?C.deleted:C[field];
        lines+=`<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${focus?1:.20}" stroke-width="${focus?2.8:1}" ${wave.deleted?'stroke-dasharray="3 4"':''}/>`;
        lines+=`<path d="${d}" fill="none" stroke="transparent" stroke-width="9" pointer-events="stroke"/>`;
      }
      body+=`<g class="trace-selectable" data-impulse="${escape(wave.impulse_key)}" tabindex="0" role="button" aria-label="选择 ${escape(waveLabel(wave))}"><title>${escape(waveLabel(wave))}</title>${lines}</g>`;
    }
    $(id).innerHTML=g.svg(body);attachSelection($(id));
  }
  function drawGain(){
    const id='trace-gain',ws=visible().filter(w=>M.finite(w.gain_vor)&&M.finite(M.peakHead(w).absolute));
    if(!ws.length){empty(id,'无可绘制增益的甩头');return;}
    const width=Math.max(260,$(id).clientWidth),h=190,p={l:49,r:15,t:17,b:38};
    const maxX=Math.max(1,...ws.map(w=>M.peakHead(w).absolute))*1.07;
    const lo=Math.min(0,...ws.map(w=>w.gain_vor)),hi=Math.max(1,...ws.map(w=>w.gain_vor))*1.08,span=hi-lo||1;
    const x=v=>p.l+v/maxX*(width-p.l-p.r),y=v=>p.t+(hi-v)/span*(h-p.t-p.b);let body='';
    for(let i=0;i<4;i++){
      const v=lo+span*i/3;body+=`<line x1="${p.l}" x2="${width-p.r}" y1="${y(v)}" y2="${y(v)}" class="gridline"/><text x="${p.l-7}" y="${y(v)+3}" text-anchor="end">${fmt(v)}</text><text x="${x(maxX*i/3)}" y="${h-19}" text-anchor="middle">${fmt(maxX*i/3,0)}</text>`;
    }
    body+=`<line x1="${p.l}" x2="${width-p.r}" y1="${y(1)}" y2="${y(1)}" stroke="#9ead9c" stroke-dasharray="5 4"/><text x="${width-p.r}" y="${y(1)-5}" text-anchor="end">增益 1 · 等比例参考</text>`;
    for(const w of ws){const focus=w.impulse_key===selectedKey,color=w.deleted?C.deleted:(C[w.side]||C.deleted);
      body+=`<circle data-impulse="${escape(w.impulse_key)}" tabindex="0" role="button" aria-label="选择 ${escape(waveLabel(w))}" cx="${x(M.peakHead(w).absolute)}" cy="${y(w.gain_vor)}" r="${focus?6:4}" fill="${w.deleted?'white':color}" stroke="${focus?'#183d36':color}" stroke-width="${focus?2.5:1}" class="trace-selectable"><title>${escape(waveLabel(w))} · 头速绝对峰值 ${fmt(M.peakHead(w).absolute)}</title></circle>`;
    }
    body+=`<text x="${width/2}" y="${h-2}" text-anchor="middle">头速绝对峰值（导出值）</text>`;
    $(id).innerHTML=`<svg role="img" aria-label="逐次甩头增益与头速绝对峰值，点击选择波形" viewBox="0 0 ${width} ${h}">${body}</svg>`;attachSelection($(id));
  }
  function drawCross(w){
    if(!w){empty('trace-xcorr','请选择一次甩头');$('trace-xcorr-note').textContent='';return;}
    const s=M.crossCorrelation(w.head,w.eye,20),width=Math.max(300,$('trace-xcorr').clientWidth),h=160,p={l:45,r:16,t:12,b:30},x=n=>p.l+(n+20)/40*(width-p.l-p.r),y=n=>p.t+(1-n)/2*(h-p.t-p.b);
    let body='';for(const v of [-1,0,1])body+=`<line class="gridline" x1="${p.l}" y1="${y(v)}" x2="${width-p.r}" y2="${y(v)}"/><text x="${p.l-8}" y="${y(v)+3}" text-anchor="end">${v}</text>`;
    for(const lag of [-20,-10,0,10,20])body+=`<text x="${x(lag)}" y="${h-11}" text-anchor="middle">${lag}</text>`;
    body+=`<path d="${M.path(s.curve.map(v=>v.value),i=>x(s.curve[i].lag),y)}" fill="none" stroke="#16786b" stroke-width="2"/>`;
    if(s.best)body+=`<circle cx="${x(s.best.lag)}" cy="${y(s.best.value)}" r="4" fill="#c57943"/>`;
    $('trace-xcorr').innerHTML=`<svg role="img" aria-label="头速和眼速数组归一化互相关，横轴为采样移位" viewBox="0 0 ${width} ${h}">${body}</svg>`;
    $('trace-xcorr-note').textContent=`零移位 r=${fmt(s.zero?.value,3)}。`+(s.best?`搜索范围内最大 |r|：移位 ${s.best.lag>0?'+':''}${s.best.lag} 个采样，r=${fmt(s.best.value,3)}，有效重叠 ${s.best.n} 点${Math.abs(s.best.lag)===20?'（落在搜索边界）':''}。`:'有效非恒定重叠不足，无法计算。');
  }
  function drawDetail(){
    const w=selected(),s=settings();chartGeometry=null;
    drawCross(w);
    if(!w){empty('trace-detail','没有可显示的单次甩头');$('trace-detail-title').textContent='单次甩头细节';$('trace-sample').disabled=true;$('trace-export').disabled=true;$('trace-prev').disabled=true;$('trace-next').disabled=true;$('trace-metrics').innerHTML='';$('trace-readout').textContent='';return;}
    $('trace-detail-title').textContent=waveLabel(w);$('trace-sample').disabled=false;$('trace-export').disabled=false;
    const keys=visible().map(w=>w.impulse_key),pos=keys.indexOf(selectedKey);$('trace-prev').disabled=pos<=0;$('trace-next').disabled=pos>=keys.length-1;
    const peak=M.peakHead(w),n=Math.max(w.head.length,w.eye.length);sample=Math.max(0,Math.min(sample,n-1));$('trace-sample').max=String(n-1);$('trace-sample').value=String(sample);
    const metrics=[['设备逐次增益',fmt(w.gain_vor,4)],['头速绝对峰值',fmt(peak.absolute)],['Covert / Overt 次数',`${fmt(w.covert_count,0)} / ${fmt(w.overt_count,0)}`],['状态',w.deleted?'设备删除 · 审计':w.deleted===false?'设备未删除':'删除状态未记录']];
    $('trace-metrics').innerHTML=metrics.map(([label,value])=>`<div><small>${escape(label)}</small><strong>${escape(value)}</strong></div>`).join('');
    if(!s.head&&!s.eye){empty('trace-detail','请选择头速或眼速');updateSample(sample);return;}
    const g=svgChart('trace-detail',M.extent(visible()),n,270);let body='';
    for(const field of ['head','eye'])if(s[field])body+=`<path d="${M.path(w[field],g.x,g.y)}" fill="none" stroke="${C[field]}" stroke-width="2.3"/>`;
    body+=`<g class="trace-cursor" pointer-events="none"><line data-cursor="line" y1="${g.p.t}" y2="${g.h-g.p.b}" stroke="#617b70" stroke-dasharray="3 3"/><circle data-cursor="head" r="4" fill="${C.head}" stroke="white"/><circle data-cursor="eye" r="4" fill="${C.eye}" stroke="white"/></g>`;
    body+=`<rect class="trace-hit-area" x="${g.p.l}" y="${g.p.t}" width="${g.width-g.p.l-g.p.r}" height="${g.h-g.p.t-g.p.b}" fill="transparent"/>`;
    $('trace-detail').innerHTML=g.svg(body);chartGeometry=g;
    const target=$('trace-detail').querySelector('.trace-hit-area');
    const move=event=>{const rect=target.ownerSVGElement.getBoundingClientRect(),vx=(event.clientX-rect.left)/rect.width*g.width;updateSample(Math.round((vx-g.p.l)/(g.width-g.p.l-g.p.r)*(n-1)));};
    target.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)move(e);});target.addEventListener('pointerdown',move);updateSample(sample);
  }
  function updateSample(index){
    const w=selected();if(!w)return;
    const n=Math.max(w.head.length,w.eye.length);sample=Math.max(0,Math.min(index,n-1));$('trace-sample').value=String(sample);
    $('trace-readout').innerHTML=`<span>采样点 <b>${sample} / ${n-1}</b></span><span class="trace-head-text">头速 <b>${fmt(w.head[sample],3)}</b></span><span class="trace-eye-text">眼速 <b>${fmt(w.eye[sample],3)}</b></span>`;
    if(!chartGeometry)return;const g=chartGeometry,el=$('trace-detail'),line=el.querySelector('[data-cursor="line"]');line.setAttribute('x1',g.x(sample));line.setAttribute('x2',g.x(sample));
    for(const field of ['head','eye']){const dot=el.querySelector(`[data-cursor="${field}"]`),value=w[field][sample];dot.style.display=settings()[field]&&M.finite(value)?'':'none';if(M.finite(value)){dot.setAttribute('cx',g.x(sample));dot.setAttribute('cy',g.y(value));}}
  }
  function chooseWave(key){
    const w=visible().find(w=>w.impulse_key===key);if(!w)return;
    const restore=document.activeElement?.hasAttribute('data-impulse');selectedKey=key;sample=M.peakHead(w).index??0;renderSession();if(restore)$('trace-ledger').querySelector('.selected')?.focus({preventScroll:true});
  }
  function renderLedger(){
    $('trace-ledger').innerHTML=visible().map(w=>`<button type="button" class="trace-pill ${w.impulse_key===selectedKey?'selected':''} ${w.deleted?'deleted':''}" data-impulse="${escape(w.impulse_key)}" aria-pressed="${w.impulse_key===selectedKey}" title="${escape(waveLabel(w))}"><span class="trace-side-dot" style="background:${C[w.side]||C.deleted}"></span>${w.side==='left'?'L':w.side==='right'?'R':'?'} #${String(ordinal(w)).padStart(2,'0')}<b>${fmt(w.gain_vor,3)}</b>${w.deleted?'<small>删除</small>':''}</button>`).join('')||'<p class="caption">当前没有可显示的甩头。</p>';
    attachSelection($('trace-ledger'));
  }
  function renderSession(){
    if(!session)return;
    const ws=visible();if(!ws.some(w=>w.impulse_key===selectedKey)){selectedKey=ws[0]?.impulse_key||'';sample=ws.length?(M.peakHead(ws[0]).index??0):0;}
    const t=testMap.get(currentKey),gain=session.reported_gain||{left:t?.left_gain_vor,right:t?.right_gain_vor};
    $('trace-session-meta').innerHTML=`<span>${escape(session.date)} · ${escape(session.test_type)}</span><span>身份化名 ${short(session.patient_key)}</span><span>设备检查均值 L ${fmt(gain.left)} / R ${fmt(gain.right)}</span>${session.calibration_default?'<span class="trace-review">默认校准标记</span>':''}${session.test_deleted?'<span class="trace-review">设备删除检查 · 审计</span>':''}`;
    $('trace-status').textContent=`${session.offline?'离线代表波形 · ':''}当前显示 ${ws.length} / ${session.total_impulses} 次甩头；设备删除 ${session.device_deleted} 次${session.excluded_unusable?`；空或不等长数组 ${session.excluded_unusable} 次未绘制`:''}${session.truncated?'；仅显示部分记录':''}。`;
    $('trace-status').classList.toggle('trace-status-warning',Boolean(session.offline||session.truncated));
    const range=M.extent(ws),n=Math.max(1,...ws.map(w=>Math.max(w.head.length,w.eye.length)));
    drawOverlay('left',range,n);drawOverlay('right',range,n);drawGain();drawDetail();renderLedger();
  }
  function renderLibrary(){
    fullSummary=window.DATA.vhit_totals||L.summary(window.DATA.tests.filter(t=>t.kind==='VW_HITest'));
    $('trace-library-totals').innerHTML=[['全库导出身份',fullSummary.identities],['全库 vHIT 检查',fullSummary.tests],['全库甩头记录',fullSummary.impulses]].map(([label,n])=>`<div><small>${label}</small><strong>${fmt(n,0)}</strong></div>`).join('');
    const rows=libraryRows(),page=L.paginate(rows,library.page,library.size),eligible=L.summary(tests),matched=L.summary(rows);library.page=page.page;
    $('trace-library-mode-all').setAttribute('aria-pressed',String(library.mode==='all'));$('trace-library-mode-representative').setAttribute('aria-pressed',String(library.mode==='representative'));
    $('trace-library-scope').textContent=`当前页面筛选：${fmt(eligible.tests,0)} 项检查 / ${fmt(eligible.identities,0)} 个标识。${library.mode==='representative'?'代表样本模式 · ':''}列表匹配 ${fmt(rows.length,0)} 项 / ${fmt(matched.identities,0)} 个标识${library.patient?' · 仅身份 '+short(library.patient):''}。`;
    $('trace-library-person-clear').hidden=!library.patient;
    $('trace-library-body').innerHTML=page.items.map(t=>`<tr class="${t.test_key===currentKey?'trace-library-current':''}"><td>${escape(t.date||'未记录')}<small title="${escape(t.test_key)}">检查 ${short(t.test_key)}</small></td><td><button type="button" class="trace-person-button" data-patient="${escape(t.patient_key)}" title="仅此身份：${escape(t.patient_key)}">${short(t.patient_key)}</button></td><td>${escape(t.test_type)}</td><td>${fmt(t.left_gain_vor)} / ${fmt(t.right_gain_vor)}${t.qc_flags?.length?`<small class="qc-warning">${escape(t.qc_flags.join(' · '))}</small>`:''}</td><td>${fmt(t.impulses,0)}<small>设备未删除 ${fmt(t.active_impulses,0)}</small></td><td><button type="button" class="quiet" data-open-exam="${escape(t.test_key)}">${t.test_key===currentKey?'当前打开':'查看波形 →'}</button></td></tr>`).join('')||'<tr><td colspan="6">没有匹配检查。可清除搜索、身份筛选，或点击“浏览全库”。</td></tr>';
    $('trace-library-page').textContent=`第 ${fmt(page.page+1,0)} / ${fmt(page.pages,0)} 页 · ${fmt(page.start,0)}–${fmt(page.end,0)} / ${fmt(page.total,0)} 项`;
    $('trace-library-prev').disabled=page.page===0;$('trace-library-next').disabled=page.page>=page.pages-1;
    $('trace-library-body').querySelectorAll('[data-open-exam]').forEach(button=>button.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('trace:open-test',{detail:{key:button.dataset.openExam}}))));
    $('trace-library-body').querySelectorAll('[data-patient]').forEach(button=>button.addEventListener('click',()=>{library.patient=button.dataset.patient;library.query='';$('trace-library-search').value='';library.page=0;renderLibrary();}));
    return rows;
  }
  function fallback(key){
    const t=testMap.get(key),waves=(window.WAVES||[]).filter(w=>w.test_key===key).map(w=>({...w,deleted:false}));
    if(!t||!waves.length)return null;
    return {test_key:key,patient_key:t.patient_key,date:t.date,test_type:t.test_type,reported_gain:{left:t.left_gain_vor,right:t.right_gain_vor},
      calibration_default:t.calibration_default,total_impulses:t.impulses,device_deleted:t.deleted_impulses,excluded_unusable:0,truncated:t.impulses>waves.length,offline:true,waves};
  }
  async function load(key){
    if(!key)return;
    const token=++request;currentKey=key;loadingKey=key;session=null;renderLibrary();$('trace-xcorr-note').textContent='';$('trace-retry').hidden=true;
    $('trace-status').textContent='正在读取该项检查的完整甩头…';$('trace-session-meta').textContent='';
    for(const id of ['trace-overlay-left','trace-overlay-right','trace-gain','trace-detail','trace-xcorr'])empty(id,'读取中…');
    $('trace-ledger').innerHTML='';$('trace-metrics').innerHTML='';$('trace-readout').textContent='';$('trace-sample').disabled=true;$('trace-export').disabled=true;$('trace-prev').disabled=true;$('trace-next').disabled=true;
    let loaded=cache.get(key);
    if(!loaded){
      try{
        if(location.protocol==='file:')throw Error('offline');
        if(window.DataClient?.waveSession){loaded=await window.DataClient.waveSession(key);}
        else {
        const response=await fetch('/api/wave-session?test_key='+encodeURIComponent(key),{cache:'no-store',credentials:'same-origin'});
        if(response.status===401){location.assign('/login?next='+encodeURIComponent(location.pathname+location.search+location.hash));throw Error('Authentication required');}
        if(!response.ok)throw Error('HTTP '+response.status);
        loaded=await response.json();}
        if(!Array.isArray(loaded.waves))throw Error('invalid payload');
        cache.set(key,loaded);if(cache.size>24)cache.delete(cache.keys().next().value);
      }catch(error){loaded=fallback(key);}
    }
    if(token!==request)return;loadingKey='';
    if(!loaded){for(const id of ['trace-overlay-left','trace-overlay-right','trace-gain','trace-detail','trace-xcorr'])empty(id,'该检查的完整波形暂不可用');$('trace-status').textContent='完整波形暂不可用。请检查本地服务或网络后重试。';$('trace-retry').hidden=false;return;}
    session=loaded;selectedKey='';renderSession();
  }
  function init(){
    if(initialized)return;initialized=true;
    let searchTimer;
    $('trace-library-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{library.query=$('trace-library-search').value;library.page=0;renderLibrary();},150);});
    $('trace-library-sort').addEventListener('change',()=>{library.sort=$('trace-library-sort').value;library.page=0;renderLibrary();});
    $('trace-library-size').addEventListener('change',()=>{library.size=Number($('trace-library-size').value);library.page=0;renderLibrary();});
    for(const mode of ['all','representative'])$('trace-library-mode-'+mode).addEventListener('click',()=>{library.mode=mode;library.page=0;renderLibrary();});
    for(const [id,delta] of [['trace-library-prev',-1],['trace-library-next',1]])$(id).addEventListener('click',()=>{library.page+=delta;renderLibrary();$('trace-library-body').closest('.table-wrap').scrollTop=0;});
    $('trace-library-person-clear').addEventListener('click',()=>{library.patient='';library.page=0;renderLibrary();});
    $('trace-library-all').addEventListener('click',()=>{library.query='';library.patient='';library.mode='all';library.page=0;$('trace-library-search').value='';window.dispatchEvent(new CustomEvent('trace:reset-library'));});
    for(const id of ['trace-head','trace-eye','trace-summary','trace-deleted'])$(id).addEventListener('change',renderSession);
    $('trace-sample').addEventListener('input',()=>updateSample(Number($('trace-sample').value)));
    for(const [id,delta] of [['trace-prev',-1],['trace-next',1]])$(id).addEventListener('click',()=>{const ws=visible(),i=ws.findIndex(w=>w.impulse_key===selectedKey);if(ws[i+delta])chooseWave(ws[i+delta].impulse_key);});
    $('trace-retry').addEventListener('click',()=>{cache.delete(currentKey);load(currentKey);});
    $('trace-export').addEventListener('click',()=>{
      const w=selected();if(!w)return;
      const rows=['test_key,impulse_key,direction,device_deleted,gain_raw,gain_vor,sample_index,head_export_value,eye_export_value',...Array.from({length:Math.max(w.head.length,w.eye.length)},(_,i)=>[w.test_key,w.impulse_key,w.side,w.deleted??'',w.gain_raw??'',w.gain_vor??'',i,w.head[i]??'',w.eye[i]??''].join(','))];
      const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8;'})),link=document.createElement('a');
      link.href=url;link.download='impulse-'+w.impulse_key+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
  }
  function setTests(next,plane='Lateral'){
    init();const changed=tests.length!==next.length||next.some((t,i)=>t.test_key!==tests[i]?.test_key);if(changed)library.page=0;
    tests=next;preferredPlane=plane;testMap=new Map(tests.map(t=>[t.test_key,t]));
    if(!testMap.has(currentKey)||(preferredPlane&&testMap.get(currentKey)?.test_type!==preferredPlane)){currentKey='';selectedKey='';session=null;request++;loadingKey='';}
    renderLibrary();
    if(!tests.length){$('trace-retry').hidden=true;for(const id of ['trace-overlay-left','trace-overlay-right','trace-gain','trace-detail','trace-xcorr'])empty(id,'当前筛选下没有检查');$('trace-status').textContent='当前筛选下没有可用的 vHIT 检查，可点击“浏览全库”清除筛选。';$('trace-session-meta').textContent='';$('trace-xcorr-note').textContent='';$('trace-ledger').innerHTML='';$('trace-metrics').innerHTML='';$('trace-readout').textContent='';$('trace-count-left').textContent='0 条';$('trace-count-right').textContent='0 条';$('trace-sample').disabled=true;$('trace-export').disabled=true;$('trace-prev').disabled=true;$('trace-next').disabled=true;chartGeometry=null;return;}
    if(!currentKey){const ordered=L.select(tests);currentKey=(ordered.find(t=>(!plane||t.test_type===plane)&&t.active_impulses>0)||ordered.find(t=>!plane||t.test_type===plane)||ordered[0]).test_key;}
    if(session)renderSession();else if(loadingKey!==currentKey)load(currentKey);
  }
  async function openTest(key){
    init();if(!testMap.has(key))return false;
    if(library.mode==='representative'&&!representativeKeys().has(key))library.mode='all';
    let rows=libraryRows(),position=rows.findIndex(t=>t.test_key===key);
    if(position<0){library.query='';library.patient='';$('trace-library-search').value='';rows=libraryRows();position=rows.findIndex(t=>t.test_key===key);}
    library.page=Math.max(0,Math.floor(position/library.size));await load(key);return Boolean(session);
  }
  function invalidate(){cache.clear();session=null;loadingKey='';selectedKey='';fullSummary=null;request++;}
  window.TraceWorkbench={setTests,openTest,invalidate};
})();
