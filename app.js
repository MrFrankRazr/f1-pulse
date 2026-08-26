const API = 'https://api.jolpi.ca/ergast/f1';
const CURRENT_YEAR = new Date().getFullYear();
const state = { drivers: [], teams: [], races: [], winners: [], season: CURRENT_YEAR, filter: 'all', trendType: 'drivers', compareType: 'drivers', compareA: null, compareB: null, scenario: {a:null,b:null,raceA:1,raceB:2,sprintA:1,sprintB:2}, analytics: { results: [], qualifying: [], sprints: [] }, weekendCache: new Map(), profileCache: new Map(), circuitCache: new Map(), liveCenter: { weatherCache: new Map(), lastRound: null } };
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
  if(!r){
    const champ=state.drivers[0];
    el.innerHTML=`<p class="eyebrow">${state.season < CURRENT_YEAR?'ARCHIVE SEASON':'SEASON COMPLETE'}</p><h2>Chequered flag.</h2><p class="venue">${champ?`${esc(state.season)} Drivers' Champion · ${esc(driverFullName(champ))}`:'The final race of the season has been completed.'}</p>${state.season<CURRENT_YEAR?'<button class="weekend-btn" type="button" data-jump="winners">Explore season winners →</button>':''}`;return;
  }
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
function renderHomeStandings(){ $('#homeDrivers').innerHTML=standingRows(state.drivers,'driver',5)||'<p class="no-results">Driver standings unavailable for this season.</p>'; $('#homeTeams').innerHTML=standingRows(state.teams,'team',5)||(state.season<1958?`<p class="no-results">The Constructors' Championship began in 1958.</p>`:'<p class="no-results">Constructor standings unavailable.</p>'); }
function renderDriverTable(){
  $('#driverTable').innerHTML=`<div class="table-row header"><span>Pos</span><span>Driver</span><span>Constructor</span><span>Wins</span><span>Points</span></div>`+state.drivers.map(d=>`<button class="table-row table-link" type="button" data-driver-id="${esc(d.Driver.driverId)}"><span class="num">${esc(d.position)}</span><span class="driver-name"><i class="team-accent" style="background:${teamColor(constructorOfDriver(d))}"></i>${esc(driverFullName(d))}<small>${esc(d.Driver.nationality)}</small></span><span>${esc(constructorOfDriver(d))}</span><span>${esc(d.wins)}</span><span class="points">${esc(d.points)}</span></button>`).join('');
}
function renderTeams(){
  $('#teamCards').innerHTML=state.teams.map(t=>`<button class="team-card team-link" type="button" data-constructor-id="${esc(t.Constructor.constructorId)}" style="border-left:4px solid ${teamColor(t.Constructor.name)}"><span class="team-rank">P${esc(t.position)} · ${esc(t.Constructor.nationality)}</span><h3>${esc(t.Constructor.name)}</h3><div class="team-meta"><div><b>${esc(t.points)}</b><small>POINTS</small></div><div><b>${esc(t.wins)}</b><small>WINS</small></div></div><span class="profile-hint">Open team profile →</span></button>`).join('') || (state.season<1958?`<div class="error-box"><b>No Constructors' Championship.</b>The championship for constructors was introduced in 1958.</div>`:'<div class="error-box">Constructor standings are unavailable for this season.</div>');
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
  $('#calendarGrid').innerHTML=filtered.map(r=>{const w=wins.get(String(r.round)); const result=w?.Results?.[0]; const completed=!!w || raceDateTime(r).getTime()<now; const loc=r.Circuit.Location; const sessionCount=raceSessions(r).length; return `<article class="race-card ${completed?'completed':''}"><div class="round-box"><small>ROUND</small><b>${esc(r.round)}</b></div><div><h3>${esc(r.raceName)}</h3><p>${esc(r.Circuit.circuitName)}</p><p>${esc(loc.locality)}, ${esc(loc.country)}</p>${result?`<p class="winner-tag">Winner · ${esc(result.Driver.givenName)} ${esc(result.Driver.familyName)}</p>`:''}<p class="session-count">${sessionCount} scheduled sessions</p><div class="card-action-row"><button class="card-detail-btn" type="button" data-race-round="${esc(r.round)}">Weekend details →</button><button class="card-detail-btn circuit-detail" type="button" data-circuit-id="${esc(r.Circuit.circuitId)}">Circuit intel →</button></div></div><div class="race-date"><strong>${esc(fmtRaceDate(raceDateTime(r)))}</strong><p>${completed?'Completed':'Upcoming'}</p></div></article>`;}).join('') || '<div class="error-box">No races match this filter.</div>';
}

