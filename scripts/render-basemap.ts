import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
// Rebuild the offline map from the attributed OpenStreetMap context cache.
const raw=await readFile(new URL("../data/coimbra.map-context.json",import.meta.url),"utf8");
type Element={type:string;id:number;lat?:number;lon?:number;geometry?:{lat:number;lon:number}[];tags?:Record<string,string>};
const osm=JSON.parse(raw) as {elements:Element[];osm3s:{timestamp_osm_base:string}};
const bounds={south:40.174,west:-8.403,north:40.242,east:-8.326};
const merc=(lat:number)=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
const width=1600,height=Math.round(width*(merc(bounds.north)-merc(bounds.south))/((bounds.east-bounds.west)*Math.PI/180));
const x=(lon:number)=>(lon-bounds.west)/(bounds.east-bounds.west)*width;
const y=(lat:number)=>(merc(bounds.north)-merc(lat))/(merc(bounds.north)-merc(bounds.south))*height;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
const path=(e:Element)=>e.geometry!.map((p,i)=>`${i?"L":"M"}${x(p.lon).toFixed(1)},${y(p.lat).toFixed(1)}`).join("");
const ways=osm.elements.filter(e=>e.type==="way"&&e.geometry&&e.geometry.length>1);
const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Coimbra study area background map</title><desc>Roads, waterways, land cover and place names from OpenStreetMap contributors. Data under ODbL: https://www.openstreetmap.org/copyright</desc><rect width="100%" height="100%" fill="#f2f0e6"/>`];
for(const e of ways){const t=e.tags??{};const closed=e.geometry![0]!.lat===e.geometry!.at(-1)!.lat&&e.geometry![0]!.lon===e.geometry!.at(-1)!.lon;if(!closed||t.highway||t.waterway)continue;
  const fill=t.natural==="water"?"#c8dfe1":t.natural==="wood"||t.landuse==="forest"?"#d8e1c9":t.landuse==="residential"||t.landuse==="industrial"?"#e4e0d7":t.landuse==="farmland"||t.landuse==="orchard"?"#e7e7cf":"#e0e5d4";
  parts.push(`<path d="${path(e)}Z" fill="${fill}" stroke="#d3d9c8" stroke-width=".5"/>`);
}
for(const e of ways.filter(e=>e.tags?.waterway))parts.push(`<path d="${path(e)}" fill="none" stroke="#a6cbd0" stroke-width="${e.tags!.waterway==="river"?9:1.5}" stroke-linecap="round" stroke-linejoin="round"/>`);
const roads=ways.filter(e=>e.tags?.highway),major=(e:Element)=>/^(motorway|trunk|primary|secondary)$/.test(e.tags!.highway!);
for(const outline of [true,false])for(const e of roads){const w=major(e)?5:2.6;parts.push(`<path d="${path(e)}" fill="none" stroke="${outline?"#cbc5b9":major(e)?"#ead5ac":"#fffdf6"}" stroke-width="${w+(outline?1.8:0)}" stroke-linecap="round" stroke-linejoin="round"/>`);}
const placed:{x:number;y:number}[]=[];
for(const e of osm.elements.filter(e=>e.type==="node"&&e.tags?.name&&e.tags?.place)){const px=x(e.lon!),py=y(e.lat!);if(px<40||px>width-40||py<25||py>height-25||placed.some(p=>Math.hypot(p.x-px,p.y-py)<75))continue;placed.push({x:px,y:py});parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.5" fill="#74816f"/><text x="${px.toFixed(1)}" y="${(py-9).toFixed(1)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${e.tags!.place==="town"?22:17}" fill="#56644f" stroke="#f5f3eb" stroke-width="3" paint-order="stroke">${escape(e.tags!.name!)}</text>`);}
const refs=new Set<string>();for(const e of roads.filter(major)){const ref=e.tags!.ref;if(!ref||refs.has(ref))continue;const p=e.geometry![Math.floor(e.geometry!.length/2)]!,px=x(p.lon),py=y(p.lat);if(px<40||px>width-40||py<30||py>height-30)continue;refs.add(ref);parts.push(`<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#766342" stroke="#fffdf6" stroke-width="3" paint-order="stroke">${escape(ref)}</text>`);}
parts.push("</svg>");await mkdir(new URL("../src/assets/",import.meta.url),{recursive:true});await writeFile(new URL("../src/assets/coimbra-basemap.svg",import.meta.url),parts.join("\n"));
await writeFile(new URL("../data/coimbra.basemap.json",import.meta.url),JSON.stringify({bounds:[[bounds.south,bounds.west],[bounds.north,bounds.east]],source:"OpenStreetMap contributors",license:"ODbL-1.0",license_url:"https://www.openstreetmap.org/copyright",osm_base_timestamp:osm.osm3s.timestamp_osm_base,cache_sha256:createHash("sha256").update(raw).digest("hex"),query_file:"coimbra.map-context.query",renderer:"scripts/render-basemap.ts",features:osm.elements.length},null,2)+"\n");
console.log(`Rendered bundled map: ${ways.length} ways and ${placed.length} place labels`);
