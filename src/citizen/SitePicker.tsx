import { useState } from "react";
import { network,type Network } from "../demo.ts";
import { nearestSite } from "./model.ts";
export default function SitePicker({value,onChange,data=network}: {data?:Network;value:string;onChange:(code:string,distance?:number)=>void}) {
  const [view,setView]=useState<"list"|"map">("list"),[message,setMessage]=useState(""),[locating,setLocating]=useState(false);
  const coords=data.sites.map(s=>s.coordinates),minLon=Math.min(...coords.map(c=>c[0]!)),maxLon=Math.max(...coords.map(c=>c[0]!)),minLat=Math.min(...coords.map(c=>c[1]!)),maxLat=Math.max(...coords.map(c=>c[1]!));
  const position=(c:readonly number[])=>({x:25+(c[0]!-minLon)/(maxLon-minLon)*270,y:25+(maxLat-c[1]!)/(maxLat-minLat)*350});
  return <>
    <div className="citizen-choice-row"><button type="button" aria-pressed={view==="list"} onClick={()=>setView("list")}>List of sites</button><button type="button" aria-pressed={view==="map"} onClick={()=>setView("map")}>Map of sites</button></div>
    {view==="map" ? <svg className="citizen-map" viewBox="0 0 320 400" role="group" aria-label="Numbered observation sites">
      <title>Coimbra observation sites</title>
      {data.reaches.map(r=><polyline key={r.id} points={r.geometry.map(c=>{const p=position(c);return `${p.x},${p.y}`;}).join(" ")} fill="none" stroke="#b9cbd1" strokeWidth="2"/>)}
      {data.sites.map(s=>{const p=position(s.coordinates);return <g key={s.code} role="button" tabIndex={0} aria-label={`Select site ${s.code}`} aria-pressed={s.code===value} transform={`translate(${p.x},${p.y})`} onClick={()=>onChange(s.code)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onChange(s.code);}}}><circle r="24" fill={s.code===value?"#245b83":"#fdfcf7"} stroke="#245b83" strokeWidth="2"/><text textAnchor="middle" y="5" fill={s.code===value?"white":"#24343b"}>{s.code}</text></g>;})}
    </svg> : <div className="citizen-site-list">{data.sites.map(s=><button type="button" key={s.code} aria-label={`Site ${s.code}`} aria-pressed={value===s.code} onClick={()=>onChange(s.code)}><span className="site-badge">{s.code}</span> Site {s.code}</button>)}</div>}
    <button type="button" disabled={locating} onClick={()=>{
      if(!navigator.geolocation){setMessage("Location is unavailable. Choose a site from the list.");return;}
      setLocating(true);setMessage("Finding the nearest site...");
      navigator.geolocation.getCurrentPosition(location=>{
        setLocating(false);
        if(location.coords.accuracy>300){setMessage("Location is not accurate enough. Please choose a site.");return;}
        const snapped=nearestSite(location.coords.latitude,location.coords.longitude,data.sites);
        if(!snapped){setMessage("No site is within 300 m. Please choose a site from the list.");return;}
        onChange(snapped.code,snapped.distance);setMessage(`Nearest site: ${snapped.code}, about ${snapped.distance} m away, change?`);
      },()=>{setLocating(false);setMessage("Location permission was denied or unavailable. Choose a site from the list.");},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
    }}>Use my location</button>
    <p role="status" aria-live="polite">{message}</p><small>Map sites are StreamTrace prototype identifiers. Only a site code and approximate distance are saved.</small>
  </>;
}