function parseLapSeconds(value=''){
  const parts=String(value).split(':').map(Number);
  if(parts.some(Number.isNaN)) return NaN;
  return parts.length===2 ? parts[0]*60+parts[1] : parts[0];
}
function estimateCircuitLengthKm(result){
  const lap=result?.FastestLap, speed=Number(lap?.AverageSpeed?.speed), seconds=parseLapSeconds(lap?.Time?.time);
  if(!Number.isFinite(speed)||!Number.isFinite(seconds)||seconds<=0) return null;
  const km=speed*seconds/3600;
  return km>1&&km<15?km:null;
}
function seasonRaceForCircuit(circuitId){ return state.races.find(r=>r.Circuit?.circuitId===circuitId); }
function seasonResultForCircuit(circuitId){ return state.analytics.results.find(r=>r.Circuit?.circuitId===circuitId); }
function renderCircuits(){
  const host=$('#circuitGrid'); if(!host) return;
  const seen=new Set(); const races=state.races.filter(r=>{const id=r.Circuit?.circuitId;if(!id||seen.has(id))return false;seen.add(id);return true;});
  host.innerHTML=races.map(r=>{
    const loc=r.Circuit.Location, resultRace=seasonResultForCircuit(r.Circuit.circuitId), winner=resultRace?.Results?.find(x=>String(x.position)==='1'), fastest=resultRace?.Results?.find(x=>String(x.FastestLap?.rank)==='1');
    const length=estimateCircuitLengthKm(fastest);
    return `<article class="circuit-card"><div class="circuit-card-top"><span>ROUND ${esc(r.round)}</span><span>${esc(loc.country)}</span></div><h3>${esc(r.Circuit.circuitName)}</h3><p>${esc(loc.locality)}, ${esc(loc.country)}</p><div class="circuit-mini-stats"><div><small>EST. LENGTH</small><strong>${length?`${length.toFixed(3)} km`:'On demand'}</strong></div><div><small>${winner?'SEASON WINNER':'RACE DATE'}</small><strong>${winner?esc(`${winner.Driver.givenName} ${winner.Driver.familyName}`):esc(fmtRaceDate(raceDateTime(r)))}</strong></div></div><button class="weekend-btn" type="button" data-circuit-id="${esc(r.Circuit.circuitId)}">Open Circuit Intel →</button></article>`;
  }).join('') || '<div class="error-box">No circuit data is available for this season.</div>';
}
function fastestRecordedLap(races){
  let best=null;
  races.forEach(r=>(r.Results||[]).forEach(x=>{const t=x.FastestLap?.Time?.time,sec=parseLapSeconds(t);if(Number.isFinite(sec)&&(!best||sec<best.seconds))best={seconds:sec,time:t,driver:x.Driver,race:r,lap:x.FastestLap};}));
  return best;
}
async function getCircuitIntel(circuitId){
  const key=`circuit-${circuitId}`; if(state.circuitCache.has(key)) return state.circuitCache.get(key);
  const id=encodeURIComponent(circuitId);
  const [racesRes,fastRes,winsRes]=await Promise.allSettled([
    getJson(`circuits/${id}/races.json?limit=100`),
    getJson(`circuits/${id}/fastest/1/results.json?limit=100`),
    getJson(`circuits/${id}/results/1.json?limit=100`)
  ]);
  const data={races:racesRes.status==='fulfilled'?parseRaces(racesRes.value):[],fastest:fastRes.status==='fulfilled'?parseRaces(fastRes.value):[],wins:winsRes.status==='fulfilled'?parseRaces(winsRes.value):[]};
  state.circuitCache.set(key,data); return data;
}
function openCircuitShell(){ const modal=$('#circuitModal');modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open'); }
async function openCircuitIntel(circuitId){
  const race=seasonRaceForCircuit(circuitId)||state.races.find(r=>r.Circuit?.circuitId===circuitId); if(!race) return;
  const c=race.Circuit,loc=c.Location,content=$('#circuitModalContent'); openCircuitShell();
  content.innerHTML=`<div class="profile-loading"><p class="eyebrow">CIRCUIT INTELLIGENCE</p><h2 id="circuitModalTitle">${esc(c.circuitName)}</h2><p>${esc(loc.locality)}, ${esc(loc.country)}</p><div class="skeleton tall"></div></div>`;
  try{
    const data=await getCircuitIntel(circuitId), history=[...data.races].sort((a,b)=>new Date(a.date)-new Date(b.date)), latestFast=[...data.fastest].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
    const latestFastResult=latestFast?.Results?.find(x=>String(x.FastestLap?.rank)==='1')||latestFast?.Results?.[0], length=estimateCircuitLengthKm(latestFastResult);
    const latestWinner=[...data.wins].sort((a,b)=>new Date(b.date)-new Date(a.date))[0], winner=latestWinner?.Results?.[0];
    const record=fastestRecordedLap(data.fastest), latestLaps=winner?Number(winner.laps):null, raceDistance=length&&latestLaps?length*latestLaps:null;
    const maps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.lat},${loc.long}`)}`;
    content.innerHTML=`<div class="circuit-hero"><div><p class="eyebrow">TRACK INTELLIGENCE · ${esc(loc.country)}</p><h2 id="circuitModalTitle">${esc(c.circuitName)}</h2><p>${esc(loc.locality)}, ${esc(loc.country)} · ${esc(loc.lat)}, ${esc(loc.long)}</p></div><span class="circuit-round-chip">${esc(state.season)} · ROUND ${esc(race.round)}</span></div>${profileStats([['EST. LENGTH',length?`${length.toFixed(3)} km`:'—','derived'],['LATEST DIST.',raceDistance?`${raceDistance.toFixed(1)} km`:'—','derived'],['F1 GRANDS PRIX',history.length,'recorded'],['FIRST GP',history[0]?.season||'—','at this circuit'],['FASTEST LAP',record?.time||'—','recorded race lap'],['LATEST WINNER',winner?`${winner.Driver.familyName}`:'—',latestWinner?.season||'']])}<div class="profile-columns"><section class="profile-panel"><div class="modal-section-head"><p class="eyebrow">CIRCUIT HISTORY</p><h3>Formula 1 record</h3></div><dl class="profile-details"><div><dt>First recorded Grand Prix</dt><dd>${esc(history[0]?`${history[0].season} ${history[0].raceName}`:'—')}</dd></div><div><dt>Most recent Grand Prix</dt><dd>${esc(history.at(-1)?`${history.at(-1).season} ${history.at(-1).raceName}`:'—')}</dd></div><div><dt>Recorded F1 races</dt><dd>${esc(history.length)}</dd></div><div><dt>Fastest recorded race lap</dt><dd>${esc(record?`${record.time} · ${record.driver.givenName} ${record.driver.familyName} (${record.race.season})`:'—')}</dd></div><div><dt>Latest winner</dt><dd>${esc(winner?`${winner.Driver.givenName} ${winner.Driver.familyName} (${latestWinner.season})`:'—')}</dd></div></dl></section><section class="profile-panel"><div class="modal-section-head"><p class="eyebrow">VENUE DATA</p><h3>Track & location</h3></div><dl class="profile-details"><div><dt>Estimated track length</dt><dd>${length?`${length.toFixed(3)} km`:'—'}</dd></div><div><dt>Latest race laps</dt><dd>${latestLaps||'—'}</dd></div><div><dt>Estimated race distance</dt><dd>${raceDistance?`${raceDistance.toFixed(1)} km`:'—'}</dd></div><div><dt>Latitude / longitude</dt><dd>${esc(`${loc.lat}, ${loc.long}`)}</dd></div></dl><p class="intel-note">Length and distance are derived from the latest recorded fastest-lap average speed/time and race lap count. They are estimates, not official FIA circuit specifications.</p><a class="profile-source-link" href="${maps}" target="_blank" rel="noopener">Open venue map ↗</a>${c.url?`<a class="profile-source-link circuit-ref" href="${esc(c.url)}" target="_blank" rel="noopener">Circuit reference ↗</a>`:''}</section></div>`;
  }catch(err){content.innerHTML='<div class="error-box"><b>Circuit intelligence unavailable.</b>The season calendar remains available.</div>';}
}
function closeCircuit(){ const modal=$('#circuitModal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');if(!$('#raceModal').classList.contains('open')&&!$('#profileModal').classList.contains('open'))document.body.classList.remove('modal-open'); }

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
  if(!rounds.length||!series.length){ host.innerHTML=`<p class="no-results">${state.trendType==='constructors'&&state.season<1958?'The Constructors\' Championship began in 1958.':'Championship progression will appear after points are scored.'}</p>`; legend.innerHTML=''; return; }
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


