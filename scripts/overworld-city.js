const QowMakeCityMap=()=>{
  const w=19,h=13,tiles=Array(w*h).fill("path");
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(x===0||y===0||x===w-1||y===h-1)tiles[y*w+x]="wall";
    else if((x<3||x>w-4)&&(y<4||y>8))tiles[y*w+x]="grass";
    else if((y===2||y===7)&&(x===3||x===15))tiles[y*w+x]="flower";
  }
  for(const [x,y] of [[5,3],[9,3],[13,3],[5,7],[13,7]])tiles[y*w+x]="wall";
  return{key:"city-hub",w,h,tiles,region:"kanto",biome:"city",weather:"clear",timeOfDay:"day",condition:"quiet"};
};
const QowMakeCenterMap=()=>{
  const w=13,h=9,tiles=Array(w*h).fill("path");
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1)tiles[y*w+x]="wall";
  for(let x=3;x<=8;x++)tiles[2*w+x]="wall";
  tiles[7*w+6]="path";
  return{key:"city-center",w,h,tiles,region:"kanto",biome:"city",weather:"clear",timeOfDay:"day",condition:"quiet"};
};
const QowCityStatic=QowMakeCityMap(),QowCenterStatic=QowMakeCenterMap();
const QowCityServices=[
  {id:"center",kind:"city",x:5,y:3,label:"Pokémon-Center betreten",detail:"Nurse, Heilung und PC"},
  {id:"pc",kind:"city",x:9,y:3,label:"PC-Terminal",detail:"Team und Box verwalten"},
  {id:"supplies",kind:"shop",x:13,y:3,label:"Stadtmarkt",detail:"2 Pokébälle + 1 Trank · 180 ₽"},
  {id:"tutor",kind:"tutor",x:5,y:7,label:"Move-Tutor",detail:"Moveset umbauen"},
  {id:"quest",kind:"city",x:13,y:7,label:"Quest-Brett",detail:"Nebenaufgabe suchen"},
  {id:"exit",kind:"city",x:9,y:11,label:"Stadt verlassen",detail:"Weiter zur nächsten Route"}
];
const QowCenterServices=[
  {id:"heal",kind:"heal",x:6,y:2,label:"Mit Nurse sprechen",detail:"Team, Status und AP kostenlos heilen"},
  {id:"center-pc",kind:"city",x:10,y:3,label:"PC öffnen",detail:"Team und Box verwalten"},
  {id:"center-exit",kind:"city",x:6,y:7,label:"Pokémon-Center verlassen",detail:"Zurück in die Stadt"}
];
const QowSceneNear=(services,p)=>services.find(s=>Math.abs(s.x-p.x)+Math.abs(s.y-p.y)<=1);
const QowCityCanvas=({player:a,map:i,services:d,scene:r})=>{
  const ref=X.useRef(null),prev=X.useRef({x:a.x,y:a.y,scene:r});
  X.useEffect(()=>{const c=ref.current;if(!c)return;let raf=0,dead=!1;const sameScene=prev.current.scene===r,from=sameScene?prev.current:{x:a.x,y:a.y},to={x:a.x,y:a.y},start=performance.now(),mapW=i.w*QowTileSize,mapH=i.h*QowTileSize,camera={x:-(c.width-mapW)/2,y:-(c.height-mapH)/2},draw=t=>{if(dead)return;const ctx=c.getContext("2d",{alpha:!1});if(!ctx)return;ctx.imageSmoothingEnabled=!1,ctx.fillStyle=r==="center"?"#182521":"#102018",ctx.fillRect(0,0,c.width,c.height);const q=Math.min(1,(t-start)/110),ease=1-Math.pow(1-q,3),cur={x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease,prevX:a.prevX,prevY:a.prevY,facing:a.facing,walking:q<1,walkPhase:q};for(let y=0;y<i.h;y++)for(let x=0;x<i.w;x++)QowDrawTile(ctx,0,0,y,x,camera,i);if(r==="center"){ctx.fillStyle="rgba(225,234,224,.15)",ctx.fillRect((3*16)-camera.x,(1*16)-camera.y,6*16,16);ctx.fillStyle="rgba(236,91,104,.25)",ctx.fillRect((4*16)-camera.x,(1*16)-camera.y,4*16,4)}for(const s of d)QowDrawEntity(ctx,s,s.x,s.y,0,camera);QowDrawPlayer(ctx,cur,null,camera);ctx.fillStyle="rgba(7,18,22,.82)",ctx.fillRect(70,270,340,27),ctx.fillStyle="#dce8e9",ctx.font="bold 11px monospace",ctx.textAlign="center",ctx.textBaseline="middle";const near=QowSceneNear(d,a);ctx.fillText(near?"E · "+near.label:"WASD bewegen · E interagieren",240,284);if(q<1)raf=requestAnimationFrame(draw);else prev.current={...to,scene:r}};raf=requestAnimationFrame(draw);const redraw=()=>{cancelAnimationFrame(raf),raf=requestAnimationFrame(draw)};window.addEventListener("pokeregions:overworld-assets",redraw);return()=>{dead=!0,cancelAnimationFrame(raf),window.removeEventListener("pokeregions:overworld-assets",redraw)}},[a.x,a.y,a.facing,a.steps,i.key,r]);
  return l.jsx("canvas",{ref,className:"ow-city-canvas",width:480,height:320,"aria-label":r==="center"?"Begehbares Pokémon-Center":"Begehbare PokéRegions Stadt"});
};
function c4({run:a,dispatch:i,onPc:d}){
  const [scene,setScene]=X.useState("city"),[p,setP]=X.useState({x:9,y:10,prevX:9,prevY:10,facing:"up",steps:0}),[service,setService]=X.useState(null),held=X.useRef(new Set),lastDir=X.useRef("up"),lastMove=X.useRef(0);
  const map=scene==="center"?QowCenterStatic:QowCityStatic,services=scene==="center"?QowCenterServices:QowCityServices;
  const place=(nextScene,x,y,facing="up")=>{setScene(nextScene),setService(null),setP(v=>({x,y,prevX:x,prevY:y,facing,steps:v.steps}))};
  const move=X.useCallback((dir)=>{const now=performance.now();if(now-lastMove.current<92)return;lastMove.current=now,setP(v=>{const dx=dir==="left"?-1:dir==="right"?1:0,dy=dir==="up"?-1:dir==="down"?1:0,nx=v.x+dx,ny=v.y+dy,tile=QowTile(scene==="center"?QowCenterStatic:QowCityStatic,nx,ny);if(QowBlocking(tile))return{...v,facing:dir};return{x:nx,y:ny,prevX:v.x,prevY:v.y,facing:dir,steps:v.steps+1}})},[scene]);
  const interact=X.useCallback(()=>{const s=QowSceneNear(scene==="center"?QowCenterServices:QowCityServices,p);if(!s)return;if(s.id==="center")place("center",6,6,"up");else if(s.id==="heal")i({type:"cityService",service:"heal"});else if(s.id==="supplies")setService(v=>v==="market"?null:"market");else if(s.id==="quest")setService(v=>v==="quests"?null:"quests");else if(s.id==="pc"||s.id==="center-pc")d();else if(s.id==="tutor")setService(v=>v==="tutor"?null:"tutor");else if(s.id==="center-exit")place("city",5,4,"down");else if(s.id==="exit")i({type:"leave"})},[p,scene,i,d]);
  X.useEffect(()=>{let raf=0,dead=!1;const dirs={w:"up",arrowup:"up",s:"down",arrowdown:"down",a:"left",arrowleft:"left",d:"right",arrowright:"right"},down=e=>{if(["INPUT","TEXTAREA","SELECT"].includes(e.target?.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;const key=e.key.toLowerCase(),dir=dirs[key];if(dir){e.preventDefault(),held.current.add(dir),lastDir.current=dir,move(dir);return}if(key==="e"||e.key==="Enter"||e.key===" "){e.preventDefault(),interact();return}if(key==="m"||e.key==="Escape"){e.preventDefault(),document.querySelector(".pr-game-menu-toggle")?.click()}},up=e=>{const dir=dirs[e.key.toLowerCase()];dir&&held.current.delete(dir)},tick=t=>{if(dead)return;const dir=held.current.has(lastDir.current)?lastDir.current:[...held.current].at(-1);dir&&t-lastMove.current>=112&&move(dir),raf=requestAnimationFrame(tick)};window.addEventListener("keydown",down,{capture:!0}),window.addEventListener("keyup",up,{capture:!0}),raf=requestAnimationFrame(tick);return()=>{dead=!0,cancelAnimationFrame(raf),held.current.clear(),window.removeEventListener("keydown",down,{capture:!0}),window.removeEventListener("keyup",up,{capture:!0})}},[move,interact]);
  const near=QowSceneNear(services,p);
  return l.jsxs("div",{className:"ow-city-hub scene-"+scene,children:[
    l.jsxs("header",{className:"ow-city-head",children:[l.jsxs("div",{children:[l.jsx("small",{children:scene==="center"?"POKÉMON-CENTER · INNENRAUM":"STADT · BEGEHBARER HUB"}),l.jsx("strong",{children:scene==="center"?"Pokémon-Center":a.node?.location??"PokéRegions Stadt"})]}),l.jsx("span",{children:scene==="center"?"HEILUNG · PC":String(a.cityVisits??0)+". Besuch"})]}),
    l.jsx(QowCityCanvas,{player:p,map,services,scene}),
    l.jsx(QowTouchPad,{move,interact,menu:()=>document.querySelector(".pr-game-menu-toggle")?.click()}),
    l.jsxs("div",{className:"ow-city-status",children:[l.jsx("b",{children:near?"E · "+near.label:scene==="center"?"Erkunde das Pokémon-Center":"Erkunde die Stadt"}),l.jsx("span",{children:near?.detail??(scene==="center"?"Nurse · PC · Ausgang":"Pokémon-Center · Markt · PC · Tutor · Quest-Brett")})]}),
    a.message&&l.jsx("p",{className:"ow-city-message",children:a.message}),
    service&&scene==="city"&&l.jsxs("div",{className:"ow-city-service-panel service-"+service,children:[l.jsxs("div",{className:"ow-city-service-title",children:[l.jsx("strong",{children:service==="tutor"?"MOVE-TUTOR":service==="market"?"STADTMARKT":"QUEST-BRETT"}),l.jsx("button",{type:"button",onClick:()=>setService(null),children:"×"})]}),service==="tutor"?l.jsx(lb,{run:a,dispatch:i,city:!0}):service==="market"?l.jsxs("div",{className:"ow-city-market",children:[l.jsx("p",{children:"Ein kleines Reise-Paket für den nächsten Abschnitt."}),l.jsxs("article",{children:[l.jsx("strong",{children:"Vorratspaket"}),l.jsx("span",{children:"2 Pokébälle + 1 Trank"}),l.jsxs("b",{children:["180 ₽ · Du hast ",a.money??0," ₽"]})]}),l.jsx("button",{type:"button",className:"primary",disabled:(a.money??0)<180,onClick:()=>i({type:"cityService",service:"supplies"}),children:(a.money??0)>=180?"Für 180 ₽ kaufen":"Nicht genug Geld"})]}):l.jsxs("div",{className:"ow-city-quests",children:[l.jsx("p",{children:"Nebenmissionen laufen während des Runs automatisch mit und zahlen ihre Belohnung sofort aus."}),l.jsx("div",{className:"ow-city-quest-list",children:(a.quests??[]).map(q=>l.jsxs("article",{className:q.completed?"done":"",children:[l.jsxs("div",{children:[l.jsx("strong",{children:q.title}),l.jsx("small",{children:q.text})]}),l.jsx("div",{className:"ow-city-quest-progress",children:l.jsx("i",{style:{width:String(Math.min(100,(q.progress??0)/Math.max(1,q.target??1)*100))+"%"}})}),l.jsxs("span",{children:[q.completed?"✓ ":String(q.progress??0)+"/"+String(q.target??0)+" · ",q.reward]})]},q.id))}),l.jsx("button",{type:"button",className:"primary",onClick:()=>i({type:"cityService",service:"quest"}),children:"Neue Nebenmission annehmen"})]})]})
  ]})
}