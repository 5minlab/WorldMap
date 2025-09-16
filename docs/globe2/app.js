// UTF-8 Korean-safe globe v2 (clean re-write)
const canvas = document.getElementById('globe');
const ctx = canvas.getContext('2d');
const DPR = Math.max(1, window.devicePixelRatio || 1);

const colors = {
  bg: '#9e9e9e',
  ocean: '#0b4da2',
  graticule: 'rgba(160,200,255,0.15)',
  boundary: '#9e9e9e',
  selectedFill: 'rgba(46,141,239,0.45)',
  selectedEdge: '#bfe1ff',
  capital: '#ffd166',
  capitalEdge: '#ffffff'
};

let needsRender = true;
function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.max(2, Math.round(rect.width * DPR));
  canvas.height = canvas.width;
  needsRender = true;
}
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const projection = d3.geoOrthographic().scale(1).translate([0,0]).clipAngle(90).precision(0.3);
const path = d3.geoPath(projection, ctx);
const graticule = d3.geoGraticule10();

let features = [];    // countries
let boundaryMesh=null;// borders
let landGeom = null;  // land multipolygon
let capitals = [];    // capitals
const nameByCcn3 = new Map();
const capByCcn3  = new Map();

let selected=null, isDragging=false, lastPos=[0,0], lastRotate=[0,0,0];
let zoom=1; const ZOOM_MIN=0.5, ZOOM_MAX=6, ZOOM_RESP=0.0016, DRAG_EXP=1; // 2x -> 1/2 speed

function fitProjection(){ const w=canvas.width,h=canvas.height; const s=Math.min(w,h)*0.47*zoom; projection.translate([w/2,h/2]).scale(s); }
function clear(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle=colors.bg; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.lineJoin='round'; ctx.lineCap='round'; }
function drawSphere(){ ctx.beginPath(); path({type:'Sphere'}); ctx.fillStyle=colors.ocean; ctx.fill(); }
function drawGraticule(){ ctx.beginPath(); path(graticule); ctx.strokeStyle=colors.graticule; ctx.lineWidth=1*DPR; ctx.stroke(); }
function drawLandFill(){ if(!landGeom) return; ctx.beginPath(); path(landGeom); ctx.fillStyle='#000000'; ctx.fill(); }
function drawCoastline(){ if(!landGeom) return; ctx.beginPath(); path(landGeom); ctx.strokeStyle='#4a7fb5'; ctx.lineWidth=1.2*DPR; ctx.stroke(); }
function drawBoundaries(){ if(!boundaryMesh && !features.length) return; ctx.beginPath(); if(boundaryMesh) path(boundaryMesh); else features.forEach(f=>path(f)); ctx.strokeStyle=colors.boundary; ctx.lineWidth=0.9*DPR; ctx.stroke(); }
function drawSelection(){ if(!selected) return; ctx.save(); ctx.beginPath(); path(selected); ctx.fillStyle=colors.selectedFill; ctx.fill(); ctx.beginPath(); path(selected); ctx.clip(); ctx.beginPath(); if(boundaryMesh) path(boundaryMesh); ctx.strokeStyle=colors.selectedEdge; ctx.lineWidth=2*DPR; ctx.stroke(); ctx.restore(); }
function drawStarPath(cx,cy,outer,inner,p=5){ const step=Math.PI/p; ctx.beginPath(); for(let i=0;i<p*2;i++){ const r=i%2===0?outer:inner; const a=i*step-Math.PI/2; const x=cx+r*Math.cos(a), y=cy+r*Math.sin(a); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); }
function drawCapitals(){ if(!capitals||!capitals.length) return; ctx.save(); capitals.forEach(c=>{ const p=projection([c.lon,c.lat]); if(!p) return; const [x,y]=p; const outer=5*DPR, inner=2.5*DPR; drawStarPath(x,y,outer,inner,5); ctx.fillStyle=colors.capital; ctx.strokeStyle=colors.capitalEdge; ctx.lineWidth=Math.max(0.8*DPR, outer*0.25); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x,y,2*DPR,0,Math.PI*2); ctx.fillStyle='#ffffff'; ctx.fill(); }); ctx.restore(); }

