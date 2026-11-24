// Extra cards: outlook chart + weather detail boxes (uses state/t/wmo/hourIndex from script.js)
const E = { aqi:null, key:"", pending:false };
const mins = iso => +iso.slice(11,13)*60 + +iso.slice(14,16);
const clock = hhmm => { let [h,m]=hhmm.split(":").map(Number); const ap=h>=12?"PM":"AM"; h=h%12||12; return [`${h}:${String(m).padStart(2,"0")}`,ap]; };
const timeHtml = ([a,b]) => `${a}<small>${b}</small>`;
const mcard = (title,viz,label,desc) => `<div class="mcard"><h3>${title}</h3><div class="viz">${viz}</div>${label?`<strong>${label}</strong>`:""}<p>${desc||""}</p></div>`;
const trend = (a,b) => b-a>0.4?"Rising":b-a<-0.4?"Falling":"Steady";
const DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

function gauge(v,max,color){
  const R=50,C=2*Math.PI*R,A=.75*C,f=Math.min(1,v/max),ang=(135+270*f)*Math.PI/180;
  return `<svg viewBox="0 0 120 120" class="gauge"><circle cx="60" cy="60" r="${R}" class="trk" stroke-dasharray="${A} ${C}" transform="rotate(135 60 60)"/>
  <circle cx="60" cy="60" r="${R}" class="prg" stroke="${color}" stroke-dasharray="${A*f} ${C}" transform="rotate(135 60 60)"/>
  <circle cx="${60+R*Math.cos(ang)}" cy="${60+R*Math.sin(ang)}" r="6" fill="${color}" stroke="#fff" stroke-width="2"/><text x="60" y="70" class="gv">${v}</text></svg>`;
}
function spark(a,idx,color){
  const mn=Math.min(...a),rg=(Math.max(...a)-mn)||1,W=300,H=70;
  const P=a.map((v,k)=>[k/(a.length-1)*W, H-8-(v-mn)/rg*(H-18)]);
  const path = pts => pts.map((p,k)=>(k?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" class="spark"><path d="${path(P)}" class="sp-bg"/><path d="${path(P.slice(0,idx+1))}" class="sp-fg" stroke="${color}"/>
  <circle cx="${P[idx][0]}" cy="${P[idx][1]}" r="7" fill="${color}" stroke="#fff" stroke-width="3"/></svg>`;
}
function arc(frac,color){
  const pts=[]; for(let s=0;s<=40;s++){const u=s/40; pts.push(`${(10+180*u).toFixed(1)},${(80-62*Math.sin(Math.PI*u)).toFixed(1)}`);}
  const fc=Math.min(1,Math.max(0,frac)), x=10+180*fc, y=80-62*Math.sin(Math.PI*fc);
  return `<svg viewBox="0 0 200 90" class="arc"><line x1="0" y1="80" x2="200" y2="80" class="hz"/><polyline points="${pts.join(" ")}" class="ar-bg"/>
  <polyline points="${pts.slice(0,Math.round(fc*40)+1).join(" ")}" class="ar-fg" stroke="${color}"/><circle class="ep" cx="10" cy="80" r="4"/><circle class="ep" cx="190" cy="80" r="4"/>
  <circle cx="${x}" cy="${y}" r="7" fill="${color}" stroke="#fff" stroke-width="2" opacity="${frac>=0&&frac<=1?1:.5}"/></svg>`;
}
const level = (v,L) => L.find(l => v<=l[0]) || L[L.length-1];

async function getAqi(){
  const {lat,lon}=state.place, key=lat+","+lon;
  if(E.key===key||E.pending) return; E.pending=true;
  try{
    const r=await (await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5`)).json();
    E.aqi=r.current; E.key=key;
  }catch{ E.aqi=null; E.key=key; }
  E.pending=false; renderExtras();
}

