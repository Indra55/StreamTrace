import { useSyncExternalStore,type AnchorHTMLAttributes } from "react";
let forcedDemo=false;
export function demoMode(){const mode=new URLSearchParams(location.search).get("mode");if(mode==="live")return false;if(mode==="demo")return true;try{return forcedDemo || window.sessionStorage.getItem("streamtrace.mode.v2")==="demo";}catch{return forcedDemo;}}
export function setDemoMode(demo:boolean){forcedDemo=demo;try{window.sessionStorage.setItem("streamtrace.mode.v2",demo?"demo":"live");}catch{/* In-memory mode remains available. */}window.dispatchEvent(new Event("popstate"));}
export function navigate(path:string,replace=false){history[replace?"replaceState":"pushState"](null,"",path);window.dispatchEvent(new Event("popstate"));}
export function useRoute(){return useSyncExternalStore(listener=>{window.addEventListener("popstate",listener);window.addEventListener("hashchange",listener);return()=>{window.removeEventListener("popstate",listener);window.removeEventListener("hashchange",listener);};},()=>location.pathname+location.search+location.hash,()=>"/");}
export function Link({href="/",onClick,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){return <a {...props} href={href} onClick={e=>{onClick?.(e);if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||props.target)return;e.preventDefault();navigate(href);}}/>;}
export function CitizenFrame({children,simulated,taskWording=false}: {children:React.ReactNode;simulated:boolean;taskWording?:boolean}) {return <>
  {simulated&&<div className="prototype-banner" role="note">{taskWording ? "Demo mode: simulated task facts may be sent for wording. No reports are saved." : "Demo mode: simulated data, nothing is saved or sent."}</div>}
  <main id="main-content" tabIndex={-1} className="citizen-page">{children}</main>
</>;}
