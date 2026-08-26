const API = 'https://api.jolpi.ca/ergast/f1';
const state = { drivers: [], teams: [], races: [], winners: [], season: new Date().getFullYear(), filter: 'all', trendType: 'drivers', analytics: { results: [], qualifying: [], sprints: [] }, weekendCache: new Map(), profileCache: new Map() };
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
const sleep = (ms) => new Promise(resolve=>setTimeout(resolve,ms));
function mergePagedRaces(races,resultKey){
  const merged=new Map();
  races.forEach(r=>{
    const key=`${r.season}-${r.round}`;
    if(!merged.has(key)) merged.set(key,{...r,[resultKey]:[]});
    const target=merged.get(key);
    target[resultKey].push(...(r[resultKey]||[]));
  });
  return [...merged.values()].sort((a,b)=>Number(a.round)-Number(b.round));
}
async function getPagedRaces(path,resultKey){
  let offset=0,total=Infinity; const races=[];
  while(offset<total){
    if(offset>0) await sleep(350);
    const sep=path.includes('?')?'&':'?';
    const data=await getJson(`${path}${sep}limit=100&offset=${offset}`);
    races.push(...parseRaces(data));
    total=Number(data?.MRData?.total||0);
    const pageSize=Math.max(1,Number(data?.MRData?.limit||100));
    offset+=pageSize;
    if(!total) break;
  }
  return mergePagedRaces(races,resultKey);
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
  return items.slice(0,limit||items.length).map(x=> type==='driver' ? `<button class="standing-row standing-link" type="button" data-driver-id="${esc(x.Driver.driverId)}"><div class="pos">${esc(x.position)}</div><div class="competitor"><b>${esc(driverFullName(x))}</b><small>${esc(constructorOfDriver(x))}</small></div><div class="points">${esc(x.points)}<small>PTS</small></div></button>` : `<button class="standing-row standing-link" type="button" data-constructor-id="${esc(x.Constructor.constructorId)}"><div class="pos">${esc(x.position)}</div><div class="competitor"><b>${esc(x.Constructor.name)}</b><small>${esc(x.Constructor.nationality)}</small></div><div class="points">${esc(x.points)}<small>PTS</small></div></button>`).join('');
}
function renderHomeStandings(){ $('#homeDrivers').innerHTML=standingRows(state.drivers,'driver',5); $('#homeTeams').innerHTML=standingRows(state.teams,'team',5); }
function renderDriverTable(){
  $('#driverTable').innerHTML=`<div class="table-row header"><span>Pos</span><span>Driver</span><span>Constructor</span><span>Wins</span><span>Points</span></div>`+state.drivers.map(d=>`<button class="table-row table-link" type="button" data-driver-id="${esc(d.Driver.driverId)}"><span class="num">${esc(d.position)}</span><span class="driver-name"><i class="team-accent" style="background:${teamColor(constructorOfDriver(d))}"></i>${esc(driverFullName(d))}<small>${esc(d.Driver.nationality)}</small></span><span>${esc(constructorOfDriver(d))}</span><span>${esc(d.wins)}</span><span class="points">${esc(d.points)}</span></button>`).join('');
}
function renderTeams(){
  $('#teamCards').innerHTML=state.teams.map(t=>`<button class="team-card team-link" type="button" data-constructor-id="${esc(t.Constructor.constructorId)}" style="border-left:4px solid ${teamColor(t.Constructor.name)}"><span class="team-rank">P${esc(t.position)} · ${esc(t.Constructor.nationality)}</span><h3>${esc(t.Constructor.name)}</h3><div class="team-meta"><div><b>${esc(t.points)}</b><small>POINTS</small></div><div><b>${esc(t.wins)}</b><small>WINS</small></div></div><span class="profile-hint">Open team profile →</span></button>`).join('');
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

function countBy(items, keyFn, predicate=()=>true){
  const map=new Map();
  items.forEach(item=>{ if(!predicate(item)) return; const key=keyFn(item); if(!key) return; map.set(key,(map.get(key)||0)+1); });
  return map;
}
function sortedCounts(map, labelFn){
  return [...map.entries()].map(([id,value])=>({id,value,label:labelFn(id)})).sort((a,b)=>b.value-a.value || a.label.localeCompare(b.label));
}
function driverStandingById(id){ return state.drivers.find(d=>d.Driver.driverId===id); }
function teamStandingById(id){ return state.teams.find(t=>t.Constructor.constructorId===id); }
function driverLabel(id){ const d=driverStandingById(id); return d?driverFullName(d):id; }
function teamLabel(id){ const t=teamStandingById(id); return t?.Constructor?.name||id; }
function driverTeam(id){ const d=driverStandingById(id); return d?constructorOfDriver(d):''; }
function allRaceItems(){ return raceResultItems(state.analytics.results); }
function allQualiItems(){ return qualifyingResultItems(state.analytics.qualifying); }
function allSprintItems(){ return state.analytics.sprints.flatMap(r=>(r.SprintResults||[]).map(x=>({race:r,result:x}))).sort((a,b)=>Number(a.race.round)-Number(b.race.round)); }
function leaderRows(entries, kind='driver', suffix=''){
  if(!entries.length) return '<p class="no-results">No completed sessions yet.</p>';
  const max=Math.max(...entries.map(x=>x.value),1);
  return entries.slice(0,5).map((x,i)=>{
    const action=kind==='driver'?`data-driver-id="${esc(x.id)}"`:`data-constructor-id="${esc(x.id)}"`;
    const accent=kind==='driver'?teamColor(driverTeam(x.id)):teamColor(teamLabel(x.id));
    return `<button class="analytics-leader-row" type="button" ${action}><span class="analytics-rank">${i+1}</span><span class="analytics-name"><i style="background:${accent}"></i><strong>${esc(x.label)}</strong><small>${kind==='driver'?esc(driverTeam(x.id)):esc(teamStandingById(x.id)?.Constructor?.nationality||'')}</small></span><span class="analytics-bar"><i style="width:${Math.max(8,(x.value/max)*100)}%"></i></span><b>${esc(x.value)}${suffix}</b></button>`;
  }).join('');
}
function pointsByRound(kind='drivers'){
  const rounds=[...new Set([...state.analytics.results,...state.analytics.sprints].map(r=>Number(r.round)))].filter(Number.isFinite).sort((a,b)=>a-b);
  const top=kind==='drivers'?state.drivers.slice(0,5):state.teams.slice(0,5);
  const series=top.map(x=>({
    id:kind==='drivers'?x.Driver.driverId:x.Constructor.constructorId,
    label:kind==='drivers'?driverFullName(x):x.Constructor.name,
    team:kind==='drivers'?constructorOfDriver(x):x.Constructor.name,
    values:[], total:0
  }));
  const byId=new Map(series.map(x=>[x.id,x]));
  rounds.forEach(round=>{
    const race=state.analytics.results.find(r=>Number(r.round)===round);
    (race?.Results||[]).forEach(result=>{
      const id=kind==='drivers'?result.Driver?.driverId:result.Constructor?.constructorId;
      if(byId.has(id)) byId.get(id).total+=Number(result.points)||0;
    });
    const sprint=state.analytics.sprints.find(r=>Number(r.round)===round);
    (sprint?.SprintResults||[]).forEach(result=>{
      const id=kind==='drivers'?result.Driver?.driverId:result.Constructor?.constructorId;
      if(byId.has(id)) byId.get(id).total+=Number(result.points)||0;
    });
    series.forEach(x=>x.values.push(x.total));
  });
  return {rounds,series};
}
function trendColor(i){ return ['#63b8ff','#ff8700','#b47cff','#40d9a4','#f2d16b'][i%5]; }
function renderTrendChart(){
  const host=$('#trendChart'), legend=$('#trendLegend'); if(!host||!legend) return;
  const {rounds,series}=pointsByRound(state.trendType);
  if(!rounds.length){ host.innerHTML='<p class="no-results">Championship progression will appear after points are scored.</p>'; legend.innerHTML=''; return; }
  const width=Math.max(820,rounds.length*72), height=390, pad={l:58,r:28,t:24,b:54};
  const max=Math.max(1,...series.flatMap(s=>s.values));
  const x=i=>pad.l+(i/(Math.max(1,rounds.length-1)))*(width-pad.l-pad.r);
  const y=v=>pad.t+(1-v/max)*(height-pad.t-pad.b);
  const grid=[0,.25,.5,.75,1].map(f=>{const v=Math.round(max*f);return `<line x1="${pad.l}" y1="${y(v)}" x2="${width-pad.r}" y2="${y(v)}" class="chart-grid"/><text x="${pad.l-12}" y="${y(v)+4}" class="chart-y" text-anchor="end">${v}</text>`}).join('');
  const labels=rounds.map((r,i)=>{ const race=state.races.find(x=>Number(x.round)===r); const label=race?.Circuit?.Location?.country||`R${r}`; return `<text x="${x(i)}" y="${height-22}" class="chart-x" text-anchor="middle">${esc(label.slice(0,8))}</text>`; }).join('');
  const lines=series.map((s,i)=>{ const pts=s.values.map((v,j)=>`${x(j)},${y(v)}`).join(' '); const dots=s.values.map((v,j)=>`<circle cx="${x(j)}" cy="${y(v)}" r="3.5" fill="${trendColor(i)}"><title>${esc(s.label)} · Round ${rounds[j]} · ${v} pts</title></circle>`).join(''); return `<polyline points="${pts}" fill="none" stroke="${trendColor(i)}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="trend-line"/>${dots}`; }).join('');
  host.innerHTML=`<div class="trend-scroll"><svg class="trend-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(state.trendType)} championship points progression">${grid}${labels}${lines}</svg></div>`;
  legend.innerHTML=series.map((s,i)=>`<span><i style="background:${trendColor(i)}"></i>${esc(s.label)} <b>${esc(s.values.at(-1)||0)}</b></span>`).join('');
}
function lastFiveRoundPoints(){
  const rounds=[...new Set(state.analytics.results.map(r=>Number(r.round)))].filter(Number.isFinite).sort((a,b)=>a-b).slice(-5);
  const totals=new Map();
  [...allRaceItems(),...allSprintItems()].forEach(({race,result})=>{ if(!rounds.includes(Number(race.round))) return; const id=result.Driver?.driverId; if(id) totals.set(id,(totals.get(id)||0)+(Number(result.points)||0)); });
  return sortedCounts(totals,driverLabel);
}
function renderAnalytics(){
  if(!$('#seasonLeaderCards')) return;
  const races=allRaceItems(), quali=allQualiItems();
  const wins=sortedCounts(countBy(races,x=>x.result.Driver?.driverId,x=>Number(x.result.position)===1),driverLabel);
  const poles=sortedCounts(countBy(quali,x=>x.result.Driver?.driverId,x=>Number(x.result.position)===1),driverLabel);
  const podiums=sortedCounts(countBy(races,x=>x.result.Driver?.driverId,x=>Number(x.result.position)<=3),driverLabel);
  const fastest=sortedCounts(countBy(races,x=>x.result.Driver?.driverId,x=>String(x.result.FastestLap?.rank)==='1'),driverLabel);
  const cards=[['RACE WINS',wins[0],'Victories'],['POLE POSITIONS',poles[0],'Qualifying P1'],['PODIUMS',podiums[0],'Top-three finishes'],['FASTEST LAPS',fastest[0],'Race fastest lap']];
  $('#seasonLeaderCards').innerHTML=cards.map(([label,item,sub])=>item?`<button class="analytics-hero-card" type="button" data-driver-id="${esc(item.id)}" style="--leader-accent:${teamColor(driverTeam(item.id))}"><small>${esc(label)}</small><strong>${esc(item.label)}</strong><b>${esc(item.value)}</b><span>${esc(sub)} · View profile →</span></button>`:`<div class="analytics-hero-card empty"><small>${esc(label)}</small><strong>—</strong><b>0</b><span>Awaiting completed sessions</span></div>`).join('');
  $('#poleLeaders').innerHTML=leaderRows(poles,'driver');
  $('#fastestLapLeaders').innerHTML=leaderRows(fastest,'driver');
  $('#podiumLeaders').innerHTML=leaderRows(podiums,'driver');
  $('#formLeaders').innerHTML=leaderRows(lastFiveRoundPoints(),'driver',' pts');
  renderTrendChart();
}

function renderSeasonLabels(){
  $('#seasonLabel').textContent=`${state.season} SEASON`; ['driver','team','trend','winner','calendar'].forEach(x=>$(`#${x}SeasonChip`).textContent=state.season);
}
function renderAll(){ renderSeasonLabels();renderNextRace();renderLeaderStrip();renderHomeStandings();renderDriverTable();renderTeams();renderAnalytics();renderWinners();renderLatestPodium();renderCalendar(); }
function showError(err){
  setStatus('error','Offline'); toast('Unable to refresh live F1 data');
  const msg=`<div class="error-box"><b>Live data is temporarily unavailable.</b>${esc(err.message)}. Check your connection or try Refresh Data.</div>`;
  ['#homeDrivers','#homeTeams','#driverTable','#teamCards','#seasonLeaderCards','#trendChart','#poleLeaders','#fastestLapLeaders','#podiumLeaders','#formLeaders','#winnerGrid','#calendarGrid','#latestPodium'].forEach(s=>$(s).innerHTML=msg);
}
async function loadData(manual=false){
  setStatus('','Syncing'); if(manual) toast('Refreshing championship data…');
  try{
    const [drivers,teams,schedule]=await Promise.all([
      getJson('current/driverstandings.json'), getJson('current/constructorstandings.json'), getJson('current.json?limit=100')
    ]);
    state.drivers=parseStandings(drivers,'DriverStandings'); state.teams=parseStandings(teams,'ConstructorStandings'); state.races=parseRaces(schedule);
    await sleep(350);
    state.analytics.results=await getPagedRaces('current/results.json','Results');
    try{ await sleep(350); state.analytics.qualifying=await getPagedRaces('current/qualifying.json','QualifyingResults'); }catch(err){ console.warn('Qualifying analytics unavailable',err); state.analytics.qualifying=[]; }
    try{ await sleep(350); state.analytics.sprints=await getPagedRaces('current/sprint.json','SprintResults'); }catch(err){ console.warn('Sprint analytics unavailable',err); state.analytics.sprints=[]; }
    state.winners=state.analytics.results;
    renderAll(); setStatus('online','Live'); $('#lastUpdated').textContent=`Updated ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date())}`; if(manual) toast('F1 data refreshed');
  }catch(err){ console.error(err); showError(err); }
}
function switchView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.dataset.viewPanel===name)); $$('.nav-link').forEach(n=>n.classList.toggle('active',n.dataset.view===name)); window.scrollTo({top:0,behavior:'smooth'});
}