function compareOptions(){
  if(state.compareType==='constructors') return state.teams.map(t=>({id:t.Constructor.constructorId,label:t.Constructor.name,sub:t.Constructor.nationality,standing:t}));
  return state.drivers.map(d=>({id:d.Driver.driverId,label:driverFullName(d),sub:constructorOfDriver(d),standing:d}));
}
function compareRaceItems(id,kind){
  return allRaceItems().filter(x=>kind==='constructors'?x.result.Constructor?.constructorId===id:x.result.Driver?.driverId===id);
}
function compareQualiItems(id,kind){
  return allQualiItems().filter(x=>kind==='constructors'?x.result.Constructor?.constructorId===id:x.result.Driver?.driverId===id);
}
function compareSprintItems(id,kind){
  return allSprintItems().filter(x=>kind==='constructors'?x.result.Constructor?.constructorId===id:x.result.Driver?.driverId===id);
}
function sumPoints(items){ return items.reduce((n,x)=>n+(Number(x.result.points)||0),0); }
function compareStatsFor(id,kind){
  const races=compareRaceItems(id,kind), quali=compareQualiItems(id,kind), sprints=compareSprintItems(id,kind);
  const standing=kind==='constructors'?teamStandingById(id):driverStandingById(id);
  const points=Number(standing?.points ?? (sumPoints(races)+sumPoints(sprints)))||0;
  const wins=statNumber(races,x=>Number(x.result.position)===1);
  const podiums=statNumber(races,x=>Number(x.result.position)<=3);
  const poles=statNumber(quali,x=>Number(x.result.position)===1);
  const fastest=statNumber(races,x=>String(x.result.FastestLap?.rank)==='1');
  const avg=averagePosition(races);
  const best=bestPosition(races);
  const qualiAvg=averagePosition(quali);
  return {standing,races,quali,sprints,points,wins,podiums,poles,fastest,avg,best,qualiAvg};
}
function comparisonName(id,kind){ return kind==='constructors'?teamLabel(id):driverLabel(id); }
function comparisonSub(id,kind){ return kind==='constructors'?(teamStandingById(id)?.Constructor?.nationality||'Constructor'):(driverTeam(id)||'Driver'); }
function compareWinnerClass(a,b,lower=false){
  const na=Number(a),nb=Number(b); if(!Number.isFinite(na)||!Number.isFinite(nb)||na===nb) return ['', ''];
  const aWins=lower?na<nb:na>nb; return aWins?['compare-win','']:['','compare-win'];
}
function renderCompareSelectors(){
  const a=$('#compareSelectA'), b=$('#compareSelectB'); if(!a||!b) return false;
  const options=compareOptions();
  if(options.length<2){a.innerHTML='<option>Unavailable</option>';b.innerHTML='<option>Unavailable</option>';a.disabled=b.disabled=true;return false;}
  a.disabled=b.disabled=false;
  if(!options.some(x=>x.id===state.compareA)) state.compareA=options[0].id;
  if(!options.some(x=>x.id===state.compareB)||state.compareB===state.compareA) state.compareB=options.find(x=>x.id!==state.compareA)?.id||options[0].id;
  const html=(selected)=>options.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.label)} · ${esc(x.sub)}</option>`).join('');
  a.innerHTML=html(state.compareA); b.innerHTML=html(state.compareB); return true;
}
function compareMetric(label,av,bv,format=v=>v,lower=false){
  const [ac,bc]=compareWinnerClass(av,bv,lower);
  return `<div class="compare-metric"><span class="compare-value ${ac}">${esc(format(av))}</span><strong>${esc(label)}</strong><span class="compare-value ${bc}">${esc(format(bv))}</span></div>`;
}
function constructorRoundSummary(items){
  if(!items.length) return {finish:'—',points:0};
  const pos=items.map(x=>Number(x.result.position)).filter(Number.isFinite).sort((a,b)=>a-b);
  return {finish:pos.length?pos.map(x=>`P${x}`).join(' / '):'—',points:sumPoints(items)};
}
function renderCompareRounds(aId,bId,kind){
  const host=$('#compareRounds'); if(!host) return;
  const rounds=[...new Set(state.analytics.results.map(r=>Number(r.round)))].filter(Number.isFinite).sort((x,y)=>x-y);
  if(!rounds.length){host.innerHTML='<p class="no-results">Round-by-round comparison will appear after races are completed.</p>';return;}
  host.innerHTML=`<div class="compare-round-head"><span>Round</span><span>${esc(comparisonName(aId,kind))}</span><span>${esc(comparisonName(bId,kind))}</span></div>`+rounds.map(round=>{
    const race=state.analytics.results.find(r=>Number(r.round)===round), name=race?.raceName||`Round ${round}`;
    const ai=(race?.Results||[]).filter(x=>kind==='constructors'?x.Constructor?.constructorId===aId:x.Driver?.driverId===aId).map(result=>({race,result}));
    const bi=(race?.Results||[]).filter(x=>kind==='constructors'?x.Constructor?.constructorId===bId:x.Driver?.driverId===bId).map(result=>({race,result}));
    const sprint=state.analytics.sprints.find(r=>Number(r.round)===round);
    const asp=(sprint?.SprintResults||[]).filter(x=>kind==='constructors'?x.Constructor?.constructorId===aId:x.Driver?.driverId===aId).reduce((n,x)=>n+(Number(x.points)||0),0);
    const bsp=(sprint?.SprintResults||[]).filter(x=>kind==='constructors'?x.Constructor?.constructorId===bId:x.Driver?.driverId===bId).reduce((n,x)=>n+(Number(x.points)||0),0);
    const A=kind==='constructors'?constructorRoundSummary(ai):{finish:ai[0]?`P${ai[0].result.positionText||ai[0].result.position}`:'—',points:(Number(ai[0]?.result.points)||0)};
    const B=kind==='constructors'?constructorRoundSummary(bi):{finish:bi[0]?`P${bi[0].result.positionText||bi[0].result.position}`:'—',points:(Number(bi[0]?.result.points)||0)};
    const ap=A.points+asp,bp=B.points+bsp; const [ac,bc]=compareWinnerClass(ap,bp);
    return `<div class="compare-round-row"><span><b>R${esc(round)}</b><small>${esc(name)}</small></span><span class="${ac}"><strong>${esc(A.finish)}</strong><small>${esc(ap)} pts${asp?` · sprint +${esc(asp)}`:''}</small></span><span class="${bc}"><strong>${esc(B.finish)}</strong><small>${esc(bp)} pts${bsp?` · sprint +${esc(bsp)}`:''}</small></span></div>`;
  }).join('');
}
function renderCompare(){
  const hero=$('#compareHero'); if(!hero) return;
  $$('.analytics-toggle[data-compare-type]').forEach(x=>x.classList.toggle('active',x.dataset.compareType===state.compareType));
  if(!renderCompareSelectors()){
    hero.innerHTML=`<div class="error-box"><b>Comparison unavailable.</b>${state.compareType==='constructors'&&state.season<1958?'The Constructors\' Championship began in 1958.':'Not enough competitors are available for this season.'}</div>`;
    $('#compareStats').innerHTML='';$('#compareRounds').innerHTML='';return;
  }
  const kind=state.compareType,aId=state.compareA,bId=state.compareB,A=compareStatsFor(aId,kind),B=compareStatsFor(bId,kind);
  const aName=comparisonName(aId,kind),bName=comparisonName(bId,kind),aSub=comparisonSub(aId,kind),bSub=comparisonSub(bId,kind);
  const aPos=A.standing?.position||'—',bPos=B.standing?.position||'—';
  hero.innerHTML=`<article class="compare-side left" style="--compare-accent:${teamColor(kind==='constructors'?aName:aSub)}"><small>P${esc(aPos)} · ${esc(aSub)}</small><h2>${esc(aName)}</h2><strong>${esc(A.points)} <span>PTS</span></strong>${kind==='drivers'?`<button type="button" data-driver-id="${esc(aId)}">Open profile →</button>`:`<button type="button" data-constructor-id="${esc(aId)}">Open profile →</button>`}</article><div class="compare-center"><span>HEAD</span><b>VS</b><span>HEAD</span></div><article class="compare-side right" style="--compare-accent:${teamColor(kind==='constructors'?bName:bSub)}"><small>P${esc(bPos)} · ${esc(bSub)}</small><h2>${esc(bName)}</h2><strong>${esc(B.points)} <span>PTS</span></strong>${kind==='drivers'?`<button type="button" data-driver-id="${esc(bId)}">Open profile →</button>`:`<button type="button" data-constructor-id="${esc(bId)}">Open profile →</button>`}</article>`;
  $('#compareStats').innerHTML=[
    compareMetric('Championship points',A.points,B.points),compareMetric('Race wins',A.wins,B.wins),compareMetric('Podiums',A.podiums,B.podiums),compareMetric('Pole positions',A.poles,B.poles),compareMetric('Fastest laps',A.fastest,B.fastest),compareMetric('Best race finish',A.best,B.best,v=>v==='—'?'—':`P${v}`,true),compareMetric('Average race finish',A.avg,B.avg,v=>v==='—'?'—':Number(v).toFixed(1),true),compareMetric('Average qualifying',A.qualiAvg,B.qualiAvg,v=>v==='—'?'—':Number(v).toFixed(1),true)
  ].join('');
  renderCompareRounds(aId,bId,kind);
}


const FAVORITES_KEY='f1PulseFavoritesV1';
function loadFavorites(){
  try{ const x=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'{}'); return {drivers:Array.isArray(x.drivers)?x.drivers:[],constructors:Array.isArray(x.constructors)?x.constructors:[],circuits:Array.isArray(x.circuits)?x.circuits:[]}; }
  catch(_){ return {drivers:[],constructors:[],circuits:[]}; }
}
function saveFavorites(f){ try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(f));}catch(_){} }
function favoriteMeta(kind,id){
  if(kind==='driver'){ const x=state.drivers.find(d=>d.Driver.driverId===id); return x?{id,label:driverFullName(x),sub:constructorOfDriver(x)}:{id,label:id,sub:'Driver'}; }
  if(kind==='constructor'){ const x=state.teams.find(t=>t.Constructor.constructorId===id); return x?{id,label:x.Constructor.name,sub:x.Constructor.nationality}:{id,label:id,sub:'Constructor'}; }
  const race=state.races.find(r=>r.Circuit?.circuitId===id); return race?{id,label:race.Circuit.circuitName,sub:`${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`}:{id,label:id,sub:'Circuit'};
}
function addFavorite(kind,id){
  if(!id)return; const f=loadFavorites(), key=kind==='driver'?'drivers':kind==='constructor'?'constructors':'circuits';
  if(!f[key].some(x=>x.id===id)) f[key].push(favoriteMeta(kind,id)); saveFavorites(f); renderMyF1(); toast('Added to My F1');
}
function removeFavorite(kind,id){ const f=loadFavorites(),key=kind==='driver'?'drivers':kind==='constructor'?'constructors':'circuits'; f[key]=f[key].filter(x=>x.id!==id); saveFavorites(f);renderMyF1();toast('Removed from My F1'); }
function renderFavoriteSelectors(){
  const ds=$('#favoriteDriverSelect'),ts=$('#favoriteTeamSelect'),cs=$('#favoriteCircuitSelect');
  if(ds) ds.innerHTML=state.drivers.map(d=>`<option value="${esc(d.Driver.driverId)}">${esc(driverFullName(d))}</option>`).join('');
  if(ts) ts.innerHTML=state.teams.map(t=>`<option value="${esc(t.Constructor.constructorId)}">${esc(t.Constructor.name)}</option>`).join('');
  if(cs){ const seen=new Set(); cs.innerHTML=state.races.filter(r=>{const id=r.Circuit?.circuitId;if(!id||seen.has(id))return false;seen.add(id);return true;}).map(r=>`<option value="${esc(r.Circuit.circuitId)}">${esc(r.Circuit.circuitName)}</option>`).join(''); }
}
function favoriteCard(item,kind){
  let detail=item.sub||'',open='';
  if(kind==='driver'){ const x=driverStandingById(item.id); if(x) detail=`P${x.position} · ${x.points} pts · ${constructorOfDriver(x)}`; open=`data-driver-id="${esc(item.id)}"`; }
  else if(kind==='constructor'){ const x=teamStandingById(item.id); if(x) detail=`P${x.position} · ${x.points} pts · ${x.wins} wins`; open=`data-constructor-id="${esc(item.id)}"`; }
  else { const r=state.races.find(x=>x.Circuit?.circuitId===item.id); if(r) detail=`${r.Circuit.Location.locality}, ${r.Circuit.Location.country} · Round ${r.round}`; open=`data-circuit-id="${esc(item.id)}"`; }
  return `<div class="favorite-card"><button class="favorite-open" type="button" ${open}><strong>${esc(item.label)}</strong><small>${esc(detail)}${open?'':' · Not on selected season'}</small></button><button class="favorite-remove" type="button" data-remove-favorite="${kind}" data-favorite-id="${esc(item.id)}">Remove</button></div>`;
}
function renderMyF1(){
  const host=$('#myF1Dashboard'); if(!host)return; renderFavoriteSelectors(); const f=loadFavorites();
  const groups=[['drivers','FAVORITE DRIVERS','Drivers'],['constructors','FAVORITE TEAMS','Constructors'],['circuits','FAVORITE CIRCUITS','Circuits']];
  host.innerHTML=groups.map(([key,eye,title])=>`<section class="analytics-panel favorite-panel"><div class="analytics-panel-head compact"><div><p class="eyebrow">${eye}</p><h2>${title}</h2></div><span>${f[key].length}</span></div><div class="favorite-list">${f[key].length?f[key].map(x=>favoriteCard(x,key==='drivers'?'driver':key==='constructors'?'constructor':'circuit')).join(''):`<div class="favorite-empty">Nothing pinned yet. Use the controls above to build your personal paddock.</div>`}</div></section>`).join('');
}
function inferPointsMap(kind='race'){
  const map=new Map(), items=kind==='sprint'?allSprintItems():allRaceItems();
  items.forEach(({result})=>{ const p=Number(result.position),pts=Number(result.points); if(Number.isFinite(p)&&Number.isFinite(pts)) map.set(p,Math.max(map.get(p)||0,pts)); });
  if(!map.size && kind==='race') [25,18,15,12,10,8,6,4,2,1].forEach((v,i)=>map.set(i+1,v));
  if(!map.size && kind==='sprint') [8,7,6,5,4,3,2,1].forEach((v,i)=>map.set(i+1,v));
  return map;
}
function scenarioPositionOptions(max=20,none=false){ return `${none?'<option value="0">Not selected</option>':''}${Array.from({length:max},(_,i)=>`<option value="${i+1}">P${i+1}</option>`).join('')}`; }
function scenarioRace(){ return state.season===CURRENT_YEAR?(upcomingRace()||null):null; }
function renderScenarioControls(){
  const a=$('#scenarioDriverA'),b=$('#scenarioDriverB'),ra=$('#scenarioRaceA'),rb=$('#scenarioRaceB'),sa=$('#scenarioSprintA'),sb=$('#scenarioSprintB'); if(!a||!b)return false;
  if(state.drivers.length<2){ $('#scenarioResults').innerHTML='<div class="error-box"><b>Scenario unavailable.</b>At least two drivers are required.</div>';return false; }
  const opts=state.drivers.map(d=>`<option value="${esc(d.Driver.driverId)}">${esc(driverFullName(d))}</option>`).join('');
  if(!state.scenario.a||!driverStandingById(state.scenario.a))state.scenario.a=state.drivers[0].Driver.driverId;
  if(!state.scenario.b||!driverStandingById(state.scenario.b)||state.scenario.b===state.scenario.a)state.scenario.b=state.drivers[1].Driver.driverId;
  a.innerHTML=opts;b.innerHTML=opts;a.value=state.scenario.a;b.value=state.scenario.b;
  const max=Math.max(20,state.drivers.length);ra.innerHTML=scenarioPositionOptions(max);rb.innerHTML=scenarioPositionOptions(max);ra.value=state.scenario.raceA;rb.value=state.scenario.raceB;
  const r=scenarioRace(),hasSprint=!!r?.Sprint || (state.season!==CURRENT_YEAR && state.analytics.sprints.length>0); $$('.scenario-sprint-field').forEach(x=>x.classList.toggle('hidden',!hasSprint));
  sa.innerHTML=scenarioPositionOptions(8,true);sb.innerHTML=scenarioPositionOptions(8,true);sa.value=hasSprint?state.scenario.sprintA:0;sb.value=hasSprint?state.scenario.sprintB:0;
  $('#scenarioRaceLabel').textContent=r?`${r.raceName} · Round ${r.round}${hasSprint?' · Sprint weekend':''}`:`Hypothetical next round after the ${state.season} standings`;
  const note=$('#scenarioRuleNote'); note.textContent=`Points are inferred from results already published for ${state.season}. Historical seasons with dropped-score rules, half-points or special regulations are projections, not official retroactive standings.`;
  return true;
}
function projectedDriverStandings(){
  const raceMap=inferPointsMap('race'),sprintMap=inferPointsMap('sprint'),add=new Map();
  const put=(id,racePos,sprintPos)=>add.set(id,(raceMap.get(Number(racePos))||0)+(Number(sprintPos)>0?(sprintMap.get(Number(sprintPos))||0):0));
  put(state.scenario.a,state.scenario.raceA,state.scenario.sprintA);put(state.scenario.b,state.scenario.raceB,state.scenario.sprintB);
  return state.drivers.map(d=>({id:d.Driver.driverId,name:driverFullName(d),team:constructorOfDriver(d),oldPos:Number(d.position),oldPoints:Number(d.points)||0,added:add.get(d.Driver.driverId)||0})).map(x=>({...x,points:x.oldPoints+x.added})).sort((a,b)=>b.points-a.points||a.oldPos-b.oldPos).map((x,i)=>({...x,newPos:i+1}));
}
function renderScenario(){
  const host=$('#scenarioResults');if(!host)return;if(!renderScenarioControls())return; const rows=projectedDriverStandings(),focus=new Set([state.scenario.a,state.scenario.b]);
  const A=rows.find(x=>x.id===state.scenario.a),B=rows.find(x=>x.id===state.scenario.b); const summary=[A,B].map(x=>`<div><small>${esc(x.name)}</small><strong>P${x.newPos} · ${x.points} pts</strong><span>${x.added?`+${x.added} scenario pts`:'No added points'}</span></div>`).join('');
  host.innerHTML=`<div class="scenario-summary">${summary}</div><div class="scenario-board">${rows.slice(0,10).map(x=>{const move=x.oldPos-x.newPos,cls=move>0?'up':move<0?'down':'';return `<div class="scenario-row ${focus.has(x.id)?'projected':''}"><span class="rank">P${x.newPos}</span><div><strong>${esc(x.name)}</strong><small>${esc(x.team)} · ${x.points} pts${x.added?` · +${x.added}`:''}</small></div><span class="delta ${cls}">${move>0?`▲ ${move}`:move<0?`▼ ${Math.abs(move)}`:'—'}</span></div>`}).join('')}</div>`;
}

function renderSeasonLabels(){
  $('#seasonLabel').textContent=`${state.season} SEASON`; ['live','driver','team','trend','compare','scenario','myf1','records','predictor','winner','calendar','circuit'].forEach(x=>{ const el=$(`#${x}SeasonChip`); if(el) el.textContent=state.season; });
}
function renderAll(){ renderSeasonLabels();renderNextRace();renderLeaderStrip();renderHomeStandings();renderDriverTable();renderTeams();renderAnalytics();renderCompare();renderScenario();renderMyF1();renderSeasonMilestones();renderPredictor();renderWinners();renderLatestPodium();renderCalendar();renderCircuits(); if($('#view-live')?.classList.contains('active')) renderLiveCenter(false); if($('#view-records')?.classList.contains('active')&&state.records.loaded) renderRecords(); }
function showError(err){
  setStatus('error','Offline'); toast('Unable to refresh live F1 data');
  const msg=`<div class="error-box"><b>Live data is temporarily unavailable.</b>${esc(err.message)}. Check your connection or try Refresh Data.</div>`;
  ['#homeDrivers','#homeTeams','#driverTable','#teamCards','#seasonLeaderCards','#trendChart','#poleLeaders','#fastestLapLeaders','#podiumLeaders','#formLeaders','#compareHero','#compareStats','#compareRounds','#scenarioResults','#myF1Dashboard','#winnerGrid','#calendarGrid','#circuitGrid','#latestPodium'].forEach(s=>$(s).innerHTML=msg);
}
async function loadData(manual=false){
  setStatus('','Syncing'); if(manual) toast(`Refreshing ${state.season} F1 data…`);
  try{
    const season=state.season;
    const [driversRes,teamsRes,scheduleRes]=await Promise.allSettled([
      getJson(`${season}/driverstandings.json`), getJson(`${season}/constructorstandings.json`), getJson(`${season}.json?limit=100`)
    ]);
    if(driversRes.status!=='fulfilled'||scheduleRes.status!=='fulfilled') throw new Error(`Core ${season} season data is unavailable`);
    state.drivers=parseStandings(driversRes.value,'DriverStandings');
    state.teams=teamsRes.status==='fulfilled'?parseStandings(teamsRes.value,'ConstructorStandings'):[];
    state.races=parseRaces(scheduleRes.value);
    await sleep(350);
    state.analytics.results=await getPagedRaces(`${season}/results.json`,'Results');
    try{ await sleep(350); state.analytics.qualifying=await getPagedRaces(`${season}/qualifying.json`,'QualifyingResults'); }catch(err){ console.warn('Qualifying analytics unavailable',err); state.analytics.qualifying=[]; }
    try{ await sleep(350); state.analytics.sprints=await getPagedRaces(`${season}/sprint.json`,'SprintResults'); }catch(err){ console.warn('Sprint analytics unavailable',err); state.analytics.sprints=[]; }
    state.winners=state.analytics.results;
    renderAll(); setStatus('online',season===CURRENT_YEAR?'Live':'Archive'); $('#lastUpdated').textContent=`${season} data loaded · ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date())}`; if(manual) toast(`${season} F1 data refreshed`);
  }catch(err){ console.error(err); showError(err); }
}
function switchView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.dataset.viewPanel===name));
  $$('.nav-link').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  if(name==='live') renderLiveCenter(false);
  if(name==='records') loadRecords(false);
  if(name==='predictor') renderPredictor();
  window.scrollTo({top:0,behavior:'smooth'});
}

