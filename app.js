const API = 'https://api.jolpi.ca/ergast/f1';
const state = { drivers: [], teams: [], races: [], winners: [], season: new Date().getFullYear(), filter: 'all', weekendCache: new Map() };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate = (date) => new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(date);
const fmtRaceDate = (date) => new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date);
const fmtSession = (date) => new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date);
const raceDateTime = r => new Date(`${r.date}T${r.time || '12:00:00Z'}`);
const sessionDateTime = s => new Date(`${s.date}T${s.time || '12:00:00Z'}`);
const setStatus = (kind,text) => { $('#statusDot').className = `status-dot ${kind}`; $('#statusText').textContent = text; };
const toast = (text) => { const el=$('#toast'); el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); };

async function getJson(path){
  const res = await fetch(`${API}/${path}`, {cache:'no-store'});
  if(!res.ok) throw new Error(`Data service returned ${res.status}`);
  return res.json();
}
function parseStandings(data,key){
  const list=data?.MRData?.StandingsTable?.StandingsLists?.[0];
  state.season = Number(list?.season || state.season);
  return list?.[key] || [];
}
function parseRaces(data){ return data?.MRData?.RaceTable?.Races || []; }
function winnerMap(){ return new Map(state.winners.map(r => [String(r.round), r])); }
function driverFullName(d){ return `${d.Driver.givenName} ${d.Driver.familyName}`; }
function constructorOfDriver(d){ return d.Constructors?.[0]?.name || '—'; }
function teamColor(name=''){
  const n=name.toLowerCase();
  if(n.includes('ferrari')) return '#e8002d'; if(n.includes('mercedes')) return '#27f4d2'; if(n.includes('mclaren')) return '#ff8700';
  if(n.includes('red bull')) return '#3671c6'; if(n.includes('aston')) return '#229971'; if(n.includes('alpine')) return '#ff87bc';
  if(n.includes('williams')) return '#64c4ff'; if(n.includes('haas')) return '#b6babd'; if(n.includes('audi')) return '#f50537';
  if(n.includes('rb')) return '#6692ff'; if(n.includes('cadillac')) return '#d4d4d4'; return '#2495ff';
}
function upcomingRace(){ const now=Date.now(); return state.races.find(r => raceDateTime(r).getTime() > now) || null; }
function latestCompletedRace(){
  if(state.winners.length) return state.winners[state.winners.length-1];
  return [...state.races].reverse().find(r => raceDateTime(r).getTime() < Date.now());
}
function countdown(target){
  const ms=Math.max(0,target-Date.now()), days=Math.floor(ms/864e5), hrs=Math.floor(ms%864e5/36e5), mins=Math.floor(ms%36e5/6e4), secs=Math.floor(ms%6e4/1e3);
  return [days,hrs,mins,secs];
}
function raceSessions(r){
  const defs=[
    ['FirstPractice','Practice 1','practice'],['SecondPractice','Practice 2','practice'],['ThirdPractice','Practice 3','practice'],
    ['SprintQualifying','Sprint Qualifying','qualifying'],['SprintShootout','Sprint Shootout','qualifying'],['Sprint','Sprint','sprint'],
    ['Qualifying','Qualifying','qualifying'],['Race','Race','race']
  ];
  const sessions=[];
  defs.forEach(([key,label,type])=>{
    const raw=key==='Race'?{date:r.date,time:r.time}:r[key];
    if(raw?.date) sessions.push({key,label,type,date:sessionDateTime(raw)});
  });
  return sessions.sort((a,b)=>a.date-b.date);
}
function renderNextRace(){
  const r=upcomingRace(), el=$('#nextRaceCard');
  if(!r){el.innerHTML='<p class="eyebrow">SEASON COMPLETE</p><h2>Chequered flag.</h2><p class="venue">The final race of the season has been completed.</p>';return;}
  const d=raceDateTime(r), [days,hrs,mins,secs]=countdown(d);
  const nextSession=raceSessions(r).find(s=>s.date.getTime()>Date.now());
  el.innerHTML=`<div class="race-kicker"><span>NEXT RACE</span><span class="round-badge">ROUND ${esc(r.round)}</span></div><h2>${esc(r.raceName)}</h2><p class="venue">${esc(r.Circuit.circuitName)} · ${esc(r.Circuit.Location.locality)}, ${esc(r.Circuit.Location.country)}</p><div class="countdown"><div><b>${days}</b><span>DAYS</span></div><div><b>${String(hrs).padStart(2,'0')}</b><span>HOURS</span></div><div><b>${String(mins).padStart(2,'0')}</b><span>MIN</span></div><div><b>${String(secs).padStart(2,'0')}</b><span>SEC</span></div></div><div class="race-time">${nextSession?`Next session · ${esc(nextSession.label)} · ${esc(fmtSession(nextSession.date))}`:`Race start · ${esc(fmtSession(d))}`}</div><button class="weekend-btn" type="button" data-race-round="${esc(r.round)}">Open Weekend Hub →</button>`;
}
function renderLeaderStrip(){
  const d=state.drivers[0], t=state.teams[0], nr=upcomingRace(), completed=state.winners.length;
  $('#leaderStrip').innerHTML=`<div class="mini-stat"><small>Drivers' Leader</small><strong>${d?esc(driverFullName(d)):'—'}</strong><em>${d?esc(d.points):'0'} PTS</em></div><div class="mini-stat"><small>Constructors' Leader</small><strong>${t?esc(t.Constructor.name):'—'}</strong><em>${t?esc(t.points):'0'} PTS</em></div><div class="mini-stat"><small>Races Complete</small><strong>${completed} / ${state.races.length}</strong><em>${state.races.length-completed} TO GO</em></div><div class="mini-stat"><small>Next Stop</small><strong>${nr?esc(nr.Circuit.Location.country):'Season complete'}</strong><em>${nr?esc(fmtRaceDate(raceDateTime(nr))):'—'}</em></div>`;
}
function standingRows(items,type='driver',limit){
  return items.slice(0,limit||items.length).map(x=> type==='driver' ? `<div class="standing-row"><div class="pos">${esc(x.position)}</div><div class="competitor"><b>${esc(driverFullName(x))}</b><small>${esc(constructorOfDriver(x))}</small></div><div class="points">${esc(x.points)}<small>PTS</small></div></div>` : `<div class="standing-row"><div class="pos">${esc(x.position)}</div><div class="competitor"><b>${esc(x.Constructor.name)}</b><small>${esc(x.Constructor.nationality)}</small></div><div class="points">${esc(x.points)}<small>PTS</small></div></div>`).join('');
}
function renderHomeStandings(){ $('#homeDrivers').innerHTML=standingRows(state.drivers,'driver',5); $('#homeTeams').innerHTML=standingRows(state.teams,'team',5); }
function renderDriverTable(){
  $('#driverTable').innerHTML=`<div class="table-row header"><span>Pos</span><span>Driver</span><span>Constructor</span><span>Wins</span><span>Points</span></div>`+state.drivers.map(d=>`<div class="table-row"><span class="num">${esc(d.position)}</span><span class="driver-name"><i class="team-accent" style="background:${teamColor(constructorOfDriver(d))}"></i>${esc(driverFullName(d))}<small>${esc(d.Driver.nationality)}</small></span><span>${esc(constructorOfDriver(d))}</span><span>${esc(d.wins)}</span><span class="points">${esc(d.points)}</span></div>`).join('');
}
function renderTeams(){
  $('#teamCards').innerHTML=state.teams.map(t=>`<article class="team-card" style="border-left:4px solid ${teamColor(t.Constructor.name)}"><span class="team-rank">P${esc(t.position)} · ${esc(t.Constructor.nationality)}</span><h3>${esc(t.Constructor.name)}</h3><div class="team-meta"><div><b>${esc(t.points)}</b><small>POINTS</small></div><div><b>${esc(t.wins)}</b><small>WINS</small></div></div></article>`).join('');
}
function renderWinners(){
  $('#winnerGrid').innerHTML=state.winners.map(r=>{ const result=r.Results?.[0]; return `<article class="winner-card"><div class="winner-round"><span>Round ${esc(r.round)}</span><span>${esc(fmtRaceDate(raceDateTime(r)))}</span></div><h3>${esc(r.raceName)}</h3><p class="driver-win">${esc(result?`${result.Driver.givenName} ${result.Driver.familyName}`:'Winner unavailable')}</p><p>${esc(result?.Constructor?.name||'')} · ${esc(r.Circuit.circuitName)}</p><button class="card-detail-btn" type="button" data-race-round="${esc(r.round)}">Weekend details →</button></article>`; }).join('') || '<div class="error-box"><b>No race winners yet.</b>The season has not recorded a completed Grand Prix.</div>';
}
function renderLatestPodium(){
  const r=latestCompletedRace(), el=$('#latestPodium'); if(!r){el.innerHTML='<p>No completed race yet.</p>';return;}
  const results=r.Results || [];
  el.innerHTML=`<div class="podium-title"><div><h3>${esc(r.raceName)}</h3><p>${esc(r.Circuit.circuitName)} · ${esc(fmtDate(raceDateTime(r)))}</p></div><span class="season-chip">ROUND ${esc(r.round)}</span></div><div class="podium">${[1,0,2].map((idx)=>{const x=results[idx]; const cls=idx===0?'first':idx===1?'second':'third'; const pos=idx+1; return x?`<div class="podium-place ${cls}"><span class="medal">P${pos}</span><h4>${esc(x.Driver.givenName)} ${esc(x.Driver.familyName)}</h4><p>${esc(x.Constructor.name)} · ${esc(x.points)} pts</p></div>`:''}).join('')}</div><button class="weekend-btn inline-weekend" type="button" data-race-round="${esc(r.round)}">Open full weekend →</button>`;
}
function renderCalendar(){
  const wins=winnerMap(), now=Date.now();
  const filtered=state.races.filter(r=>{const completed=wins.has(String(r.round)) || raceDateTime(r).getTime()<now; return state.filter==='all'||(state.filter==='completed'&&completed)||(state.filter==='upcoming'&&!completed);});
  $('#calendarGrid').innerHTML=filtered.map(r=>{const w=wins.get(String(r.round)); const result=w?.Results?.[0]; const completed=!!w || raceDateTime(r).getTime()<now; const loc=r.Circuit.Location; const sessionCount=raceSessions(r).length; return `<article class="race-card ${completed?'completed':''}"><div class="round-box"><small>ROUND</small><b>${esc(r.round)}</b></div><div><h3>${esc(r.raceName)}</h3><p>${esc(r.Circuit.circuitName)}</p><p>${esc(loc.locality)}, ${esc(loc.country)}</p>${result?`<p class="winner-tag">Winner · ${esc(result.Driver.givenName)} ${esc(result.Driver.familyName)}</p>`:''}<p class="session-count">${sessionCount} scheduled sessions</p><button class="card-detail-btn" type="button" data-race-round="${esc(r.round)}">Weekend details →</button></div><div class="race-date"><strong>${esc(fmtRaceDate(raceDateTime(r)))}</strong><p>${completed?'Completed':'Upcoming'}</p></div></article>`;}).join('') || '<div class="error-box">No races match this filter.</div>';
}
function renderSeasonLabels(){
  $('#seasonLabel').textContent=`${state.season} SEASON`; ['driver','team','winner','calendar'].forEach(x=>$(`#${x}SeasonChip`).textContent=state.season);
}
function renderAll(){ renderSeasonLabels();renderNextRace();renderLeaderStrip();renderHomeStandings();renderDriverTable();renderTeams();renderWinners();renderLatestPodium();renderCalendar(); }
function showError(err){
  setStatus('error','Offline'); toast('Unable to refresh live F1 data');
  const msg=`<div class="error-box"><b>Live data is temporarily unavailable.</b>${esc(err.message)}. Check your connection or try Refresh Data.</div>`;
  ['#homeDrivers','#homeTeams','#driverTable','#teamCards','#winnerGrid','#calendarGrid','#latestPodium'].forEach(s=>$(s).innerHTML=msg);
}
async function loadData(manual=false){
  setStatus('','Syncing'); if(manual) toast('Refreshing championship data…');
  try{
    const [drivers,teams,winners,schedule]=await Promise.all([
      getJson('current/driverstandings.json'), getJson('current/constructorstandings.json'), getJson('current/results/1.json?limit=100'), getJson('current.json?limit=100')
    ]);
    state.drivers=parseStandings(drivers,'DriverStandings'); state.teams=parseStandings(teams,'ConstructorStandings'); state.winners=parseRaces(winners); state.races=parseRaces(schedule);
    renderAll(); setStatus('online','Live'); $('#lastUpdated').textContent=`Updated ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date())}`; if(manual) toast('F1 data refreshed');
  }catch(err){ console.error(err); showError(err); }
}
function switchView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.dataset.viewPanel===name)); $$('.nav-link').forEach(n=>n.classList.toggle('active',n.dataset.view===name)); window.scrollTo({top:0,behavior:'smooth'});
}
function resultRows(items, mode='race'){
  if(!items?.length) return '<p class="no-results">Results will appear here after the session is completed.</p>';
  return `<div class="weekend-results">${items.slice(0,10).map(x=>{
    const driver=x.Driver?`${x.Driver.givenName} ${x.Driver.familyName}`:'—';
    const detail=mode==='qualifying' ? (x.Q3||x.Q2||x.Q1||'—') : (x.Time?.time || x.status || '—');
    return `<div class="weekend-result-row"><b>P${esc(x.position)}</b><span><strong>${esc(driver)}</strong><small>${esc(x.Constructor?.name||'')}</small></span><em>${esc(detail)}</em></div>`;
  }).join('')}</div>`;
}
async function getWeekendData(round){
  const key=`${state.season}-${round}`;
  if(state.weekendCache.has(key)) return state.weekendCache.get(key);
  const paths=[
    ['race',`${state.season}/${round}/results.json?limit=100`],
    ['qualifying',`${state.season}/${round}/qualifying.json?limit=100`],
    ['sprint',`${state.season}/${round}/sprint.json?limit=100`]
  ];
  const settled=await Promise.allSettled(paths.map(([,path])=>getJson(path)));
  const data={};
  settled.forEach((res,i)=>{ if(res.status==='fulfilled') data[paths[i][0]]=parseRaces(res.value)[0]||null; });
  state.weekendCache.set(key,data);
  return data;
}
function buildSessionTimeline(r){
  const now=Date.now();
  return raceSessions(r).map(s=>{
    const status=s.date.getTime()<now?'complete':(s.date.getTime()-now<36e5?'live':'upcoming');
    return `<div class="session-row ${status}"><span class="session-dot"></span><div><strong>${esc(s.label)}</strong><small>${esc(fmtSession(s.date))}</small></div><em>${status==='complete'?'Complete':status==='live'?'Starting soon':'Upcoming'}</em></div>`;
  }).join('');
}
async function openRaceWeekend(round){
  const r=state.races.find(x=>String(x.round)===String(round)) || state.winners.find(x=>String(x.round)===String(round));
  if(!r) return;
  const modal=$('#raceModal'), content=$('#raceModalContent'), loc=r.Circuit.Location;
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  const maps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.lat},${loc.long}`)}`;
  content.innerHTML=`<p class="eyebrow">${esc(state.season)} · ROUND ${esc(r.round)}</p><h2 id="raceModalTitle">${esc(r.raceName)}</h2><p class="modal-venue">${esc(r.Circuit.circuitName)} · ${esc(loc.locality)}, ${esc(loc.country)}</p><div class="weekend-hero-meta"><div><small>RACE DAY</small><strong>${esc(fmtSession(raceDateTime(r)))}</strong></div><div><small>COORDINATES</small><strong>${esc(loc.lat)}, ${esc(loc.long)}</strong></div><a href="${maps}" target="_blank" rel="noopener">Open venue map ↗</a></div><div class="weekend-layout"><section><div class="modal-section-head"><p class="eyebrow">WEEKEND TIMETABLE</p><h3>Session schedule</h3></div><div class="session-timeline">${buildSessionTimeline(r)}</div></section><section><div class="modal-section-head"><p class="eyebrow">CLASSIFICATIONS</p><h3>Loading results…</h3></div><div class="skeleton tall"></div></section></div>`;
  try{
    const data=await getWeekendData(round);
    const classifications=content.querySelector('.weekend-layout section:nth-child(2)');
    const raceResults=data.race?.Results||[];
    const qualifying=data.qualifying?.QualifyingResults||[];
    const sprint=data.sprint?.SprintResults||[];
    classifications.innerHTML=`<div class="modal-section-head"><p class="eyebrow">CLASSIFICATIONS</p><h3>Weekend results</h3></div><div class="result-tabs"><button class="result-tab active" data-result-tab="race">Race</button><button class="result-tab" data-result-tab="qualifying">Qualifying</button>${r.Sprint?'<button class="result-tab" data-result-tab="sprint">Sprint</button>':''}</div><div class="result-panel active" data-result-panel="race">${resultRows(raceResults,'race')}</div><div class="result-panel" data-result-panel="qualifying">${resultRows(qualifying,'qualifying')}</div>${r.Sprint?`<div class="result-panel" data-result-panel="sprint">${resultRows(sprint,'sprint')}</div>`:''}`;
  }catch(err){
    const classifications=content.querySelector('.weekend-layout section:nth-child(2)');
    classifications.innerHTML='<div class="error-box"><b>Session classifications unavailable.</b>The main championship dashboard is still live.</div>';
  }
}
function closeRaceWeekend(){
  const modal=$('#raceModal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open');
}

$$('.nav-link').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.jump)));
$$('.filter-btn').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filter; $$('.filter-btn').forEach(x=>x.classList.toggle('active',x===b)); renderCalendar();}));
$('#refreshBtn').addEventListener('click',()=>loadData(true));
document.addEventListener('click',(e)=>{
  const raceBtn=e.target.closest('[data-race-round]'); if(raceBtn) openRaceWeekend(raceBtn.dataset.raceRound);
  if(e.target.closest('[data-close-race-modal]')) closeRaceWeekend();
  const tab=e.target.closest('[data-result-tab]');
  if(tab){ const root=tab.closest('section'); root.querySelectorAll('.result-tab').forEach(x=>x.classList.toggle('active',x===tab)); root.querySelectorAll('.result-panel').forEach(x=>x.classList.toggle('active',x.dataset.resultPanel===tab.dataset.resultTab)); }
});
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeRaceWeekend(); });
setInterval(renderNextRace,1000); setInterval(()=>loadData(false),5*60*1000);
loadData();