function calcAge(dob){
  if(!dob) return '—';
  const born=new Date(`${dob}T00:00:00`), now=new Date();
  let age=now.getFullYear()-born.getFullYear();
  if(now < new Date(now.getFullYear(),born.getMonth(),born.getDate())) age--;
  return age;
}
function raceResultItems(races){
  return races.flatMap(r=>(r.Results||[]).map(x=>({race:r,result:x}))).sort((a,b)=>Number(a.race.round)-Number(b.race.round));
}
function qualifyingResultItems(races){
  return races.flatMap(r=>(r.QualifyingResults||[]).map(x=>({race:r,result:x}))).sort((a,b)=>Number(a.race.round)-Number(b.race.round));
}
function statNumber(items,predicate){ return items.filter(predicate).length; }
function averagePosition(items){
  const vals=items.map(x=>Number(x.result.position)).filter(Number.isFinite);
  return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'—';
}
function bestPosition(items){
  const vals=items.map(x=>Number(x.result.position)).filter(Number.isFinite);
  return vals.length?Math.min(...vals):'—';
}
function recentForm(items,count=6){
  const last=items.slice(-count).reverse();
  if(!last.length) return '<p class="no-results">No completed races yet this season.</p>';
  return `<div class="form-list">${last.map(({race,result})=>`<div class="form-row"><div><strong>${esc(race.raceName)}</strong><small>Round ${esc(race.round)} · ${esc(result.Constructor?.name||'')}</small></div><span class="finish-chip ${Number(result.position)<=3?'podium':''}">P${esc(result.positionText||result.position)}</span></div>`).join('')}</div>`;
}
function profileStats(stats){
  return `<div class="profile-stat-grid">${stats.map(([label,value,sub])=>`<div class="profile-stat"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub?`<span>${esc(sub)}</span>`:''}</div>`).join('')}</div>`;
}
async function getDriverProfileData(driverId){
  const key=`driver-${state.season}-${driverId}`;
  if(state.profileCache.has(key)) return state.profileCache.get(key);
  const [results,qualifying]=await Promise.allSettled([
    getJson(`${state.season}/drivers/${encodeURIComponent(driverId)}/results.json?limit=100`),
    getJson(`${state.season}/drivers/${encodeURIComponent(driverId)}/qualifying.json?limit=100`)
  ]);
  const data={results:results.status==='fulfilled'?parseRaces(results.value):[],qualifying:qualifying.status==='fulfilled'?parseRaces(qualifying.value):[]};
  state.profileCache.set(key,data); return data;
}
async function getConstructorProfileData(constructorId){
  const key=`constructor-${state.season}-${constructorId}`;
  if(state.profileCache.has(key)) return state.profileCache.get(key);
  const result=await getJson(`${state.season}/constructors/${encodeURIComponent(constructorId)}/results.json?limit=200`);
  const data={results:parseRaces(result)}; state.profileCache.set(key,data); return data;
}
function openProfileShell(){
  const modal=$('#profileModal'); modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
}
async function openDriverProfile(driverId){
  const standing=state.drivers.find(d=>d.Driver.driverId===driverId); if(!standing) return;
  const d=standing.Driver, team=constructorOfDriver(standing), content=$('#profileModalContent'); openProfileShell();
  content.innerHTML=`<div class="profile-loading"><p class="eyebrow">DRIVER PROFILE</p><h2 id="profileModalTitle">${esc(driverFullName(standing))}</h2><div class="skeleton tall"></div></div>`;
  try{
    const data=await getDriverProfileData(driverId), results=raceResultItems(data.results), quali=qualifyingResultItems(data.qualifying);
    const podiums=statNumber(results,x=>Number(x.result.position)<=3), wins=statNumber(results,x=>Number(x.result.position)===1), bestQuali=bestPosition(quali);
    const number=d.permanentNumber?`#${d.permanentNumber}`:'NO. —', code=d.code||d.familyName.slice(0,3).toUpperCase();
    content.innerHTML=`<div class="profile-hero" style="--profile-accent:${teamColor(team)}"><div class="profile-identity"><p class="eyebrow">${esc(state.season)} DRIVER PROFILE</p><div class="profile-code">${esc(code)}</div><h2 id="profileModalTitle">${esc(d.givenName)} <span>${esc(d.familyName)}</span></h2><p>${esc(d.nationality)} · ${esc(team)} · ${esc(number)}</p></div><div class="profile-rank"><small>CHAMPIONSHIP</small><strong>P${esc(standing.position)}</strong><span>${esc(standing.points)} PTS</span></div></div>${profileStats([['RACE WINS',wins,'this season'],['PODIUMS',podiums,'this season'],['BEST FINISH',bestPosition(results)==='—'?'—':`P${bestPosition(results)}`,'race'],['AVG FINISH',averagePosition(results),'race'],['BEST QUALI',bestQuali==='—'?'—':`P${bestQuali}`,'qualifying'],['AGE',calcAge(d.dateOfBirth),d.dateOfBirth||'']])}<div class="profile-columns"><section class="profile-panel"><div class="modal-section-head"><p class="eyebrow">CURRENT FORM</p><h3>Recent race finishes</h3></div>${recentForm(results)}</section><section class="profile-panel"><div class="modal-section-head"><p class="eyebrow">DRIVER DETAILS</p><h3>Season identity</h3></div><dl class="profile-details"><div><dt>Driver code</dt><dd>${esc(d.code||'—')}</dd></div><div><dt>Permanent number</dt><dd>${esc(d.permanentNumber||'—')}</dd></div><div><dt>Nationality</dt><dd>${esc(d.nationality||'—')}</dd></div><div><dt>Date of birth</dt><dd>${esc(d.dateOfBirth||'—')}</dd></div><div><dt>Constructor</dt><dd>${esc(team)}</dd></div></dl>${d.url?`<a class="profile-source-link" href="${esc(d.url)}" target="_blank" rel="noopener">Driver reference ↗</a>`:''}</section></div>`;
  }catch(err){ content.innerHTML='<div class="error-box"><b>Driver profile unavailable.</b>The championship standings remain live.</div>'; }
}
async function openConstructorProfile(constructorId){
  const standing=state.teams.find(t=>t.Constructor.constructorId===constructorId); if(!standing) return;
  const c=standing.Constructor, content=$('#profileModalContent'); openProfileShell();
  content.innerHTML=`<div class="profile-loading"><p class="eyebrow">CONSTRUCTOR PROFILE</p><h2 id="profileModalTitle">${esc(c.name)}</h2><div class="skeleton tall"></div></div>`;
  try{
    const data=await getConstructorProfileData(constructorId), all=raceResultItems(data.results), currentDrivers=state.drivers.filter(d=>(d.Constructors||[]).some(x=>x.constructorId===constructorId));
    const podiums=statNumber(all,x=>Number(x.result.position)<=3), wins=statNumber(all,x=>Number(x.result.position)===1), avg=averagePosition(all);
    const racesWithTeam=data.results.length;
    const recentByRace=data.results.slice(-5).reverse();
    content.innerHTML=`<div class="profile-hero constructor-profile" style="--profile-accent:${teamColor(c.name)}"><div class="profile-identity"><p class="eyebrow">${esc(state.season)} CONSTRUCTOR PROFILE</p><div class="profile-code">TEAM</div><h2 id="profileModalTitle">${esc(c.name)}</h2><p>${esc(c.nationality)} · Formula 1 World Championship</p></div><div class="profile-rank"><small>CHAMPIONSHIP</small><strong>P${esc(standing.position)}</strong><span>${esc(standing.points)} PTS</span></div></div>${profileStats([['RACE WINS',wins,'driver wins'],['PODIUMS',podiums,'combined'],['ROUNDS',racesWithTeam,'contested'],['AVG FINISH',avg,'combined'],['TEAM POINTS',standing.points,'championship'],['DRIVERS',currentDrivers.length,'current roster']])}<div class="profile-columns"><section class="profile-panel"><div class="modal-section-head"><p class="eyebrow">CURRENT LINE-UP</p><h3>Drivers</h3></div><div class="driver-roster">${currentDrivers.map(d=>`<button type="button" data-driver-id="${esc(d.Driver.driverId)}"><span>${esc(d.Driver.code||d.Driver.familyName.slice(0,3).toUpperCase())}</span><div><strong>${esc(driverFullName(d))}</strong><small>P${esc(d.position)} · ${esc(d.points)} pts</small></div></button>`).join('')||'<p class="no-results">Current roster unavailable.</p>'}</div></section><section class="profile-panel"><div class="modal-section-head"><p class="eyebrow">RECENT ROUNDS</p><h3>Team finishes</h3></div><div class="form-list">${recentByRace.map(r=>`<div class="team-form-row"><div><strong>${esc(r.raceName)}</strong><small>Round ${esc(r.round)}</small></div><div>${(r.Results||[]).map(x=>`<span>P${esc(x.position)}</span>`).join('')}</div></div>`).join('')||'<p class="no-results">No completed races yet.</p>'}</div>${c.url?`<a class="profile-source-link" href="${esc(c.url)}" target="_blank" rel="noopener">Constructor reference ↗</a>`:''}</section></div>`;
  }catch(err){ content.innerHTML='<div class="error-box"><b>Constructor profile unavailable.</b>The championship standings remain live.</div>'; }
}
function closeProfile(){
  const modal=$('#profileModal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
  if(!$('#raceModal').classList.contains('open')) document.body.classList.remove('modal-open');
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
  const modal=$('#raceModal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); if(!$('#profileModal').classList.contains('open')) document.body.classList.remove('modal-open');
}

$$('.nav-link').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.jump)));
$$('.filter-btn').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filter; $$('.filter-btn').forEach(x=>x.classList.toggle('active',x===b)); renderCalendar();}));
$('#refreshBtn').addEventListener('click',()=>loadData(true));
document.addEventListener('click',(e)=>{
  const closeRace=e.target.closest('[data-close-race-modal]');
  if(closeRace){ closeRaceWeekend(); return; }
  const closeProfileBtn=e.target.closest('[data-close-profile-modal]');
  if(closeProfileBtn){ closeProfile(); return; }

  const driverBtn=e.target.closest('[data-driver-id]');
  if(driverBtn){ e.preventDefault(); openDriverProfile(driverBtn.dataset.driverId); return; }

  const constructorBtn=e.target.closest('[data-constructor-id]');
  if(constructorBtn){ e.preventDefault(); openConstructorProfile(constructorBtn.dataset.constructorId); return; }

  const trendBtn=e.target.closest('[data-trend-type]');
  if(trendBtn){ state.trendType=trendBtn.dataset.trendType; $$('.analytics-toggle').forEach(x=>x.classList.toggle('active',x===trendBtn)); renderTrendChart(); return; }

  const raceBtn=e.target.closest('[data-race-round]');
  if(raceBtn){ e.preventDefault(); openRaceWeekend(raceBtn.dataset.raceRound); return; }

  const tab=e.target.closest('[data-result-tab]');
  if(tab){ const root=tab.closest('section'); root.querySelectorAll('.result-tab').forEach(x=>x.classList.toggle('active',x===tab)); root.querySelectorAll('.result-panel').forEach(x=>x.classList.toggle('active',x.dataset.resultPanel===tab.dataset.resultTab)); }
});
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ closeRaceWeekend(); closeProfile(); } });
setInterval(renderNextRace,1000); setInterval(()=>loadData(false),5*60*1000);
loadData();