function initSeasonSelector(){
  const select=$('#seasonSelect'); if(!select) return;
  select.innerHTML=Array.from({length:CURRENT_YEAR-1949},(_,i)=>CURRENT_YEAR-i).map(y=>`<option value="${y}" ${y===state.season?'selected':''}>${y}${y===CURRENT_YEAR?' · Current':''}</option>`).join('');
  select.addEventListener('change',()=>{
    state.season=Number(select.value); state.filter='all'; state.weekendCache.clear(); state.profileCache.clear(); state.circuitCache.clear(); state.liveCenter.lastRound=null; state.compareA=null; state.compareB=null; state.scenario.a=null; state.scenario.b=null;
    $$('.filter-btn').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));
    loadData(false); switchView('home');
  });
}
initSeasonSelector();

function calcAge(dob){
  if(!dob) return '—';
  const born=new Date(`${dob}T00:00:00`), now=state.season===CURRENT_YEAR?new Date():new Date(`${state.season}-12-31T00:00:00`);
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
  if(!$('#raceModal').classList.contains('open')&&!$('#circuitModal').classList.contains('open')) document.body.classList.remove('modal-open');
}

function sessionDurationMs(type){
  if(type==='race') return 2.5*36e5;
  if(type==='sprint') return 55*60*1000;
  if(type==='qualifying') return 75*60*1000;
  return 70*60*1000;
}
function focusRace(){
  if(!state.races.length) return null;
  if(state.season!==CURRENT_YEAR) return state.races.at(-1);
  const now=Date.now();
  const active=state.races.find(r=>{
    const ss=raceSessions(r); if(!ss.length) return false;
    const first=ss[0].date.getTime()-6*36e5, last=raceDateTime(r).getTime()+5*36e5;
    return now>=first && now<=last;
  });
  return active || upcomingRace() || latestCompletedRace() || state.races[0];
}
function liveSessionState(s){
  const now=Date.now(), start=s.date.getTime(), end=start+sessionDurationMs(s.type);
  if(now>=start && now<=end) return 'live';
  if(now>end) return 'complete';
  if(start-now<=36e5) return 'soon';
  return 'upcoming';
}
function durationLabel(ms){
  if(ms<=0) return 'NOW';
  const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
  return d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${Math.max(1,m)}m`;
}
function weatherText(code){
  if(code===0) return 'Clear'; if([1,2].includes(code)) return 'Partly cloudy'; if(code===3) return 'Overcast';
  if([45,48].includes(code)) return 'Fog'; if([51,53,55,56,57].includes(code)) return 'Drizzle';
  if([61,63,65,66,67,80,81,82].includes(code)) return 'Rain'; if([71,73,75,77,85,86].includes(code)) return 'Snow';
  if([95,96,99].includes(code)) return 'Thunderstorms'; return 'Variable';
}
function cToF(c){ return Number.isFinite(c)?Math.round(c*9/5+32):null; }
async function getWeekendWeather(r){
  if(state.season!==CURRENT_YEAR) return {archive:true};
  const loc=r?.Circuit?.Location; if(!loc) return null;
  const key=`${r.round}-${r.date}`; if(state.liveCenter.weatherCache.has(key)) return state.liveCenter.weatherCache.get(key);
  const target=raceDateTime(r).getTime(), delta=target-Date.now();
  if(delta > 16*864e5 || delta < -2*864e5) return {outOfRange:true};
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(loc.lat)}&longitude=${encodeURIComponent(loc.long)}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m&timezone=UTC&forecast_days=16&temperature_unit=celsius&wind_speed_unit=kmh`;
  const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error(`Weather service returned ${res.status}`);
  const data=await res.json(); state.liveCenter.weatherCache.set(key,data); return data;
}
function weatherAt(data,date){
  if(!data?.hourly?.time?.length) return null;
  const t=date.getTime(); let best=0,bestDiff=Infinity;
  data.hourly.time.forEach((v,i)=>{const ms=new Date(`${v}Z`).getTime(),diff=Math.abs(ms-t);if(diff<bestDiff){best=i;bestDiff=diff;}});
  return {time:data.hourly.time[best],temp:data.hourly.temperature_2m?.[best],humidity:data.hourly.relative_humidity_2m?.[best],rain:data.hourly.precipitation_probability?.[best],code:data.hourly.weather_code?.[best],wind:data.hourly.wind_speed_10m?.[best],gust:data.hourly.wind_gusts_10m?.[best]};
}
function renderLiveTimeline(r){
  const host=$('#liveSessionTimeline'); if(!host) return;
  const ss=raceSessions(r), now=Date.now();
  host.innerHTML=`<div class="live-timeline">${ss.map(s=>{const st=liveSessionState(s),until=s.date.getTime()-now;return `<div class="live-session-row ${st}"><span class="live-session-light"></span><div><strong>${esc(s.label)}</strong><small>${esc(fmtSession(s.date))}</small></div><em>${st==='live'?'SESSION WINDOW':st==='complete'?'COMPLETE':st==='soon'?`IN ${durationLabel(until)}`:`IN ${durationLabel(until)}`}</em></div>`}).join('')}</div>`;
}
function latestClassificationData(r,data){
  const candidates=[];
  if(data?.race?.Results?.length) candidates.push({label:'Race',items:data.race.Results,mode:'race',weight:4});
  if(data?.sprint?.SprintResults?.length) candidates.push({label:'Sprint',items:data.sprint.SprintResults,mode:'race',weight:3});
  if(data?.qualifying?.QualifyingResults?.length) candidates.push({label:'Qualifying',items:data.qualifying.QualifyingResults,mode:'qualifying',weight:2});
  return candidates.sort((a,b)=>b.weight-a.weight)[0]||null;
}
function liveFastestLap(items){
  return (items||[]).find(x=>String(x.FastestLap?.rank)==='1') || null;
}
function renderLiveStory(r,data,weather){
  const host=$('#liveWeekendStory'); if(!host) return;
  const leader=state.drivers[0], second=state.drivers[1], gap=leader&&second?(Number(leader.points)-Number(second.points)).toFixed(0):null;
  const prior=state.winners.filter(x=>Number(x.round)<Number(r.round)).at(-1), priorWinner=prior?.Results?.[0];
  const raceItems=data?.race?.Results||[], fast=liveFastestLap(raceItems), raceWeather=weatherAt(weather,raceDateTime(r));
  const bullets=[];
  if(leader) bullets.push(`<li><span>Championship</span><strong>${esc(driverFullName(leader))} leads${gap!==null?` by ${esc(gap)} points`:''}.</strong></li>`);
  if(priorWinner) bullets.push(`<li><span>Last race</span><strong>${esc(priorWinner.Driver.givenName)} ${esc(priorWinner.Driver.familyName)} won the ${esc(prior.raceName)}.</strong></li>`);
  bullets.push(`<li><span>Format</span><strong>${r.Sprint?'Sprint weekend with an extra points-paying race.':'Standard Grand Prix weekend.'}</strong></li>`);
  if(fast) bullets.push(`<li><span>Fastest lap</span><strong>${esc(fast.Driver.givenName)} ${esc(fast.Driver.familyName)} · ${esc(fast.FastestLap?.Time?.time||'—')}.</strong></li>`);
  if(raceWeather) bullets.push(`<li><span>Race forecast</span><strong>${esc(weatherText(raceWeather.code))}, ${esc(Math.round(raceWeather.temp))}°C / ${esc(cToF(raceWeather.temp))}°F, ${esc(raceWeather.rain??'—')}% rain chance.</strong></li>`);
  host.innerHTML=`<ul class="weekend-story-list">${bullets.join('')}</ul>`;
}
async function renderLiveWeather(r,weatherPromise){
  const host=$('#liveWeather'); if(!host) return;
  try{
    const data=await weatherPromise;
    if(data?.archive){host.innerHTML='<div class="weather-unavailable"><strong>Historical season</strong><p>Forecast weather is only shown for the current season.</p></div>';return data;}
    if(data?.outOfRange){host.innerHTML='<div class="weather-unavailable"><strong>Forecast window not open yet</strong><p>Weather will populate automatically when the race falls inside the forecast horizon.</p></div>';return data;}
    const sessions=raceSessions(r).filter(s=>['qualifying','sprint','race'].includes(s.type));
    host.innerHTML=`<div class="weather-grid">${sessions.map(s=>{const w=weatherAt(data,s.date); if(!w) return ''; return `<article class="weather-card"><small>${esc(s.label)}</small><strong>${esc(Math.round(w.temp))}°C <span>${esc(cToF(w.temp))}°F</span></strong><p>${esc(weatherText(w.code))}</p><div><span>Rain <b>${esc(w.rain??'—')}%</b></span><span>Wind <b>${esc(Math.round(w.wind??0))} km/h</b></span><span>Humidity <b>${esc(w.humidity??'—')}%</b></span></div></article>`}).join('')}</div><p class="weather-source-note">Forecast: Open-Meteo · circuit coordinates · updated on page request.</p>`;
    return data;
  }catch(err){ host.innerHTML='<div class="weather-unavailable"><strong>Weather temporarily unavailable</strong><p>Race data remains available.</p></div>'; return null; }
}
async function renderLiveCenter(force=false){
  const hero=$('#liveCenterHero'); if(!hero || !state.races.length) return;
  const r=focusRace(); if(!r){hero.innerHTML='<div class="error-box">No race weekend is available for this season.</div>';return;}
  const ss=raceSessions(r), now=Date.now(), live=ss.find(s=>liveSessionState(s)==='live'), next=ss.find(s=>s.date.getTime()>now), completed=[...ss].reverse().find(s=>s.date.getTime()<=now);
  const focus=live||next||completed, loc=r.Circuit.Location;
  state.liveCenter.lastRound=r.round;
  hero.innerHTML=`<div class="live-hero-copy"><div class="live-badge ${live?'hot':''}"><span></span>${live?'SESSION WINDOW':'RACE WEEKEND CENTER'}</div><p class="eyebrow">${esc(state.season)} · ROUND ${esc(r.round)}</p><h2>${esc(r.raceName)}</h2><p>${esc(r.Circuit.circuitName)} · ${esc(loc.locality)}, ${esc(loc.country)}</p><div class="live-focus-session"><small>${live?'CURRENT WINDOW':next?'NEXT SESSION':'LATEST SESSION'}</small><strong>${esc(focus?.label||'Race Weekend')}</strong><span>${focus?esc(fmtSession(focus.date)):'—'}${next&&!live?` · ${esc(durationLabel(next.date.getTime()-now))} away`:''}</span></div></div><div class="live-hero-actions"><button class="primary-btn" type="button" data-race-round="${esc(r.round)}">Open full weekend</button><button class="ghost-btn" type="button" data-circuit-id="${esc(r.Circuit.circuitId)}">Circuit intel</button></div>`;
  renderLiveTimeline(r);
  const classification=$('#liveClassification'); classification.innerHTML='<div class="skeleton tall"></div>';
  const weatherPromise=getWeekendWeather(r);
  const weatherRender=renderLiveWeather(r,weatherPromise);
  try{
    if(force) state.weekendCache.delete(`${state.season}-${r.round}`);
    const data=await getWeekendData(r.round), latest=latestClassificationData(r,data);
    if(latest){
      const fast=latest.label==='Race'?liveFastestLap(latest.items):null;
      classification.innerHTML=`<div class="classification-head"><span class="live-data-chip">${esc(latest.label.toUpperCase())}</span><small>Latest published classification</small></div>${resultRows(latest.items,latest.mode)}${fast?`<div class="fastest-lap-callout"><span>FASTEST LAP</span><strong>${esc(fast.Driver.givenName)} ${esc(fast.Driver.familyName)}</strong><em>${esc(fast.FastestLap?.Time?.time||'—')}</em></div>`:''}`;
    }else classification.innerHTML='<div class="weather-unavailable"><strong>No classification published yet</strong><p>This panel updates as Jolpica publishes qualifying, sprint or race results.</p></div>';
    const weather=await weatherRender; renderLiveStory(r,data,weather);
  }catch(err){ classification.innerHTML='<div class="error-box"><b>Weekend classification unavailable.</b>Try Refresh Center shortly.</div>'; const weather=await weatherRender; renderLiveStory(r,{},weather); }
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
  const modal=$('#raceModal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); if(!$('#profileModal').classList.contains('open')&&!$('#circuitModal').classList.contains('open')) document.body.classList.remove('modal-open');
}

$$('.nav-link').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$$('.filter-btn').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filter; $$('.filter-btn').forEach(x=>x.classList.toggle('active',x===b)); renderCalendar();}));
$('#refreshBtn').addEventListener('click',()=>loadData(true));
const liveRefresh=$('#liveCenterRefresh'); if(liveRefresh) liveRefresh.addEventListener('click',()=>{toast('Refreshing race weekend center…');renderLiveCenter(true);});
const compareA=$('#compareSelectA'), compareB=$('#compareSelectB');
if(compareA) compareA.addEventListener('change',()=>{ state.compareA=compareA.value; if(state.compareA===state.compareB){const alt=compareOptions().find(x=>x.id!==state.compareA); if(alt) state.compareB=alt.id;} renderCompare(); });
if(compareB) compareB.addEventListener('change',()=>{ state.compareB=compareB.value; if(state.compareB===state.compareA){const alt=[...compareOptions()].reverse().find(x=>x.id!==state.compareB); if(alt) state.compareA=alt.id;} renderCompare(); });