function render(){ fitProjection(); clear(); drawSphere(); drawGraticule(); drawLandFill(); drawBoundaries(); drawCoastline(); drawSelection(); drawCapitals(); }
function loop(){ if(needsRender){ render(); needsRender=false; } requestAnimationFrame(loop); } requestAnimationFrame(loop);
function setHud(t){ document.getElementById('hud').textContent=t; }
const statusEl = document.getElementById('status');
function renderStatus(st){ if(!statusEl) return; const pill=(n,ok)=>`<span class="badge ${ok?'ok':'fail'}">${n}: ${ok?'OK':'FAIL'}</span>`; statusEl.innerHTML=[pill('경계',st.boundary), pill('해안선',st.land), pill('수도',st.capitals)].join(''); }

canvas.addEventListener('mousedown', ev=>{ if(ev.button!==0) return; isDragging=true; lastPos=[ev.clientX,ev.clientY]; lastRotate=projection.rotate(); ev.preventDefault(); });
window.addEventListener('mousemove', ev=>{ if(!isDragging) return; const dx=ev.clientX-lastPos[0], dy=ev.clientY-lastPos[1]; const base=0.30, sens=base/Math.pow(zoom,DRAG_EXP); const r=[ lastRotate[0]+dx*sens, lastRotate[1]-dy*sens, lastRotate[2] ]; r[1]=Math.max(-89.9, Math.min(89.9, r[1])); projection.rotate(r); needsRender=true; });
window.addEventListener('mouseup', ()=>{ isDragging=false; });
canvas.addEventListener('wheel', ev=>{ ev.preventDefault(); const k=Math.exp(-ev.deltaY*ZOOM_RESP); zoom=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoom*k)); needsRender=true; }, {passive:false});

// hover selects + HUD (no capital name in HUD)
canvas.addEventListener('mousemove', ev=>{ if(isDragging) return; const rect=canvas.getBoundingClientRect(); const x=(ev.clientX-rect.left)*DPR, y=(ev.clientY-rect.top)*DPR; const lonlat=projection.invert([x,y]); if(!lonlat) return; const f=features.find(ft=>d3.geoContains(ft,lonlat)); selected=f||null; if(selected){ const id=String(selected.id||'').padStart(3,'0'); const propName=(selected.properties&&(selected.properties.name||selected.properties.ADMIN||selected.properties.admin))||''; const name=nameByCcn3.get(id)||propName||'국가'; setHud(`${name}`);} else { setHud('좌클릭: 국가 선택 · 휠: 확대/축소'); } needsRender=true; });

canvas.addEventListener('click', ev=>{ if(ev.button!==0) return; const rect=canvas.getBoundingClientRect(); const x=(ev.clientX-rect.left)*DPR, y=(ev.clientY-rect.top)*DPR; const lonlat=projection.invert([x,y]); if(!lonlat) return; const f=features.find(ft=>d3.geoContains(ft,lonlat)); selected=f||null; needsRender=true; });

async function fetchWithFallback(urls){ const DEV=/localhost|127\.0\.0\.1/.test(window.location.hostname); let last; for(const u of urls){ try{ const ver= DEV ? (u+(u.includes('?')?'&':'?')+'v='+Date.now()) : u; const r=await fetch(ver,{ cache: DEV?'no-store':'force-cache' }); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }catch(e){ last=e; } } throw last||new Error('모든 소스에서 로드 실패'); }

