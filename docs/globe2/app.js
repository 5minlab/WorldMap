// UTF-8 Korean-safe globe v2
const canvas = document.getElementById('globe');
const ctx = canvas.getContext('2d');
const DPR = Math.max(1, window.devicePixelRatio || 1);

const colors = {
  ocean: '#0b4da2',
  graticule: 'rgba(160,200,255,0.15)',
  boundary: '#9e9e9e',
  selectedFill: 'rgba(46,141,239,0.45)',
  selectedEdge: '#bfe1ff',
  capital: '#ffd166',
  capitalEdge: '#ffffff'
};

let needsRender = true;
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(2, Math.round(rect.width * DPR));
  canvas.height = canvas.width;
  needsRender = true;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const projection = d3.geoOrthographic().scale(1).translate([0,0]).clipAngle(90).precision(0.3);
const path = d3.geoPath(projection, ctx);
const graticule = d3.geoGraticule10();

let features = [];
let boundaryMesh = null;
let capitals = [];
const nameByCcn3 = new Map();
const capByCcn3 = new Map();

let selected = null;
let isDragging = false;
let lastPos = [0,0];
let lastRotate = [0,0,0];

// zoom: 2x => drag speed 1/2
let zoom = 1; const ZOOM_MIN=0.5, ZOOM_MAX=6, ZOOM_RESP=0.0016, DRAG_EXP=1;

function fitProjection(){ const w=canvas.width,h=canvas.height; const scale=Math.min(w,h)*0.47*zoom; projection.translate([w/2,h/2]).scale(scale); }
function clear(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle=colors.ocean; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.lineJoin='round'; ctx.lineCap='round'; }

function drawGraticule(){ ctx.beginPath(); path(graticule); ctx.strokeStyle=colors.graticule; ctx.lineWidth=1*DPR; ctx.stroke(); }
function drawBoundaries(){ if(!boundaryMesh && !features.length) return; ctx.beginPath(); if(boundaryMesh) path(boundaryMesh); else features.forEach(f=>path(f)); ctx.strokeStyle=colors.boundary; ctx.lineWidth=0.9*DPR; ctx.stroke(); }
function drawSelection(){ if(!selected) return; ctx.save(); ctx.beginPath(); path(selected); ctx.fillStyle=colors.selectedFill; ctx.fill(); ctx.beginPath(); path(selected); ctx.clip(); ctx.beginPath(); if(boundaryMesh) path(boundaryMesh); ctx.strokeStyle=colors.selectedEdge; ctx.lineWidth=2*DPR; ctx.stroke(); ctx.restore(); }
function drawStarPath(cx,cy,outer,inner,p=5){ const step=Math.PI/p; ctx.beginPath(); for(let i=0;i<p*2;i++){ const r=i%2===0?outer:inner; const a=i*step-Math.PI/2; const x=cx+r*Math.cos(a), y=cy+r*Math.sin(a); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); }
function drawCapitals(){ ctx.save(); capitals.forEach(c=>{ const p=projection([c.lon,c.lat]); if(!p) return; const [x,y]=p; const outer=50*DPR, inner=25*DPR; drawStarPath(x,y,outer,inner,5); ctx.fillStyle=colors.capital; ctx.strokeStyle=colors.capitalEdge; ctx.lineWidth=Math.max(0.8*DPR, outer*0.25); ctx.fill(); ctx.stroke(); }); ctx.restore(); }

function render(){ fitProjection(); clear(); drawGraticule(); drawBoundaries(); drawSelection(); drawCapitals(); }
function loop(){ if(needsRender){ render(); needsRender=false; } requestAnimationFrame(loop); }
requestAnimationFrame(loop);

function setHud(t){ document.getElementById('hud').textContent=t; }