const scenarioReset=$('#scenarioReset'); if(scenarioReset) scenarioReset.addEventListener('click',()=>{state.scenario={a:state.drivers[0]?.Driver?.driverId||null,b:state.drivers[1]?.Driver?.driverId||null,raceA:1,raceB:2,sprintA:1,sprintB:2};renderScenario();});
document.addEventListener('change',(e)=>{
  const id=e.target?.id;
  if(id==='scenarioDriverA'){state.scenario.a=e.target.value;if(state.scenario.a===state.scenario.b)state.scenario.b=state.drivers.find(d=>d.Driver.driverId!==state.scenario.a)?.Driver.driverId;renderScenario();}
  else if(id==='scenarioDriverB'){state.scenario.b=e.target.value;if(state.scenario.b===state.scenario.a)state.scenario.a=state.drivers.find(d=>d.Driver.driverId!==state.scenario.b)?.Driver.driverId;renderScenario();}
  else if(id==='scenarioRaceA'){state.scenario.raceA=Number(e.target.value);if(state.scenario.raceA===state.scenario.raceB)state.scenario.raceB=state.scenario.raceA===1?2:1;renderScenario();}
  else if(id==='scenarioRaceB'){state.scenario.raceB=Number(e.target.value);if(state.scenario.raceB===state.scenario.raceA)state.scenario.raceA=state.scenario.raceB===1?2:1;renderScenario();}
  else if(id==='scenarioSprintA'){state.scenario.sprintA=Number(e.target.value);if(state.scenario.sprintA&&state.scenario.sprintA===state.scenario.sprintB)state.scenario.sprintB=state.scenario.sprintA===1?2:1;renderScenario();}
  else if(id==='scenarioSprintB'){state.scenario.sprintB=Number(e.target.value);if(state.scenario.sprintB&&state.scenario.sprintB===state.scenario.sprintA)state.scenario.sprintA=state.scenario.sprintB===1?2:1;renderScenario();}
  else if(id==='pickP1'){state.predictor.p1=e.target.value;}
  else if(id==='pickP2'){state.predictor.p2=e.target.value;}
  else if(id==='pickP3'){state.predictor.p3=e.target.value;}
});