async function loadData(){
  const st={boundary:false, land:false, capitals:false};
  // 1) Countries (boundaries) — and build N3->ISO3 map
  const iso3ByN3=new Map();
  try{
    const topo=await fetchWithFallback([
      '../globe/data/countries-110m.json','/globe/data/countries-110m.json',
      '/docs/globe/data/countries-110m.json', window.location.origin+'/docs/globe/data/countries-110m.json',
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
    ]);
    if(topo?.objects?.countries){
      features=topojson.feature(topo, topo.objects.countries).features;
      boundaryMesh=topojson.mesh(topo, topo.objects.countries,(a,b)=>a!==b);
    }else if(Array.isArray(topo?.features)){
      features=topo.features; boundaryMesh=null;
    }else{ throw new Error('countries data not found'); }
    // build map
    features.forEach(f=>{ const n3=String(f.id||'').padStart(3,'0'); const iso3=f.properties?.iso_a3||f.properties?.ISO_A3||f.properties?.adm0_a3||''; if(n3&&iso3) iso3ByN3.set(n3, iso3); });
    st.boundary=true;
  }catch(e){ console.error(e); st.boundary=false; }

  // 2) Land (coastline)
  try{
    const landTopo=await fetchWithFallback([
      '../globe/data/land-110m.json','/globe/data/land-110m.json',
      '/docs/globe/data/land-110m.json', window.location.origin+'/docs/globe/data/land-110m.json',
      'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json'
    ]);
    if(landTopo?.objects?.land){ landGeom=topojson.feature(landTopo, landTopo.objects.land); }
    else if(landTopo?.type==='FeatureCollection'){ landGeom=landTopo; }
    st.land=!!landGeom;
  }catch(e){ console.error(e); st.land=false; }

  // 3) Natural Earth capitals (admin-0)
  let neCaps=new Map();
  try{
    const ne=await fetchWithFallback([
      '../globe/data/ne_110m_populated_places_simple.geojson',
      '/globe/data/ne_110m_populated_places_simple.geojson',
      '/docs/globe/data/ne_110m_populated_places_simple.geojson',
      window.location.origin + '/docs/globe/data/ne_110m_populated_places_simple.geojson',
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_populated_places_simple.geojson',
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson'
    ]);
    if(ne && Array.isArray(ne.features)){
      const map=new Map();
      ne.features.forEach(f=>{ const p=f.properties||{}; const cls=(p.featurecla||p.featureclass||'').toLowerCase(); if(cls.includes('capital')){ const iso3=p.adm0_a3||p.iso_a3||p.sov_a3||''; const g=f.geometry; if(iso3&&g&&g.type==='Point'&&Array.isArray(g.coordinates)&&g.coordinates.length===2){ const lon=+g.coordinates[0], lat=+g.coordinates[1]; const nm=p.name||p.nameascii||p.namealt||''; if(!map.has(iso3)) map.set(iso3,{name:nm, lat, lon}); } } });
      neCaps=map;
    }
  }catch(e){ console.warn('Natural Earth capitals load failed', e); }

  // 4) Countries/Capitals (mledoze) and merge
  try{
    const rows=await fetchWithFallback([
      '../globe/data/countries.json','/globe/data/countries.json',
      '/docs/globe/data/countries.json', window.location.origin+'/docs/globe/data/countries.json',
      'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json',
      'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'
    ]);
    capitals=[]; nameByCcn3.clear(); capByCcn3.clear();
    rows.forEach(row=>{
      const ccn3=row.ccn3||''; if(!ccn3) return; const id3=String(ccn3).padStart(3,'0');
      const iso3=row.cca3 || iso3ByN3.get(id3) || '';
      const nameKo=(row.translations&&row.translations.kor&&(row.translations.kor.common||row.translations.kor.official))||(row.name&&row.name.nativeName&&row.name.nativeName.kor&&row.name.nativeName.kor.common)||'';
      const name=nameKo||row.name?.common||row.name?.official||''; if(name) nameByCcn3.set(id3,name);
      let capName=Array.isArray(row.capital)?row.capital[0]:row.capital;
      const capInfo=(row.capitalInfo&&Array.isArray(row.capitalInfo.latlng))?row.capitalInfo.latlng:null;
      const countryCenter=(row.latlng&&Array.isArray(row.latlng)&&row.latlng.length===2)?row.latlng:null;
      let ll=null;
      if(capInfo) ll=capInfo;
      else if(iso3 && neCaps.has(iso3)) { const nc=neCaps.get(iso3); ll=[nc.lat, nc.lon]; capName=capName||nc.name; }
      else if(capName && countryCenter) ll=countryCenter;
      if(ll && ll.length===2){ const cap={ name, capital: capName||name, ccn3:id3, lat:+ll[0], lon:+ll[1] }; capitals.push(cap); capByCcn3.set(id3,cap); }
    });
    st.capitals=capitals.length>0;
  }catch(e){ console.error(e); st.capitals=false; }

  renderStatus(st); resizeCanvas(); needsRender=true; setHud('좌클릭: 국가 선택 · 휠: 확대/축소');
}

setHud('데이터 불러오는 중...');
loadData().catch(err=>{ console.error(err); setHud('데이터 로드 실패: docs/globe/data/ 확인 또는 네트워크 확인'); });


