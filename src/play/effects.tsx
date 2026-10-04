import { useEffect, useRef, useState } from "react";
/** Translucent foam rises from the bottom edge, leaving the story's centre quiet. */
export function River({reduced}:{reduced:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(reduced)return;
    const el=canvas.current,ctx=el?.getContext("2d");if(!el||!ctx)return;
    let frame=0,last=0,time=0,average=16,limit=65;
    const bubbles=Array.from({length:80},(_,i)=>({x:((i*137.508)%100)/100,r:18+(i*17%65),speed:18+i%25,offset:(i*733)%11000,wave:i*1.7}));
    const draw=(now:number)=>{
      const dt=last?Math.min(now-last,60):16;last=now;time+=dt;average=.96*average+.04*dt;
      if(average>25)limit=Math.max(25,limit-1);
      const w=el.clientWidth,h=el.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5);
      if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      bubbles.slice(0,limit).forEach((b,i)=>{
        const age=(time+b.offset)%19000,travel=age/1000*b.speed;
        const r=b.r*(w<600?.65:1),x=b.x*w+Math.sin(age/2200+b.wave)*24,y=h+r+100-travel;
        if(y>h+r||y< -r)return;
        const alpha=Math.min(1,time/1500)*Math.max(0,Math.min(.7,y/h));
        ctx.save();ctx.globalAlpha=alpha;
        const fill=ctx.createRadialGradient(x-r*.3,y-r*.35,r*.02,x,y,r);
        fill.addColorStop(0,"rgba(255,255,255,.1)");fill.addColorStop(.75,"rgba(239,241,232,.05)");fill.addColorStop(.92,i%2?"rgba(159,189,178,.16)":"rgba(191,174,164,.17)");fill.addColorStop(1,"rgba(255,255,255,.8)");
        ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
        ctx.lineWidth=.8;ctx.strokeStyle="rgba(100,128,116,.24)";ctx.stroke();
        ctx.beginPath();ctx.ellipse(x-r*.3,y-r*.42,r*.22,r*.08,-.6,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,.9)";ctx.fill();ctx.restore();
      });
      frame=requestAnimationFrame(draw);
    };
    const visibility=()=>{cancelAnimationFrame(frame);last=0;if(!document.hidden)frame=requestAnimationFrame(draw);};
    document.addEventListener("visibilitychange",visibility);visibility();
    return()=>{cancelAnimationFrame(frame);document.removeEventListener("visibilitychange",visibility);};
  },[reduced]);
  return <div className="foam-field" aria-hidden="true">{reduced?<div className="foam-still"/>:<canvas ref={canvas}/>}</div>;
}
export function Count({value,reduced}:{value:number;reduced:boolean}){
  const [display,setDisplay]=useState(value),previous=useRef(value);
  useEffect(()=>{if(reduced){previous.current=value;setDisplay(value);return;}const start=performance.now(),from=previous.current;let frame=0;const draw=(now:number)=>{const p=Math.min(1,(now-start)/650);setDisplay(Math.round(from+(value-from)*p));if(p<1)frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);previous.current=value;return()=>cancelAnimationFrame(frame);},[value,reduced]);
  return <strong aria-label={`${value} candidate reaches`}>{display}</strong>;
}
export function useSound(){
  const context=useRef<AudioContext|null>(null),[enabled,setEnabled]=useState(false);
  useEffect(()=>()=>{void context.current?.close();},[]);
  function toggle(){if(enabled){setEnabled(false);void context.current?.suspend();}else{context.current??=new AudioContext();void context.current.resume();setEnabled(true);}}
  function ping(){if(!enabled||!context.current)return;const audio=context.current,osc=audio.createOscillator(),gain=audio.createGain();osc.frequency.value=440;gain.gain.setValueAtTime(.025,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.2);}
  return {enabled,toggle,ping};
}