document.addEventListener('click',(e)=>{
  const jump=e.target.closest('[data-jump]'); if(jump){ switchView(jump.dataset.jump); return; }
  const addFav=e.target.closest('[data-add-favorite]'); if(addFav){ const kind=addFav.dataset.addFavorite; const select=kind==='driver'?$('#favoriteDriverSelect'):kind==='constructor'?$('#favoriteTeamSelect'):$('#favoriteCircuitSelect'); addFavorite(kind,select?.value); return; }
  const removeFav=e.target.closest('[data-remove-favorite]'); if(removeFav){ removeFavorite(removeFav.dataset.removeFavorite,removeFav.dataset.favoriteId); return; }
  const savePickBtn=e.target.closest('[data-save-pick]'); if(savePickBtn){ saveCurrentPick(); return; }
  const clearPickBtn=e.target.closest('[data-clear-pick]'); if(clearPickBtn){ clearCurrentPick(); return; }
  const closeCircuitBtn=e.target.closest('[data-close-circuit-modal]'); if(closeCircuitBtn){ closeCircuit(); return; }
  const closeRace=e.target.closest('[data-close-race-modal]');
  if(closeRace){ closeRaceWeekend(); return; }
  const closeProfileBtn=e.target.closest('[data-close-profile-modal]');
  if(closeProfileBtn){ closeProfile(); return; }

  const circuitBtn=e.target.closest('[data-circuit-id]');
  if(circuitBtn){ e.preventDefault(); openCircuitIntel(circuitBtn.dataset.circuitId); return; }

  const driverBtn=e.target.closest('[data-driver-id]');
  if(driverBtn){ e.preventDefault(); openDriverProfile(driverBtn.dataset.driverId); return; }

  const constructorBtn=e.target.closest('[data-constructor-id]');
  if(constructorBtn){ e.preventDefault(); openConstructorProfile(constructorBtn.dataset.constructorId); return; }

  const compareTypeBtn=e.target.closest('[data-compare-type]');
  if(compareTypeBtn){ state.compareType=compareTypeBtn.dataset.compareType; state.compareA=null; state.compareB=null; renderCompare(); return; }

  const trendBtn=e.target.closest('[data-trend-type]');
  if(trendBtn){ state.trendType=trendBtn.dataset.trendType; $$('.analytics-toggle').forEach(x=>x.classList.toggle('active',x===trendBtn)); renderTrendChart(); return; }

  const raceBtn=e.target.closest('[data-race-round]');
  if(raceBtn){ e.preventDefault(); openRaceWeekend(raceBtn.dataset.raceRound); return; }

  const tab=e.target.closest('[data-result-tab]');
  if(tab){ const root=tab.closest('section'); root.querySelectorAll('.result-tab').forEach(x=>x.classList.toggle('active',x===tab)); root.querySelectorAll('.result-panel').forEach(x=>x.classList.toggle('active',x.dataset.resultPanel===tab.dataset.resultTab)); }
});
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ closeRaceWeekend(); closeProfile(); closeCircuit(); } });
setInterval(()=>{renderNextRace(); if($('#view-live')?.classList.contains('active')) renderLiveTimeline(focusRace()||{});},1000); setInterval(()=>{if(state.season===CURRENT_YEAR)loadData(false);},5*60*1000);
loadData();

