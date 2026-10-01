const QowCityMap=()=>{
  const w=19,h=13,tiles=Array(w*h).fill("path");
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(x===0||y===0||x===w-1||y===h-1)tiles[y*w+x]="wall";
    else if((x<3||x>w-4)&&(y<4||y>8))tiles[y*w+x]="grass";
    else if((y===2||y===7)&&(x===3||x===15))tiles[y*w+x]="flower";
  }
  const blocked=[[5,3],[9,3],[13,3],[5,7],[13,7]];
  for(const [x,y] of blocked)tiles[y*w+x]="wall";
  return{key:"city-hub",w,h,tiles,region:"kanto",biome:"city",weather:"clear",timeOfDay:"day",condition:"quiet"};
};
const QowCityStatic=QowCityMap();
const QowCityServices=[
  {id:"heal",kind:"heal",x:5,y:3,label:"Pokémon-Center",detail:"Team kostenlos vollständig heilen"},
  {id:"pc",kind:"city",x:9,y:3,label:"PC-Terminal",detail:"Team und Box verwalten"},
  {id:"supplies",kind:"shop",x:13,y:3,label:"Stadtmarkt",detail:"2 Pokébälle + 1 Trank · 180 ₽"},
  {id:"tutor",kind:"tutor",x:5,y:7,label:"Move-Tutor",detail:"Moveset umbauen"},
  {id:"quest",kind:"city",x:13,y:7,label:"Quest-Brett",detail:"Nebenaufgabe suchen"},
  {id:"exit",kind:"city",x:9,y:11,label:"Stadt verlassen",detail:"Weiter zur nächsten Route"}
];
const QowCityNear=(p)=>QowCityServices.find(s=>Math.abs(s.x-p.x)+Math.abs(s.y-p.y)<=1);
const QowCityCanvas=({player:a})=>{
  const ref=X.useRef(null),prev=X.useRef({x:a.x,y:a.y});
  X.useEffect(()=>{const c=ref.current;if(!c)return;let raf=0,dead=!1;const from=prev.current,to={x:a.x,y:a.y},start=performance.now(),draw=t=>{if(dead)return;const ctx=c.getContext("2d",{alpha:!1});if(!ctx)return;ctx.imageSmoothingEnabled=!1,ctx.fillStyle="#102018",ctx.fillRect(0,0,c.width,c.height);const p=Math.min(1,(t-start)/110),ease=1-Math.pow(1-p,3),cur={x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease,prevX:a.prevX,prevY:a.prevY,facing:a.facing,walking:p<1,walkPhase:p},camera={x:-88,y:-56};for(let y=0;y<QowCityStatic.h;y++)for(let x=0;x<QowCityStatic.w;x++)QowDrawTile(ctx,0,0,y,x,camera,QowCityStatic);for(const s of QowCityServices)QowDrawEntity(ctx,s,s.x,s.y,0,camera);QowDrawPlayer(ctx,cur,null,camera);ctx.fillStyle="rgba(7,18,22,.78)",ctx.fillRect(82,251,316,26),ctx.fillStyle="#dce8e9",ctx.font="bold 11px monospace",ctx.textAlign="center",ctx.textBaseline="middle";const near=QowCityNear(a);ctx.fillText(near?"E · "+near.label:"WASD bewegen · E interagieren",240,264);if(p<1)raf=requestAnimationFrame(draw);else prev.current=to};raf=requestAnimationFrame(draw);const redraw=()=>{cancelAnimationFrame(raf),raf=requestAnimationFrame(draw)};window.addEventListener("pokeregions:overworld-assets",redraw);return()=>{dead=!0,cancelAnimationFrame(raf),window.removeEventListener("pokeregions:overworld-assets",redraw)}},[a.x,a.y,a.facing,a.steps]);
  return l.jsx("canvas",{ref,className:"ow-city-canvas",width:480,height:320,"aria-label":"Begehbare PokéRegions Stadt"});
};
function c4({run:a,dispatch:i,onPc:d}){
  const [p,setP]=X.useState({x:9,y:10,prevX:9,prevY:10,facing:"up",steps:0}),[service,setService]=X.useState(null),held=X.useRef(new Set),lastDir=X.useRef("up"),lastMove=X.useRef(0);
  const move=X.useCallback((dir)=>{const now=performance.now();if(now-lastMove.current<92)return;lastMove.current=now,setP(v=>{const dx=dir==="left"?-1:dir==="right"?1:0,dy=dir==="up"?-1:dir==="down"?1:0,nx=v.x+dx,ny=v.y+dy,tile=QowTile(QowCityStatic,nx,ny);if(QowBlocking(tile))return{...v,facing:dir};return{x:nx,y:ny,prevX:v.x,prevY:v.y,facing:dir,steps:v.steps+1}})},[]);
  const interact=X.useCallback(()=>{const s=QowCityNear(p);if(!s)return;if(s.id==="heal")i({type:"cityService",service:"heal"});else if(s.id==="supplies")i({type:"cityService",service:"supplies"});else if(s.id==="quest")i({type:"cityService",service:"quest"});else if(s.id==="pc")d();else if(s.id==="tutor")setService(v=>v==="tutor"?null:"tutor");else if(s.id==="exit")i({type:"leave"})},[p,i,d]);
  X.useEffect(()=>{let raf=0,dead=!1;const dirs={w:"up",arrowup:"up",s:"down",arrowdown:"down",a:"left",arrowleft:"left",d:"right",arrowright:"right"},down=e=>{if(["INPUT","TEXTAREA","SELECT"].includes(e.target?.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;const key=e.key.toLowerCase(),dir=dirs[key];if(dir){e.preventDefault(),held.current.add(dir),lastDir.current=dir,move(dir);return}if(key==="e"||e.key==="Enter"||e.key===" "){e.preventDefault(),interact()}},up=e=>{const dir=dirs[e.key.toLowerCase()];dir&&held.current.delete(dir)},tick=t=>{if(dead)return;const dir=held.current.has(lastDir.current)?lastDir.current:[...held.current].at(-1);dir&&t-lastMove.current>=112&&move(dir),raf=requestAnimationFrame(tick)};window.addEventListener("keydown",down,{capture:!0}),window.addEventListener("keyup",up,{capture:!0}),raf=requestAnimationFrame(tick);return()=>{dead=!0,cancelAnimationFrame(raf),held.current.clear(),window.removeEventListener("keydown",down,{capture:!0}),window.removeEventListener("keyup",up,{capture:!0})}},[move,interact]);
  const near=QowCityNear(p);
  return l.jsxs("div",{className:"ow-city-hub",children:[
    l.jsxs("header",{className:"ow-city-head",children:[l.jsxs("div",{children:[l.jsx("small",{children:"STADT · BEGEHBARER HUB"}),l.jsx("strong",{children:a.node?.location??"PokéRegions Stadt"})]}),l.jsx("span",{children:String(a.cityVisits??0)+". Besuch"})]}),
    l.jsx(QowCityCanvas,{player:p}),
    l.jsxs("div",{className:"ow-city-status",children:[l.jsx("b",{children:near?"E · "+near.label:"Erkunde die Stadt"}),l.jsx("span",{children:near?.detail??"Pokémon-Center · Markt · PC · Tutor · Quest-Brett"})]}),
    a.message&&l.jsx("p",{className:"ow-city-message",children:a.message}),
    service==="tutor"&&l.jsxs("div",{className:"ow-city-service-panel",children:[l.jsxs("div",{className:"ow-city-service-title",children:[l.jsx("strong",{children:"MOVE-TUTOR"}),l.jsx("button",{type:"button",onClick:()=>setService(null),children:"×"})]}),l.jsx(lb,{run:a,dispatch:i,city:!0})]})
  ]})
}