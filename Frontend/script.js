// Data: Open-Meteo (free, no API key)
const $ = id => document.getElementById(id);
const state = { place:{name:"Los Angeles",region:"California, United States",lat:34.05,lon:-118.24,tz:"America/Los_Angeles"},
  data:null, unit:"C", tab:"today", clockTz:"local", slotOffset:0 };

const WMO = {0:["Clear","☀️"],1:["Mostly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Overcast","☁️"],45:["Fog","🌫️"],48:["Fog","🌫️"],
  51:["Drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Drizzle","🌦️"],61:["Rain","🌧️"],63:["Rain","🌧️"],65:["Heavy rain","🌧️"],
  71:["Snow","🌨️"],73:["Snow","🌨️"],75:["Heavy snow","❄️"],80:["Showers","🌦️"],81:["Showers","🌦️"],82:["Heavy showers","⛈️"],
  95:["Thunderstorm","⛈️"],96:["Thunderstorm","⛈️"],99:["Thunderstorm","⛈️"]};
const wmo = c => WMO[c] || ["Unknown","🌡️"];
const t = c => Math.round(state.unit==="C" ? c : c*9/5+32);

async function load(){
  const {lat,lon} = state.place;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+
    `&current=temperature_2m,relative_humidity_2m,weather_code,surface_pressure,wind_speed_10m,dew_point_2m,apparent_temperature,cloud_cover,wind_direction_10m,wind_gusts_10m`+
    `&hourly=temperature_2m,weather_code,visibility,uv_index,apparent_temperature,precipitation,surface_pressure`+
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset`+
    `&timezone=auto&forecast_days=7`;
  try{
    const r = await fetch(url); state.data = await r.json();
    state.place.tz = state.data.timezone;
    render();
  }catch(e){ msg("Could not load weather. Check your internet connection.",true); }
}

function hourIndex(){ // index in hourly arrays matching current hour at the location
  const cur = state.data.current.time.slice(0,13);
  return Math.max(0, state.data.hourly.time.findIndex(x => x.startsWith(cur)));
}

function render(){
  const d = state.data, c = d.current, [txt,ico] = wmo(c.weather_code);
  $("temp").textContent = t(c.temperature_2m);
  $("condText").textContent = txt; $("condIcon").textContent = ico;
  $("city").textContent = state.place.name; $("region").textContent = state.place.region;
  $("unitC").classList.toggle("active", state.unit==="C");
  $("unitF").classList.toggle("active", state.unit==="F");
  renderTab(); renderSlots(); tick(); if(window.renderExtras) renderExtras();
}

function renderTab(){
  const d = state.data, c = d.current, i = hourIndex(), h = d.hourly, body = $("tabBody");
  if(state.tab==="today"){
    const vis = h.visibility[i]; 
    const rows = [
      ["💧","Humidity",`${c.relative_humidity_2m}%`],
      ["⏲","Pressure",`${Math.round(c.surface_pressure)} mb`],
      ["👁","Visibility", vis>=10000 ? "Unlimited" : `${(vis/1000).toFixed(1)} km`],
      ["🌬","Wind",`${Math.round(c.wind_speed_10m)} km/h`],
      ["☀","UV Index",`${Math.round(h.uv_index[i])} of 10`],
      ["🌡","Dew Point",`${t(c.dew_point_2m)}°`]];
    body.innerHTML = `<div class="stats">${rows.map(r=>`<div class="stat"><span class="ic">${r[0]}</span><span class="k">${r[1]}</span><span class="v">${r[2]}</span></div>`).join("")}</div>`;
  } else if(state.tab==="hourly"){
    let out=""; for(let k=i;k<i+24;k++){
      out+=`<div class="row"><span>${h.time[k].slice(11)}</span><span>${wmo(h.weather_code[k])[1]} ${wmo(h.weather_code[k])[0]}</span><b>${t(h.temperature_2m[k])}°</b></div>`;}
    body.innerHTML = `<div class="list">${out}</div>`;
  } else {
    const dd = d.daily;
    body.innerHTML = `<div class="list">${dd.time.map((day,k)=>{
      const n = new Date(day+"T12:00").toLocaleDateString("en",{weekday:"short",day:"numeric",month:"short"});
      return `<div class="row"><span>${n}</span><span>${wmo(dd.weather_code[k])[1]} ${wmo(dd.weather_code[k])[0]}</span><b>${t(dd.temperature_2m_max[k])}° / ${t(dd.temperature_2m_min[k])}°</b></div>`;}).join("")}</div>`;
  }
}

function renderSlots(){
  const h = state.data.hourly, today = state.data.current.time.slice(0,10);
  const slots = [["🌅","Morning",9],["☀️","Afternoon",14],["🌇","Evening",19],["🌙","Night",23]];
  $("slots").innerHTML = slots.map(([ic,name,hr])=>{
    const k = h.time.findIndex(x=>x===`${today}T${String(hr).padStart(2,"0")}:00`);
    return `<div class="slot">${ic}<br>${name}<b>${t(h.temperature_2m[k])}<small>°${state.unit.toLowerCase()}</small></b></div>`;}).join("");
}

function tick(){
  if(!state.data) return;
  const tz = state.clockTz==="local" ? state.place.tz : state.clockTz, now = new Date();
  $("time").textContent = now.toLocaleTimeString("en-US",{timeZone:tz,hour:"2-digit",minute:"2-digit"});
  $("date").textContent = now.toLocaleDateString("en-GB",{timeZone:tz,weekday:"long",day:"numeric",month:"short",year:"numeric"});
}

// Events
$("unitC").onclick = ()=>{state.unit="C";render()};
$("unitF").onclick = ()=>{state.unit="F";render()};
$("tabs").onclick = e=>{ const b=e.target.closest("button"); if(!b) return;
  state.tab=b.dataset.tab; [...$("tabs").children].forEach(x=>x.classList.toggle("active",x===b)); renderTab(); };
$("tzList").onclick = e=>{ const b=e.target.closest("button"); if(!b) return;
  state.clockTz=b.dataset.tz; [...$("tzList").children].forEach(x=>x.classList.toggle("active",x===b)); tick(); };
$("slotNext").onclick = ()=>{ const s=$("slots"); s.scrollLeft += 116; if(s.scrollLeft+s.clientWidth>=s.scrollWidth-4) s.scrollLeft=0; };
// ---------- Search ----------
const GEO = "https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=";
let debounce;
const msg = (text,info) => { $("msg").hidden=!text; $("msg").textContent=text||""; $("msg").classList.toggle("info",!!info); };
const label = p => [p.admin1,p.country].filter(Boolean).join(", ");

async function geocode(q){
  const r = await fetch(GEO+encodeURIComponent(q));
  if(!r.ok) throw new Error("geo");
  return (await r.json()).results || [];
}
function pick(p){
  state.place={name:p.name,region:label(p),lat:p.latitude,lon:p.longitude,tz:p.timezone};
  $("searchInput").value=""; $("suggestions").hidden=true; msg("");
  return load();
}

$("searchInput").addEventListener("input",e=>{
  clearTimeout(debounce);
  const q=e.target.value.trim();
  if(q.length<2){ $("suggestions").hidden=true; return; }
  debounce=setTimeout(async()=>{
    try{
      const res=await geocode(q), ul=$("suggestions");
      ul.innerHTML=res.map((p,i)=>`<li data-i="${i}">${p.name}<small>${label(p)}</small></li>`).join("");
      ul.hidden=!res.length; ul._res=res;
    }catch{ $("suggestions").hidden=true; }
  },300);
});
$("suggestions").addEventListener("click",e=>{
  const li=e.target.closest("li"); if(li) pick($("suggestions")._res[li.dataset.i]);
});
document.addEventListener("click",e=>{ if(!e.target.closest(".search-box")) $("suggestions").hidden=true; });

$("searchForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const q=$("searchInput").value.trim();
  if(!q) return msg("Please enter a city name.");
  const btn=$("searchBtn"); btn.disabled=true; msg("Searching…",true);
  try{
    const res=await geocode(q);
    if(!res.length) msg(`No city found for "${q}". Check the spelling and try again.`);
    else await pick(res[0]);
  }catch{ msg("Couldn't reach the weather service. Check your internet connection."); }
  btn.disabled=false;
});

if($("changeLoc")) $("changeLoc").onclick=()=>$("searchInput").focus();
load(); setInterval(tick,1000);
