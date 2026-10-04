import { useEffect, useRef } from "react";
import { timeline } from "./timeline.ts";
/** Drivers click the rendered controls; their disabled state is the action guard. */
export function clickAction(root:HTMLElement|null,selector:string){const target=root?.querySelector<HTMLButtonElement|HTMLInputElement>(selector);if(!target||target.disabled)return false;target.focus();target.click();return true;}
export function useAutoplay({enabled,reduced,speed,chapter,step,advance,ready}: {enabled:boolean;reduced:boolean;speed:number;chapter:number;step:()=>boolean;advance:()=>void;ready:()=>boolean}) {
  const callbacks=useRef({step,advance,ready});callbacks.current={step,advance,ready};
  const elapsed=useRef(0);
  useEffect(()=>{elapsed.current=0;},[chapter]);
  useEffect(()=>{
    if(!enabled||reduced)return;
    let last=performance.now(),actionTime=0;
    const timer=setInterval(()=>{const now=performance.now(),delta=now-last;last=now;if(document.hidden)return;elapsed.current+=delta*speed;actionTime+=delta*speed;
      if(actionTime>=1600){actionTime=0;callbacks.current.step();}
      if(elapsed.current>=timeline[chapter]!.seconds*1000&&callbacks.current.ready())callbacks.current.advance();
    },100);
    return()=>clearInterval(timer);
  },[enabled,reduced,speed,chapter]);
}