// v1.8.0 — Records & Milestones + Race Predictor
const RECORDS_CACHE_KEY='f1pulse-records-v2';
const PICKS_KEY='f1pulse-race-picks-v1';
state.records={loaded:false,loading:false,data:null};
state.predictor={p1:null,p2:null,p3:null};

function safeLocalGet(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function safeLocalSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function countRecord(items,idFn,labelFn){
  const m=new Map();
  items.forEach(item=>{const id=idFn(item);if(!id)return;const prev=m.get(id)||{id,label:labelFn(item),value:0};prev.value++;m.set(id,prev)});
  return [...m.values()].sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
}
function rankRecordRows(items,suffix=''){
  if(!items?.length)return '<p class="no-results">Record data unavailable.</p>';
  return items.slice(0,10).map((x,i)=>`<div class="record-rank-row"><span>${i+1}</span><div><strong>${esc(x.label)}</strong>${x.sub?`<small>${esc(x.sub)}</small>`:''}</div><b>${esc(x.value)}${esc(suffix)}</b></div>`).join('');
}
function standingsLists(data){return data?.MRData?.StandingsTable?.StandingsLists||[]}
async function loadRecords(force=false){
  if(state.records.loading)return;
  if(state.records.loaded&&!force){renderRecords();return}
  state.records.loading=true;
  const hero=$('#recordsHero');if(hero)hero.innerHTML='<div class="skeleton tall"></div><div class="skeleton tall"></div><div class="skeleton tall"></div><div class="skeleton tall"></div>';
  try{
    const cached=safeLocalGet(RECORDS_CACHE_KEY,null);
    if(cached&&!force&&Date.now()-Number(cached.savedAt||0)<7*864e5){state.records.data=cached.data;state.records.loaded=true;renderRecords();return}
    const [winsR,p2R,p3R,polesR]=await Promise.allSettled([
      getPagedRaces('results/1.json','Results'),getPagedRaces('results/2.json','Results'),getPagedRaces('results/3.json','Results'),
      getPagedRaces('grid/1/results.json','Results')
    ]);
    if(winsR.status!=='fulfilled')throw winsR.reason;
    const wins=winsR.value.flatMap(r=>(r.Results||[]).map(result=>({race:r,result})));
    const podiumItems=[winsR,p2R,p3R].flatMap(x=>x.status==='fulfilled'?x.value.flatMap(r=>(r.Results||[]).map(result=>({race:r,result}))):[]);
    const poleItems=polesR.status==='fulfilled'?polesR.value.flatMap(r=>(r.Results||[]).map(result=>({race:r,result}))):[];
    const driverWins=countRecord(wins,x=>x.result.Driver?.driverId,x=>`${x.result.Driver?.givenName||''} ${x.result.Driver?.familyName||''}`.trim());
    const podiums=countRecord(podiumItems,x=>x.result.Driver?.driverId,x=>`${x.result.Driver?.givenName||''} ${x.result.Driver?.familyName||''}`.trim());
    const poles=countRecord(poleItems,x=>x.result.Driver?.driverId,x=>`${x.result.Driver?.givenName||''} ${x.result.Driver?.familyName||''}`.trim());
    const teamWins=countRecord(wins,x=>x.result.Constructor?.constructorId,x=>x.result.Constructor?.name||'Unknown');
    // Jolpica championship standings are season-scoped; there is no supported all-seasons
    // position-1 standings endpoint. Keep a compact canonical baseline through 2025 instead
    // of issuing ~150 season-by-season requests whenever the Records cache expires.
    const driverTitles=[
      ['hamilton','Lewis Hamilton',7],['michael_schumacher','Michael Schumacher',7],['fangio','Juan Manuel Fangio',5],
      ['prost','Alain Prost',4],['vettel','Sebastian Vettel',4],['max_verstappen','Max Verstappen',4],
      ['brabham','Jack Brabham',3],['lauda','Niki Lauda',3],['piquet','Nelson Piquet',3],['senna','Ayrton Senna',3],['stewart','Jackie Stewart',3],
      ['ascari','Alberto Ascari',2],['alonso','Fernando Alonso',2],['clark','Jim Clark',2],['emerson_fittipaldi','Emerson Fittipaldi',2],
      ['graham_hill','Graham Hill',2],['hakkinen','Mika Häkkinen',2],['norris','Lando Norris',1]
    ].map(([id,label,value])=>({id,label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
    const teamTitles=[
      ['ferrari','Ferrari',16],['mclaren','McLaren',10],['williams','Williams',9],['mercedes','Mercedes',8],
      ['team_lotus','Lotus',7],['red_bull','Red Bull',6],['brabham','Brabham',2],['cooper','Cooper',2],['renault','Renault',2],
      ['benetton','Benetton',1],['brawn','Brawn',1],['brm','BRM',1],['matra','Matra',1],['tyrrell','Tyrrell',1],['vanwall','Vanwall',1]
    ].map(([id,label,value])=>({id,label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
    const data={driverWins,podiums,poles,driverTitles,teamWins,teamTitles};
    state.records.data=data;state.records.loaded=true;safeLocalSet(RECORDS_CACHE_KEY,{savedAt:Date.now(),data});renderRecords();
  }catch(err){console.error('Records load failed',err);['#recordWins','#recordPodiums','#recordPoles','#recordDriverTitles','#recordTeamWins','#recordTeamTitles'].forEach(sel=>{const el=$(sel);if(el)el.innerHTML='<p class="no-results">Historical record data is temporarily unavailable.</p>'});if(hero)hero.innerHTML='<div class="error-box"><b>Records unavailable.</b>Season data and the rest of F1 Pulse remain available.</div>'}
  finally{state.records.loading=false}
}
function seasonLeader(kind){
  const races=allRaceItems(),quali=allQualiItems();
  const src=kind==='wins'?sortedCounts(countBy(races,x=>x.result.Driver?.driverId,x=>Number(x.result.position)===1),driverLabel):kind==='podiums'?sortedCounts(countBy(races,x=>x.result.Driver?.driverId,x=>Number(x.result.position)<=3),driverLabel):kind==='poles'?sortedCounts(countBy(quali,x=>x.result.Driver?.driverId,x=>Number(x.result.position)===1),driverLabel):sortedCounts(countBy(races,x=>x.result.Driver?.driverId,x=>String(x.result.FastestLap?.rank)==='1'),driverLabel);
  return src[0]||null;
}
function renderSeasonMilestones(){
  const host=$('#seasonMilestones');if(!host)return;
  const champ=state.drivers[0],team=state.teams[0],wins=seasonLeader('wins'),poles=seasonLeader('poles'),podiums=seasonLeader('podiums'),fastest=seasonLeader('fastest');
  const items=[['Points leader',champ?driverFullName(champ):'—',champ?`${champ.points} pts`:''],['Constructor leader',team?.Constructor?.name||'—',team?`${team.points} pts`:''],['Most wins',wins?.label||'—',wins?`${wins.value} wins`:''],['Most poles',poles?.label||'—',poles?`${poles.value} poles`:''],['Most podiums',podiums?.label||'—',podiums?`${podiums.value} podiums`:''],['Most fastest laps',fastest?.label||'—',fastest?`${fastest.value}`:''],['Races completed',String(state.analytics.results.length),`${state.races.length} scheduled`],['Season',String(state.season),state.season===CURRENT_YEAR?'Current championship':'Historical archive']];
  $('#milestoneTitle').textContent=`${state.season} season milestones`;
  host.innerHTML=items.map(([label,name,val])=>`<div class="milestone-card"><small>${esc(label)}</small><strong>${esc(name)}</strong><span>${esc(val)}</span></div>`).join('');
}
function renderRecords(){
  renderSeasonMilestones(); const d=state.records.data;if(!d)return;
  $('#recordWins').innerHTML=rankRecordRows(d.driverWins);$('#recordPodiums').innerHTML=rankRecordRows(d.podiums);$('#recordPoles').innerHTML=rankRecordRows(d.poles);$('#recordDriverTitles').innerHTML=rankRecordRows(d.driverTitles);$('#recordTeamWins').innerHTML=rankRecordRows(d.teamWins);$('#recordTeamTitles').innerHTML=rankRecordRows(d.teamTitles);
  const hero=[['Grand Prix wins',d.driverWins[0]],['Podiums',d.podiums[0]],['Pole positions',d.poles[0]],['Drivers’ titles',d.driverTitles[0]]];
  $('#recordsHero').innerHTML=hero.map(([label,x])=>`<div class="record-hero-card"><small>${esc(label)}</small><strong>${esc(x?.label||'—')}</strong><em>${esc(x?.value||0)}</em></div>`).join('');
}

function loadPicks(){const p=safeLocalGet(PICKS_KEY,[]);return Array.isArray(p)?p:[]}
function savePicks(picks){safeLocalSet(PICKS_KEY,picks)}
function predictorRace(){return state.season===CURRENT_YEAR?upcomingRace():null}
function pickKey(season,round){return `${season}-${round}`}
function currentPick(r){return loadPicks().find(p=>p.key===pickKey(state.season,r.round))||null}
function driverOptionHtml(selected=''){return state.drivers.map(d=>`<option value="${esc(d.Driver.driverId)}" ${d.Driver.driverId===selected?'selected':''}>${esc(driverFullName(d))} · ${esc(constructorOfDriver(d))}</option>`).join('')}
function nameForDriverId(id){const d=state.drivers.find(x=>x.Driver.driverId===id);return d?driverFullName(d):id}
function actualPodium(round){const race=state.analytics.results.find(r=>String(r.round)===String(round));return (race?.Results||[]).slice(0,3).map(x=>x.Driver?.driverId).filter(Boolean)}
function scorePick(pick){const actual=actualPodium(pick.round);if(actual.length<3)return null;let score=0,exact=0,podium=0;pick.podium.forEach((id,i)=>{if(actual[i]===id){score+=3;exact++}else if(actual.includes(id)){score+=1;podium++}});return{score,exact,podium,actual}}
function renderPredictor(){
  const head=$('#predictorRaceHead'),form=$('#predictorForm'),history=$('#predictorHistory'),scorecard=$('#predictorScorecard');if(!head||!form)return;
  const race=predictorRace(); const picks=loadPicks().filter(p=>Number(p.season)===Number(state.season)).sort((a,b)=>Number(b.round)-Number(a.round));
  if(state.season!==CURRENT_YEAR){head.innerHTML=`<div><p class="eyebrow">ARCHIVE MODE</p><h2>${state.season} season</h2><p>Fan Picks are enabled for the current championship so predictions can be made before lights out.</p></div>`;form.innerHTML='<div class="predictor-empty">Switch the season selector to the current season to make a new race prediction.</div>'}
  else if(!race){head.innerHTML='<div><p class="eyebrow">SEASON COMPLETE</p><h2>No upcoming Grand Prix</h2><p>The prediction book is closed for this championship.</p></div>';form.innerHTML='<div class="predictor-empty">All scheduled races have been completed.</div>'}
  else{
    const saved=currentPick(race);const defaults=saved?.podium||[state.drivers[0]?.Driver?.driverId,state.drivers[1]?.Driver?.driverId,state.drivers[2]?.Driver?.driverId];state.predictor={p1:defaults[0],p2:defaults[1],p3:defaults[2]};const locked=raceDateTime(race).getTime()<=Date.now();
    head.innerHTML=`<div><p class="eyebrow">ROUND ${esc(race.round)} · ${esc(race.Circuit.Location.country)}</p><h2>${esc(race.raceName)}</h2><p>${esc(fmtSession(raceDateTime(race)))} · ${esc(race.Circuit.circuitName)}</p></div>`;
    form.innerHTML=`<div class="podium-picks"><label class="podium-pick"><span>P1 · WINNER</span><select id="pickP1" ${locked?'disabled':''}>${driverOptionHtml(state.predictor.p1)}</select></label><label class="podium-pick"><span>P2 · RUNNER-UP</span><select id="pickP2" ${locked?'disabled':''}>${driverOptionHtml(state.predictor.p2)}</select></label><label class="podium-pick"><span>P3 · PODIUM</span><select id="pickP3" ${locked?'disabled':''}>${driverOptionHtml(state.predictor.p3)}</select></label></div><div class="predictor-actions"><button type="button" data-save-pick ${locked?'disabled':''}>${saved?'Update prediction':'Save prediction'}</button>${saved&&!locked?'<button class="secondary" type="button" data-clear-pick>Clear</button>':''}</div><p class="pick-lock-note">${locked?'Race start has passed. This pick is locked.':'Predictions can be changed until the scheduled race start. Scoring: 3 points for an exact podium position, 1 point for a podium driver in the wrong position. Maximum 9 points.'}</p>`;
  }
  const scored=picks.map(p=>({p,score:scorePick(p)})).filter(x=>x.score);const total=scored.reduce((a,x)=>a+x.score.score,0),perfect=scored.filter(x=>x.score.score===9).length,best=scored.length?Math.max(...scored.map(x=>x.score.score)):0;
  scorecard.innerHTML=`<div class="scorecard-stats"><div class="scorecard-stat"><small>Predictions</small><strong>${picks.length}</strong></div><div class="scorecard-stat"><small>Scored races</small><strong>${scored.length}</strong></div><div class="scorecard-stat"><small>Total score</small><strong>${total}</strong></div><div class="scorecard-stat"><small>Best / 9</small><strong>${best}</strong></div></div><p class="intel-note">Perfect podiums: ${perfect}. Picks are stored only on this device.</p>`;
  history.innerHTML=picks.length?picks.map(p=>{const s=scorePick(p);const names=p.podiumNames||p.podium.map(nameForDriverId);return `<div class="prediction-row"><div><strong>Round ${esc(p.round)} · ${esc(p.raceName||'Grand Prix')}</strong><small>${esc(p.savedAt?new Date(p.savedAt).toLocaleDateString():'Saved pick')}</small></div><div class="prediction-podium">${names.map((n,i)=>`<span>P${i+1} ${esc(n)}</span>`).join('')}</div><div class="prediction-score">${s?`<strong>${s.score} / 9</strong><small>${s.exact} exact</small>`:'<strong>Pending</strong><small>Awaiting result</small>'}</div></div>`}).join(''):'<div class="predictor-empty">No Fan Picks saved for this season yet.</div>';
}
function saveCurrentPick(){
  const race=predictorRace();if(!race||raceDateTime(race).getTime()<=Date.now())return toast('This prediction is locked');
  const podium=[$('#pickP1')?.value,$('#pickP2')?.value,$('#pickP3')?.value];if(new Set(podium).size!==3)return toast('Choose three different drivers');
  let picks=loadPicks();const key=pickKey(state.season,race.round);const entry={key,season:state.season,round:Number(race.round),raceName:race.raceName,podium,podiumNames:podium.map(nameForDriverId),savedAt:Date.now()};const idx=picks.findIndex(p=>p.key===key);if(idx>=0)picks[idx]=entry;else picks.push(entry);savePicks(picks);toast('Fan Pick saved');renderPredictor();
}
function clearCurrentPick(){const race=predictorRace();if(!race)return;savePicks(loadPicks().filter(p=>p.key!==pickKey(state.season,race.round)));toast('Fan Pick cleared');renderPredictor()}