function renderOutlook(i){
  const d=state.data, h=d.hourly, sr=mins(d.daily.sunrise[0]), ss=mins(d.daily.sunset[0]), N=24, W=72, H=110;
  const idx=[...Array(N).keys()].map(k=>i+k).filter(k=>k<h.time.length);
  const temps=idx.map(k=>t(h.temperature_2m[k])), mn=Math.min(...temps), rg=(Math.max(...temps)-mn)||1;
  const today=h.temperature_2m.slice(0,24), hiK=today.indexOf(Math.max(...today)), loK=today.indexOf(Math.min(...today));
  $("olSub").textContent=`Today's high will be ${t(today[hiK])}° around ${clock(h.time[hiK].slice(11))[0]} ${clock(h.time[hiK].slice(11))[1]}, with a low of ${t(today[loK])}°.`;
  const cols=idx.map((k,n)=>{
    const m=mins(h.time[k]), night=m<sr||m>=ss, code=h.weather_code[k];
    const ic=night&&code<=1?"🌙":wmo(code)[1];
    return `<div class="ol-col ${n===0?"now":""}">${n===0?"Now":h.time[k].slice(11)}<i>${ic}</i></div>`;}).join("");
  const P=temps.map((v,n)=>[W/2+n*W, H-18-(v-mn)/rg*(H-58)]);
  const svg=`<svg class="ol-svg" width="${idx.length*W}" height="${H}"><path d="${P.map((p,n)=>(n?"L":"M")+p[0]+" "+p[1]).join(" ")}" fill="none" stroke="#e8832a" stroke-width="2.5"/>`+
    P.map((p,n)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#e8832a"/><text x="${p[0]}" y="${p[1]-12}">${temps[n]}°</text>`).join("")+`</svg>`;
  $("olScroll").innerHTML=`<div class="ol-inner" style="width:${idx.length*W}px"><div class="ol-row">${cols}</div>${svg}</div>`;
}

function renderExtras(){
  const d=state.data; if(!d) return;
  const c=d.current, h=d.hourly, i=hourIndex(), tz=state.place.tz, day=h.time.slice(0,24);
  const cl=clock(c.time.slice(11,16)); $("detTime").textContent=cl[0]+" "+cl[1];
  renderOutlook(i);

  // ---- Grid 1
  const temps=h.temperature_2m.slice(0,24), feels=h.apparent_temperature.slice(0,24);
  const hi=temps.indexOf(Math.max(...temps)), tr=trend(temps[i%24],temps[Math.min(23,i%24+3)]);
  const diff=c.apparent_temperature-c.temperature_2m;
  const cloud=c.cloud_cover, cloudTxt=cloud<=10?"Clear":cloud<=40?"Partly cloudy":cloud<=75?"Mostly cloudy":"Overcast";
  const rain=h.precipitation.slice(i,i+24).reduce((a,b)=>a+b,0);
  const dir=c.wind_direction_10m, dn=DIRS[Math.round(dir/22.5)%16];
  const hum=c.relative_humidity_2m, humTxt=hum<30?"Dry":hum<60?"Comfortable":hum<80?"Humid":"Very humid";
  const ws=Math.round(c.wind_speed_10m), force=ws<2?"0 (Calm)":ws<6?"1 (Light air)":ws<12?"2 (Light breeze)":ws<20?"3 (Gentle breeze)":ws<29?"4 (Moderate)":"5+ (Strong)";
  $("grid1").innerHTML=[
    mcard("Temperature",`<div style="width:100%">${spark(temps,i%24,"#d8283c")}<div class="big" style="text-align:right">${t(c.temperature_2m)}°</div></div>`,tr,`Peak of ${t(temps[hi])}° around ${clock(h.time[hi].slice(11))[0]} ${clock(h.time[hi].slice(11))[1]}.`),
    mcard("Feels like",`<div style="width:100%">${spark(feels,i%24,"#e0687a")}<div class="sp-row"><span>Feels like: <span class="big">${t(c.apparent_temperature)}°</span></span><span>Temperature: <span class="big">${t(c.temperature_2m)}°</span></span></div></div>`,
      Math.abs(diff)<1.5?"Similar":diff>0?"Warmer":"Cooler",diff>=1.5?"Feels warmer than the actual temperature.":diff<=-1.5?"Feels cooler than the actual temperature.":"Feels about the same as the actual temperature."),
    mcard("Cloud cover",`<div class="disc">${cloudTxt}</div>`,`${cloudTxt} (${cloud}%)`,`Cloud cover at ${cl[0]} ${cl[1]}.`),
    mcard("Precipitation",`<div class="disc"><span class="big">${rain.toFixed(1)}<small>mm</small></span><small>In next 24h</small></div>`,rain<0.1?"No Precipitation":"Precipitation expected",rain<0.1?"No precipitation in the next 24 hours.":`About ${rain.toFixed(1)} mm expected in the next 24 hours.`),
    mcard("Wind",`<div class="wrow"><svg viewBox="0 0 120 120" class="compass"><circle class="ring" cx="60" cy="60" r="50"/><text x="60" y="16">N</text><text x="108" y="64">E</text><text x="60" y="112">S</text><text x="12" y="64">W</text>
      <g transform="rotate(${dir} 60 60)"><path d="M60 22 L68 62 L60 58 L52 62Z" fill="#6fb3ff"/></g></svg>
      <div class="wst">From ${dn} (${dir}°)<br><b>${ws}</b>km/h Wind Speed<br><b>${Math.round(c.wind_gusts_10m)}</b>km/h Wind Gust</div></div>`,`Force: ${force}`,`Wind from ${dn} at ${ws} km/h.`),
    mcard("Humidity",`<div class="wrow" style="justify-content:center"><div class="hbars">${[...Array(7)].map(()=>`<i><u style="height:${hum}%"></u></i>`).join("")}</div>
      <div><span class="big">${hum}%</span><p>Relative Humidity</p><span class="big">${t(c.dew_point_2m)}°</span><p>Dew point</p></div></div>`,humTxt,`Relative humidity is ${hum}% right now.`)
  ].join("");

  // ---- Grid 2
  const uvNow=Math.round(h.uv_index[i]), uvDay=h.uv_index.slice(0,24), uvMax=Math.max(...uvDay), uvK=uvDay.indexOf(uvMax);
  const [,uvL,uvC]=level(uvNow,[[2,"Low","#7ac943"],[5,"Moderate","#f7d117"],[7,"High","#f7931e"],[10,"Very high","#e0393e"],[99,"Extreme","#7b3fa0"]]);
  const aq=E.key===state.place.lat+","+state.place.lon?E.aqi:null;
  const [,aqL,aqC]=aq?level(aq.us_aqi,[[50,"Good","#4cc36b"],[100,"Moderate","#f1c40f"],[150,"Unhealthy (sensitive)","#f39c12"],[200,"Poor","#d9531e"],[300,"Very poor","#8e44ad"],[999,"Hazardous","#7d1a2b"]]):[0,"…","#888"];
  const vis=h.visibility[i]/1000, vb=vis>=10?5:vis>=6?4:vis>=3?3:vis>=1?2:1, visMax=Math.max(...h.visibility.slice(0,24))/1000;
  const p=Math.round(c.surface_pressure), pt=trend(h.surface_pressure[Math.max(0,i-3)],h.surface_pressure[i]);
  const sr=d.daily.sunrise[0], ss=d.daily.sunset[0], nowM=mins(c.time), sf=(nowM-mins(sr))/(mins(ss)-mins(sr)), dl=mins(ss)-mins(sr);
  let moon={}; try{ moon=SunCalc.getMoonTimes(new Date(),state.place.lat,state.place.lon); }catch{}
  const fm=x=>x?new Date(x).toLocaleTimeString("en-US",{timeZone:tz,hour:"numeric",minute:"2-digit"}).split(" "):["—",""];
  let mf=-1,md="";
  if(moon.rise&&moon.set){ let rs=+moon.rise,st=+moon.set; if(st<rs) st+=864e5; mf=(Date.now()-rs)/(st-rs); const mm=Math.round((st-rs)/6e4); md=`${Math.floor(mm/60)} hrs ${mm%60} mins`; }
  $("grid2").innerHTML=[
    mcard("UV",gauge(uvNow,11,uvC),uvL,`Maximum UV today is ${Math.round(uvMax)}, expected at ${clock(h.time[uvK].slice(11))[0]} ${clock(h.time[uvK].slice(11))[1]}.`),
    mcard("AQI",gauge(aq?aq.us_aqi:0,300,aqC),aqL,aq?`US AQI. PM2.5: ${aq.pm2_5} µg/m³.`:"Air quality data unavailable."),
    mcard("Visibility",`<div style="width:100%"><div class="vbars">${[30,50,70,85,100].map((w,k)=>`<i class="${k<vb?"on":""}" style="width:${w}%;order:${-k}"></i>`).join("")}<span class="big">${vis>=10?"10+":vis.toFixed(1)}<small>km</small></span></div></div>`,vis>=8?"Good":vis>=4?"Fair":"Poor",`Peak visibility today is ${visMax>=10?"10+":visMax.toFixed(1)} km.`),
    mcard("Pressure",`<div style="width:100%"><div class="pslide"><b style="left:${Math.min(100,Math.max(0,(p-980)/60*100))}%"></b></div><span class="big">${p}<small>mb</small></span></div>`,pt,`Compared with 3 hours ago.`),
    mcard("Sun",`<div style="width:100%">${arc(sf,"#d8404f")}<div class="dur">${Math.floor(dl/60)} hrs ${dl%60} mins</div><div class="tt"><span><b>${timeHtml(clock(sr.slice(11)))}</b>Sunrise</span><span><b>${timeHtml(clock(ss.slice(11)))}</b>Sunset</span></div></div>`),
    mcard("Moon",`<div style="width:100%">${arc(mf,"#f7931e")}<div class="dur">${md||"—"}</div><div class="tt"><span><b>${timeHtml(fm(moon.rise))}</b>Moonrise</span><span><b>${timeHtml(fm(moon.set))}</b>Moonset</span></div></div>`)
  ].join("");
  getAqi();
}

$("olPrev").onclick=()=>$("olScroll").scrollLeft-=360;
$("olNext").onclick=()=>$("olScroll").scrollLeft+=360;
