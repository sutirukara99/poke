function x4({run:y,route:a,step:i,path:d=[],revealed:r,region:u,dispatch:h,arena:m=!1}){
const Qm=QowBuild(y),Qstored=y?.journey?.overworld,Qp=Qstored?.mapKey===Qm.key?Qstored:{mapKey:Qm.key,x:Qm.spawn.x,y:Qm.spawn.y,prevX:Qm.spawn.x,prevY:Qm.spawn.y,facing:"up",steps:0,grassSteps:0,danger:0,picked:[],defeatedTrainers:[],pendingNode:null,encounterOnly:!1,debugSalt:Qstored?.debugSalt??0,seen:QowVisible(Qm.spawn.x,Qm.spawn.y,5,Qm.w,Qm.h),lastMessage:"Erkunde das Gebiet."},Qf=QowFront(Qp),QnearPickup=Qm.pickups.find(Q=>(Q.x===Qf.x&&Q.y===Qf.y||Q.x===Qp.x&&Q.y===Qp.y)&&!(Qp.picked??[]).includes(Q.id)),QnearDest=Qm.destinations.find(Q=>Q.x===Qf.x&&Q.y===Qf.y||Q.x===Qp.x&&Q.y===Qp.y),Qprompt=QnearPickup?"E · Item-Ball öffnen":QnearDest?"E · "+QowKindLabel(QnearDest.kind):Qp.lastMessage??"WASD bewegen · E interagieren",U=we[u]?.maps[Math.min(y?.mapIndex??0,(we[u]?.maps?.length??1)-1)],Qteam=(y?.team??[]).slice(0,6),Qbadges=Array.isArray(y?.badges)?y.badges.length:0,Qfloor=(y?.mode==="endless"?y?.endlessStage??0:y?.mapIndex??0)+1,Qlead=Qteam[0]?st(Qteam[0].species,Qteam[0].shiny):null,[Qdebug,QsetDebug]=X.useState(!1),Qheld=X.useRef(new Set),QlastDir=X.useRef("up"),QlastMove=X.useRef(0);
X.useEffect(()=>{const Qid=Qstored?.pendingNode;Qid&&h({type:"overworldTrigger",id:Qid})},[Qstored?.pendingNode,h]);
X.useEffect(()=>{let Qraf=0,Qdead=!1;const Qdirs={w:"up",arrowup:"up",s:"down",arrowdown:"down",a:"left",arrowleft:"left",d:"right",arrowright:"right"},Qmove=(Qdir,Qnow=performance.now())=>{if(Qnow-QlastMove.current<92)return;QlastMove.current=Qnow,QlastDir.current=Qdir,h({type:"overworldMove",dir:Qdir})},Qdown=e=>{if(["INPUT","TEXTAREA","SELECT"].includes(e.target?.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;const k=e.key.toLowerCase(),dir=Qdirs[k];if(dir){e.preventDefault(),e.stopPropagation(),Qheld.current.add(dir),QlastDir.current=dir,Qmove(dir);return}if(k==="e"||e.key==="Enter"||e.key===" "){e.preventDefault(),e.stopPropagation(),h({type:"overworldInteract"});return}if(k==="m"||e.key==="Escape"){e.preventDefault(),e.stopPropagation(),document.querySelector(".pr-game-menu-toggle")?.click();return}if(e.key==="F2"){e.preventDefault(),QsetDebug(v=>!v)}},Qup=e=>{const dir=Qdirs[e.key.toLowerCase()];dir&&Qheld.current.delete(dir)},Qtick=t=>{if(Qdead)return;const dir=Qheld.current.has(QlastDir.current)?QlastDir.current:[...Qheld.current].at(-1);dir&&t-QlastMove.current>=112&&Qmove(dir,t),Qraf=requestAnimationFrame(Qtick)};window.addEventListener("keydown",Qdown,{capture:!0}),window.addEventListener("keyup",Qup,{capture:!0}),Qraf=requestAnimationFrame(Qtick);return()=>{Qdead=!0,cancelAnimationFrame(Qraf),Qheld.current.clear(),window.removeEventListener("keydown",Qdown,{capture:!0}),window.removeEventListener("keyup",Qup,{capture:!0})}},[h,Qm.key]);
return l.jsxs("section",{className:"free-roam-overworld rogue-floor canvas-overworld region-"+u+" biome-"+Qm.biome+" weather-"+Qm.weather+" time-"+Qm.timeOfDay+" condition-"+Qm.condition+(m?" overworld-arena":""),children:[
l.jsxs("div",{className:"ow-viewport",tabIndex:0,"aria-label":"PokéRegions Overworld. WASD oder Pfeiltasten bewegen, E interagieren, M öffnet das Menü.",children:[
l.jsxs("header",{className:"ow-hud",children:[
l.jsxs("div",{className:"ow-area",children:[l.jsx("small",{children:we[u].name.toUpperCase()+" · FLOOR "+String(Qfloor).padStart(2,"0")}),l.jsx("strong",{children:U?.name??we[u].name}),l.jsx("span",{children:Qm.biome.toUpperCase()+" · "+QowConditionLabel(Qm.condition)+" · "+Qm.timeOfDay.toUpperCase()+(Qm.weather!=="clear"?" · "+Qm.weather.toUpperCase():"")})]}),
l.jsxs("div",{className:"ow-stats",children:[l.jsxs("span",{children:["₽ ",(y.money??0).toLocaleString("de-DE")]}),l.jsxs("span",{children:["ORDEN ",Qbadges]}),l.jsxs("span",{children:["GEFAHR ",Math.round(Qp.danger??0),"%"]})]}),
l.jsx("button",{type:"button",className:"ow-menu-button","aria-label":"Spielmenü",onClick:()=>document.querySelector(".pr-game-menu-toggle")?.click(),children:"☰"})
]}),
l.jsx("div",{className:"ow-canvas-wrap",children:l.jsx(QowCanvas,{map:{...Qm,region:u},player:Qp,leadSrc:Qlead})}),
Qp.pendingNode&&l.jsx("div",{className:"ow-transition-flash","aria-hidden":"true"}),
l.jsxs("div",{className:"ow-floor-meta",children:[l.jsx("span",{children:"WASD / ↑↓←→"}),l.jsx("b",{children:Qprompt}),l.jsx("span",{children:"E · INTERAGIEREN"})]}),
Qdebug&&l.jsxs("aside",{className:"ow-debug",children:[
l.jsx("b",{children:"OVERWORLD DEBUG · F2"}),
l.jsxs("span",{children:["XY ",Qp.x,",",Qp.y," · ",Qp.facing]}),
l.jsxs("span",{children:["SEED ",String(y.seed).slice(0,16)]}),
l.jsxs("span",{children:["FLOOR KEY ",Qm.key.slice(-28)]}),
l.jsxs("span",{children:["BIOME ",Qm.biome," · ",Qm.condition," · ",Qm.timeOfDay," · ",Qm.weather," · ATTEMPT ",Qm.attempt]}),
l.jsxs("span",{children:["ROOMS ",Qm.rooms.length," · TARGETS ",Qm.destinations.length]}),
l.jsxs("span",{children:["DANGER ",Math.round(Qp.danger??0)," · SEEN ",(Qp.seen??[]).length]}),
l.jsxs("div",{className:"ow-debug-actions",children:[
l.jsx("button",{type:"button",onClick:()=>h({type:"overworldDebug",action:"reveal"}),children:"MAP"}),
l.jsx("button",{type:"button",onClick:()=>h({type:"overworldDebug",action:"wild"}),children:"WILD"}),
l.jsx("button",{type:"button",onClick:()=>h({type:"overworldDebug",action:"exit"}),children:"EXIT"}),
l.jsx("button",{type:"button",onClick:()=>h({type:"overworldDebug",action:"regen"}),children:"REGEN"})
]})
]})
]}),
l.jsxs("footer",{className:"ow-command",children:[
l.jsx("div",{className:"ow-party-strip",children:Qteam.map((Qmon,Qidx)=>l.jsxs("span",{"data-lead":Qidx===0?"true":"false","data-fainted":Qmon.hp<=0?"true":"false",children:[l.jsx(xe,{src:st(Qmon.species,Qmon.shiny),name:""}),l.jsx("i",{style:{width:String(Math.max(0,Math.min(100,(Qmon.hp??0)/Math.max(1,Qmon.maxHp??1)*100)))+"%"}})]},Qmon.species+"-"+Qidx))}),
l.jsxs("div",{className:"ow-run-info",children:[l.jsx("span",{children:y?.mode==="endless"?"ENDLESS":y?.dailyChallenge?"DAILY":"STORY"}),l.jsx("span",{children:"SEED "+String(y.seed).slice(0,10)}),l.jsx("span",{children:String(Qp.steps??0)+" SCHRITTE"}),l.jsx("span",{children:String(Qm.rooms.length)+" RÄUME"})]})
]})
]})}