canvas.addEventListener('mousedown', ev=>{ if(ev.button!==0) return; isDragging=true; lastPos=[ev.clientX,ev.clientY]; lastRotate=projection.rotate(); ev.preventDefault(); });
window.addEventListener('mousemove', ev=>{ if(!isDragging) return; const dx=ev.clientX-lastPos[0], dy=ev.clientY-lastPos[1]; const base=0.30, sens=base/Math.pow(zoom,DRAG_EXP); const r=[ lastRotate[0]+dx*sens, lastRotate[1]-dy*sens, lastRotate[2] ]; r[1]=Math.max(-89.9, Math.min(89.9, r[1])); projection.rotate(r); needsRender=true; });
window.addEventListener('mouseup', ()=>{ isDragging=false; });
canvas.addEventListener('wheel', ev=>{ ev.preventDefault(); const k=Math.exp(-ev.deltaY*ZOOM_RESP); zoom=Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom*k)); needsRender=true; }, {passive:false});

// hover selects + HUD
canvas.addEventListener('mousemove', ev=>{
  if(isDragging) return;
  const rect=canvas.getBoundingClientRect();
  const x=(ev.clientX-rect.left)*DPR, y=(ev.clientY-rect.top)*DPR;
  const lonlat=projection.invert([x,y]); if(!lonlat) return;
  const f=features.find(ft=>d3.geoContains(ft,lonlat)); selected=f||null;
  if(selected){
    const id=String(selected.id||'').padStart(3,'0');
    const propName=(selected.properties&&(selected.properties.name||selected.properties.ADMIN||selected.properties.admin))||'';
    const name=nameByCcn3.get(id) || propName || '국가';
    const cap=capByCcn3.get(id)||null;
    setHud(cap ? `${name} — 수도: ${cap.capital}` : `${name} — 수도 없음`);
  } else {
    setHud('좌클릭: 국가 선택 · 휠: 확대/축소');
  }
  needsRender=true;
});

canvas.addEventListener('click', ev=>{
  if(ev.button!==0) return;
  const rect=canvas.getBoundingClientRect();
  const x=(ev.clientX-rect.left)*DPR, y=(ev.clientY-rect.top)*DPR;
  const lonlat=projection.invert([x,y]); if(!lonlat) return;
  const f=features.find(ft=>d3.geoContains(ft,lonlat)); selected=f||null; needsRender=true;
});

async function loadData(){
  async function fetchWithFallback(urls){ let last; for(const u of urls){ try{ const r=await fetch(u,{cache:'force-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }catch(e){ last=e; } } throw last||new Error('모든 소스에서 로드 실패'); }
  const topo = await fetchWithFallback([
    '../globe/data/countries-110m.json',
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
  ]);
  if(topo?.objects?.countries){ features=d3.geoPath ? topojson.feature(topo, topo.objects.countries).features : []; boundaryMesh=topojson.mesh(topo, topo.objects.countries, (a,b)=>a!==b); }
  else if(Array.isArray(topo?.features)){ features=topo.features; boundaryMesh=null; }
  else { throw new Error('countries data not found'); }

  const rows = await fetchWithFallback([
    '../globe/data/countries.json',
    'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json',
    'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'
  ]);
  capitals=[]; nameByCcn3.clear(); capByCcn3.clear();
  rows.forEach(row=>{
    const ccn3=row.ccn3||''; if(!ccn3) return; const id3=String(ccn3).padStart(3,'0');
    const nameKo=(row.translations&&row.translations.kor&&(row.translations.kor.common||row.translations.kor.official))
      || (row.name&&row.name.nativeName&&row.name.nativeName.kor&&row.name.nativeName.kor.common)
      || '';
    const name=nameKo || row.name?.common || row.name?.official || '';
    if(name) nameByCcn3.set(id3,name);
    const capName=Array.isArray(row.capital)?row.capital[0]:row.capital;
    const ll=row.capitalInfo && Array.isArray(row.capitalInfo.latlng) ? row.capitalInfo.latlng : null;
    if(capName && ll && ll.length===2){ const cap={ name, capital:capName, ccn3:id3, lat:+ll[0], lon:+ll[1] }; capitals.push(cap); capByCcn3.set(id3,cap); }
  });

  resizeCanvas(); needsRender=true; setHud('좌클릭: 국가 선택 · 휠: 확대/축소');
}

setHud('데이터 불러오는 중...');
loadData().catch(err=>{ console.error(err); setHud('데이터 로드 실패: docs/globe/data/ 확인 또는 네트워크 확인'); });

