/*
 * PokéRegions Overworld Runtime
 * Injected into the recovered alpha client by scripts/build-alpha.py.
 *
 * Responsibilities:
 * - deterministic floor generation
 * - logical room graph + biome painting
 * - collision / fog / trainer line of sight
 * - validation + deterministic safe fallback
 * - Canvas 2D renderer
 *
 * React only hosts the canvas/HUD. The world itself is rendered here.
 */

const QowTileSize=16,QowW=45,QowH=31,QowSpawn={x:22,y:27};
const QowCanvasW=480,QowCanvasH=320;
const QowTileDefs={
  wall:{walkable:!1},ground:{walkable:!0},path:{walkable:!0},grass:{walkable:!0,encounterZone:!0},
  flower:{walkable:!0},sand:{walkable:!0},snow:{walkable:!0},ruin:{walkable:!0},bossfloor:{walkable:!0},
  water:{walkable:!1},rock:{walkable:!1},tree:{walkable:!1},lava:{walkable:!1}
};
const QowHash=a=>{let i=2166136261>>>0;for(let d=0;d<String(a).length;d++)i^=String(a).charCodeAt(d),i=Math.imul(i,16777619);return i>>>0};
const QowRng=a=>{let i=a>>>0;return{next:()=>((i=Math.imul(i,1664525)+1013904223>>>0)/4294967296),int:(d,r)=>d+Math.floor(((i=Math.imul(i,1664525)+1013904223>>>0)/4294967296)*(r-d+1)),chance:d=>((i=Math.imul(i,1664525)+1013904223>>>0)/4294967296)<d,pick:d=>d[Math.floor(((i=Math.imul(i,1664525)+1013904223>>>0)/4294967296)*d.length)],state:()=>i}};
const QowKey=a=>[a.seed,a.region,a.mode,a.mapIndex??0,a.step??0,a.arena?.step??"-",a.difficulty??"normal"].join("|");
const QowChoices=a=>{const i=a.arena?.route??a.route,d=a.arena?.step??a.step,r=a.arena?.path??a.path??[],u=!!a.fogRevealed||a.activeRelics?.includes?.("cracked-compass"),h=i?.[d]??[];return h.filter(m=>qu(i,d,r,Iy(m,!!a.arena))&&(!m.secret||u)).map(m=>({node:m,lane:Rc(m,h)}))};
const QowBlocking=a=>!QowTileDefs[a]?.walkable;
const QowTile=(a,i,d)=>i<0||d<0||i>=a.w||d>=a.h?"wall":a.tiles[d*a.w+i];
const QowVisible=(a,i,d=5,w=QowW,h=QowH)=>{const r=[];for(let u=-d;u<=d;u++)for(let m=-d;m<=d;m++){const y=a+m,p=i+u;if(y>=0&&y<w&&p>=0&&p<h&&Math.abs(m)+Math.abs(u)<=d+2)r.push(y+","+p)}return r};
const QowReveal=(a,i,d,w=QowW,h=QowH)=>{const r=new Set(a.seen??[]);QowVisible(i,d,5,w,h).forEach(u=>r.add(u)),a.seen=[...r]};
const QowFront=a=>({x:a.x+(a.facing==="left"?-1:a.facing==="right"?1:0),y:a.y+(a.facing==="up"?-1:a.facing==="down"?1:0)});
const QowKindLabel=a=>({wild:"Wildgebiet",trainer:"Trainer",shop:"Händler",mystery:"Ereignis",heal:"Rastplatz",item:"Fundort",city:"Stadt",tutor:"Move-Tutor",boss:"Rivale",gym:"Arena",league:"Pokémon-Liga",legendary:"Legendäre Spur"}[a]??"Ziel");
const QowBiomeProfile=a=>({
  forest:{base:"ground",grass:.42,flower:.05,obstacle:"tree",obstacleChance:.055},
  cave:{base:"ground",grass:0,flower:0,obstacle:"rock",obstacleChance:.085},
  coast:{base:"sand",grass:.12,flower:.01,obstacle:"water",obstacleChance:.08},
  sea:{base:"sand",grass:.08,flower:0,obstacle:"water",obstacleChance:.12},
  city:{base:"path",grass:.03,flower:.02,obstacle:"rock",obstacleChance:.012},
  ruins:{base:"ruin",grass:.11,flower:.01,obstacle:"rock",obstacleChance:.055},
  mountain:{base:"ground",grass:.08,flower:0,obstacle:"rock",obstacleChance:.085},
  volcano:{base:"ground",grass:0,flower:0,obstacle:"lava",obstacleChance:.065},
  marsh:{base:"ground",grass:.28,flower:.015,obstacle:"water",obstacleChance:.075},
  snow:{base:"snow",grass:.035,flower:0,obstacle:"rock",obstacleChance:.05},
  night:{base:"ground",grass:.3,flower:.02,obstacle:"tree",obstacleChance:.045},
  grassland:{base:"ground",grass:.28,flower:.045,obstacle:"rock",obstacleChance:.025}
}[a]??{base:"ground",grass:.28,flower:.04,obstacle:"rock",obstacleChance:.03});
const QowRegionBias=(a,i)=>a==="johto"&&i==="grassland"?"forest":a==="hoenn"&&i==="grassland"?"coast":a==="sinnoh"&&i==="grassland"?"mountain":i;
const QowEnsure=a=>{a.journey??=QjourneyState();const i=QowKey(a),d=a.journey.overworld;if(!d||d.mapKey!==i)a.journey.overworld={mapKey:i,x:QowSpawn.x,y:QowSpawn.y,facing:"up",steps:0,grassSteps:0,danger:0,picked:[],defeatedTrainers:[],pendingNode:null,encounterOnly:!1,seen:QowVisible(QowSpawn.x,QowSpawn.y),lastMessage:"Erkunde das Gebiet. WASD zum Laufen · E zum Interagieren"};else{d.seen??=QowVisible(d.x??QowSpawn.x,d.y??QowSpawn.y),d.picked??=[],d.defeatedTrainers??=[],d.danger??=0,d.encounterOnly??=!1}return d};

const QowCellKey=(a,i)=>a+","+i;
const QowCellCols=[5,14,22,31,40],QowCellRows=[27,20,13,6];
const QowCellNeighbors=(a,i)=>[[a-1,i],[a+1,i],[a,i-1],[a,i+1]].filter(([d,r])=>d>=0&&d<QowCellCols.length&&r>=0&&r<QowCellRows.length);
const QowCarveRoom=(a,i,d)=>{const r=Math.floor(d.w/2),u=Math.floor(d.h/2);for(let m=d.y-u;m<=d.y+u;m++)for(let y=d.x-r;y<=d.x+r;y++)y>0&&m>0&&y<a.w-1&&m<a.h-1&&(a.tiles[m*a.w+y]=i)};
const QowCarveCorridor=(a,i,d,r,u,h)=>{let m=i,y=d;const p=()=>{for(let b=-1;b<=0;b++){const v=m+(h==="v"?b:0),k=y+(h==="h"?b:0);v>0&&k>0&&v<a.w-1&&k<a.h-1&&(a.tiles[k*a.w+v]="path")}};if(h==="h"){for(;m!==r;m+=Math.sign(r-m))p();for(;y!==u;y+=Math.sign(u-y))p()}else{for(;y!==u;y+=Math.sign(u-y))p();for(;m!==r;m+=Math.sign(r-m))p()}p()};
const QowRoomDistance=(a,i)=>Math.abs(a.x-i.x)+Math.abs(a.y-i.y);
const QowRoomContains=(a,i,d)=>Math.abs(i-a.x)<=Math.floor(a.w/2)&&Math.abs(d-a.y)<=Math.floor(a.h/2);

const QowReachable=(a,i,d)=>{const r=new Set,u=[{x:i,y:d}],h=i+","+d;r.add(h);for(let m=0;m<u.length;m++){const y=u[m];for(const [p,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const v=y.x+p,k=y.y+b,q=v+","+k;if(v<0||k<0||v>=a.w||k>=a.h||r.has(q)||QowBlocking(QowTile(a,v,k)))continue;r.add(q),u.push({x:v,y:k})}}return r};
const QowValidate=a=>{if(!a||!a.spawn||QowBlocking(QowTile(a,a.spawn.x,a.spawn.y)))return!1;const i=QowReachable(a,a.spawn.x,a.spawn.y);if(i.size<40)return!1;for(const d of a.destinations??[])if(!i.has(d.x+","+d.y))return!1;for(const d of a.pickups??[])if(!i.has(d.x+","+d.y))return!1;return!0};

const QowDecorateRoom=(a,i,d,r)=>{const u=QowBiomeProfile(i),h=Math.floor(d.w/2),m=Math.floor(d.h/2);for(let y=d.y-m;y<=d.y+m;y++)for(let p=d.x-h;p<=d.x+h;p++){if(p<=0||y<=0||p>=a.w-1||y>=a.h-1)continue;const b=y*a.w+p;if(a.tiles[b]!=="ground")continue;const v=Math.abs(p-d.x)+Math.abs(y-d.y);if(v<=1){a.tiles[b]=u.base;continue}const k=r.next();if(k<u.grass)a.tiles[b]="grass";else if(k<u.grass+u.flower)a.tiles[b]="flower";else if(k<u.grass+u.flower+u.obstacleChance)a.tiles[b]=u.obstacle;else a.tiles[b]=u.base}};
const QowPaintDestinationRoom=(a,i)=>{const d=a.rooms.find(r=>r.id===i.room);if(!d)return;const r=i.kind==="wild"?"grass":["gym","league","boss"].includes(i.kind)?"bossfloor":null;if(!r)return;const u=Math.floor(d.w/2),h=Math.floor(d.h/2);for(let m=d.y-h;m<=d.y+h;m++)for(let y=d.x-u;y<=d.x+u;y++)if(!QowBlocking(QowTile(a,y,m)))a.tiles[m*a.w+y]=r};

const QowBuildAttempt=(a,i=0)=>{const d=QowKey(a),r=QowRng(QowHash(d+"|floor|"+i)),u=QowChoices(a),h=QowRegionBias(a.region,u[0]?.node?.biome??"grassland"),m={key:d,w:QowW,h:QowH,tiles:Array(QowW*QowH).fill("wall"),destinations:[],pickups:[],rooms:[],edges:[],biome:h,spawn:{...QowSpawn},attempt:i},y=new Map,p=QowCellKey(2,3);y.set(p,{c:2,row:3,parent:null});const b=[p],v=()=>{const k=[];for(const q of b){const [c,z]=q.split(",").map(Number);for(const [C,Z] of QowCellNeighbors(c,z)){const K=QowCellKey(C,Z);if(!y.has(K))k.push({from:q,to:K,c:C,row:Z,score:(3-Z)*3+r.next()*5+(Z<3?1:0)})}}return k};let k=Math.min(11,7+Math.floor((a.mapIndex??0)/2)+(a.difficulty==="hard"?1:0));for(let q=1;q<k;q++){const C=v();if(!C.length)break;C.sort((A,L)=>L.score-A.score);const Z=C[Math.min(C.length-1,r.int(0,Math.min(3,C.length-1)))];y.set(Z.to,{c:Z.c,row:Z.row,parent:Z.from}),b.push(Z.to),m.edges.push([Z.from,Z.to])}
let top=[...y.values()].filter(q=>q.row===0);if(!top.length){let q=[...y.values()].sort((C,Z)=>C.row-Z.row)[0];for(let C=q.row-1;C>=0;C--){const Z=QowCellKey(q.c,C),K=QowCellKey(q.c,C+1);if(!y.has(Z)){y.set(Z,{c:q.c,row:C,parent:K}),b.push(Z),m.edges.push([K,Z])}q=y.get(Z)}}
for(const [q,C] of y){const Qstart=C.row===3&&C.c===2,Z=Qstart?QowSpawn.x:QowCellCols[C.c]+r.int(-1,1),K=Qstart?QowSpawn.y:QowCellRows[C.row]+r.int(-1,1),A=Qstart?7:r.chance(.55)?7:5,L=Qstart?5:r.chance(.28)?7:5;m.rooms.push({id:q,c:C.c,row:C.row,x:Z,y:K,w:A,h:L,parent:C.parent,type:"normal"})}
const q0=m.rooms.find(q=>q.id===p);m.spawn={x:QowSpawn.x,y:QowSpawn.y};
for(const q of m.rooms)QowCarveRoom(m,"ground",q);
for(const q of m.rooms)QowDecorateRoom(m,h,q,r);
for(const [q,C] of m.edges){const Z=m.rooms.find(A=>A.id===q),K=m.rooms.find(A=>A.id===C);Z&&K&&QowCarveCorridor(m,Z.x,Z.y,K.x,K.y,r.chance(.5)?"h":"v")}
for(const q of m.rooms)for(const C of m.rooms)if(q.id<C.id&&Math.abs(q.c-C.c)+Math.abs(q.row-C.row)===1&&!m.edges.some(([Z,K])=>Z===q.id&&K===C.id||Z===C.id&&K===q.id)&&r.chance(.16))QowCarveCorridor(m,q.x,q.y,C.x,C.y,r.chance(.5)?"h":"v"),m.edges.push([q.id,C.id]);
const roomPool=m.rooms.filter(q=>q.id!==p).sort((q,C)=>QowRoomDistance(C,q0)-QowRoomDistance(q,q0)),used=new Set;
for(let q=0;q<u.length;q++){let C=roomPool.find(Z=>!used.has(Z.id));if(!C)C=roomPool[q%Math.max(1,roomPool.length)];if(!C)continue;used.add(C.id),C.type=u[q].node.kind;const Z={id:u[q].node.id,kind:u[q].node.kind,title:u[q].node.title,detail:u[q].node.detail,x:C.x,y:C.y,lane:u[q].lane,node:u[q].node,room:C.id,facing:C.y<q0.y?"down":"up"};m.destinations.push(Z),QowPaintDestinationRoom(m,Z)}
const pickupRooms=m.rooms.filter(q=>q.id!==p&&!used.has(q.id));for(let q=0;q<Math.min(4,pickupRooms.length);q++){const C=pickupRooms[q],Z=[{x:C.x-1,y:C.y},{x:C.x+1,y:C.y},{x:C.x,y:C.y-1},{x:C.x,y:C.y+1}].filter(K=>!QowBlocking(QowTile(m,K.x,K.y))),K=Z.length?r.pick(Z):{x:C.x,y:C.y};m.pickups.push({id:d+"-pickup-"+q,x:K.x,y:K.y,room:C.id})}
for(let q=q0.y-2;q<=q0.y+2;q++)for(let C=q0.x-3;C<=q0.x+3;C++)if(C>0&&q>0&&C<m.w-1&&q<m.h-1&&QowBlocking(QowTile(m,C,q)))m.tiles[q*m.w+C]="ground";
return m};

const QowFallback=a=>{const i=QowChoices(a),d={key:QowKey(a),w:QowW,h:QowH,tiles:Array(QowW*QowH).fill("wall"),destinations:[],pickups:[],rooms:[],edges:[],biome:QowRegionBias(a.region,i[0]?.node?.biome??"grassland"),spawn:{x:22,y:27},attempt:"fallback"};for(let y=3;y<29;y++)for(let x=18;x<=26;x++)d.tiles[y*d.w+x]=x>=21&&x<=23?"path":"ground";for(let q=0;q<i.length;q++){const x=19+q*3,y=5;d.destinations.push({id:i[q].node.id,kind:i[q].node.kind,title:i[q].node.title,detail:i[q].node.detail,x,y,lane:i[q].lane,node:i[q].node,room:"fallback-"+q,facing:"down"})}d.pickups.push({id:d.key+"-pickup-fallback",x:25,y:16,room:"fallback"});return d};
const QowBuild=a=>{for(let i=0;i<8;i++){const d=QowBuildAttempt(a,i);if(QowValidate(d))return d}return QowFallback(a)};

const QowClearLine=(a,i,d,r,u)=>{if(i!==r&&d!==u)return!1;const h=Math.sign(r-i),m=Math.sign(u-d);let y=i+h,p=d+m;for(;y!==r||p!==u;){if(QowBlocking(QowTile(a,y,p)))return!1;y+=h,p+=m}return!0};
const QowTrainerSees=(a,i,d,r)=>{if(!i||i.kind!=="trainer")return!1;const u=d-i.x,h=r-i.y,m=Math.abs(u)+Math.abs(h);if(m<1||m>4||u!==0&&h!==0)return!1;const y=i.facing??"down";if(y==="down"&&!(u===0&&h>0)||y==="up"&&!(u===0&&h<0)||y==="left"&&!(h===0&&u<0)||y==="right"&&!(h===0&&u>0))return!1;return QowClearLine(a,i.x,i.y,d,r)};
const QowDangerGain=(a,i)=>{if(i!=="grass")return-7;let d=22+(a.difficulty==="hard"?4:0)+Math.min(8,Math.floor((a.mapIndex??0)/2));a.activeRelics?.includes?.("hunter-mark")&&(d+=2);return d};

const QowPalette=(a,i)=>{const d={
  forest:{bg:"#244c2e",ground:"#4f9652",ground2:"#438749",path:"#b79d63",grass:"#327b3c",grass2:"#205d32",flower:"#efcf63",wall:"#1c512b",rock:"#696f66",water:"#3f91b8",sand:"#c9b272",snow:"#d8e7e5",ruin:"#858472",boss:"#78514a",lava:"#b14c35"},
  cave:{bg:"#1b2021",ground:"#5e625c",ground2:"#515650",path:"#8d8269",grass:"#435c45",grass2:"#2f4633",flower:"#c2b56b",wall:"#343a39",rock:"#74776f",water:"#3f7080",sand:"#9c8d6c",snow:"#cbd4d3",ruin:"#77786f",boss:"#6e4e48",lava:"#a44331"},
  coast:{bg:"#2a6f8c",ground:"#7fa45e",ground2:"#719656",path:"#c6ad70",grass:"#3f8845",grass2:"#2f7039",flower:"#f2d369",wall:"#2f789a",rock:"#777b73",water:"#4ba3c7",sand:"#d1bb7a",snow:"#d9e7e5",ruin:"#8d8876",boss:"#7b5950",lava:"#af4b36"},
  snow:{bg:"#aabfc3",ground:"#d4e2df",ground2:"#c6d8d5",path:"#b7b7a6",grass:"#7da07e",grass2:"#638768",flower:"#f1d66b",wall:"#96abad",rock:"#7e827e",water:"#6d9eb7",sand:"#c7bea2",snow:"#e4efed",ruin:"#999a91",boss:"#806f6c",lava:"#b54d39"}
}[i]??{bg:"#244b31",ground:"#559b57",ground2:"#478c4e",path:"#bea56a",grass:"#367f3f",grass2:"#265f34",flower:"#f1d265",wall:"#245f34",rock:"#74786e",water:"#489bc0",sand:"#cdb676",snow:"#dce8e6",ruin:"#858575",boss:"#79564d",lava:"#b04c36"};if(a==="johto"&&i!=="cave")return{...d,ground:"#4d8f50",grass:"#2f7339",wall:"#234f2f"};if(a==="hoenn"&&["coast","sea"].includes(i))return{...d,water:"#3ea4ca",sand:"#d4bc77"};if(a==="sinnoh"&&i!=="snow")return{...d,rock:"#6f7471",wall:"#3a5542"};return d};
const QowClamp=(a,i,d)=>Math.max(i,Math.min(d,a));
const QowDrawTile=(a,i,d,r,u,h,m)=>{const y=QowPalette(m.region,m.biome),p=u*QowTileSize-h.x,b=r*QowTileSize-h.y;if(p<=-QowTileSize||b<=-QowTileSize||p>=a.canvas.width||b>=a.canvas.height)return;let v=y.ground;i==="wall"||i==="tree"?v=y.wall:i==="path"?v=y.path:i==="grass"?v=y.grass:i==="flower"?v=y.ground:i==="water"?v=y.water:i==="rock"?v=y.rock:i==="sand"?v=y.sand:i==="snow"?v=y.snow:i==="ruin"?v=y.ruin:i==="bossfloor"?v=y.boss:i==="lava"&&(v=y.lava),a.fillStyle=v,a.fillRect(p,b,QowTileSize,QowTileSize);const k=QowHash(m.key+"|"+u+"|"+r);if(i==="ground"||i==="sand"||i==="snow"||i==="ruin"){a.fillStyle=i==="ground"?y.ground2:"rgba(35,45,42,.12)";for(let q=0;q<2;q++){const C=(k>>q*5&15),Z=(k>>q*7+3&15);a.fillRect(p+C,b+Z,1,1)}}if(i==="path"){a.fillStyle="rgba(73,55,34,.15)";a.fillRect(p+(k&7),b+((k>>4)&7),2,1)}if(i==="grass"){a.fillStyle=y.grass2;for(let q=0;q<3;q++){const C=(k>>q*4&15),Z=(k>>q*6+2&15);a.fillRect(p+C,b+Z,1,5),a.fillRect(p+C-1,b+Z+2,3,1)}}if(i==="flower"){a.fillStyle=y.flower;a.fillRect(p+5,b+6,2,2),a.fillRect(p+11,b+11,2,2)}if(i==="water"){a.fillStyle="rgba(210,240,245,.24)";a.fillRect(p+2,b+4,7,1),a.fillRect(p+8,b+11,6,1)}if(i==="wall"||i==="tree"){a.fillStyle="rgba(7,35,20,.22)";a.fillRect(p,b+12,16,4)}if(i==="rock"){a.fillStyle="rgba(255,255,255,.12)";a.fillRect(p+3,b+3,6,2)}if(i==="lava"){a.fillStyle="rgba(255,205,91,.34)";a.fillRect(p+2,b+5,11,2),a.fillRect(p+7,b+12,7,1)}};
const QowImages={};
const QowImage=a=>{if(!a)return null;if(!QowImages[a]){const i=new Image;i.decoding="async",i.onload=()=>window.dispatchEvent(new Event("pokeregions:overworld-assets")),i.src=a,QowImages[a]=i}return QowImages[a]};
const QowDrawEntity=(a,i,d,r,u,h)=>{const m=d*QowTileSize-h.x,y=r*QowTileSize-h.y;if(i.kind==="pickup"){const p=QowImage("/ui/overworld/frlg/item-ball.png");if(p?.complete&&p.naturalWidth)a.drawImage(p,m,y,16,16);else a.fillStyle="#e9ece0",a.fillRect(m+5,y+5,7,7),a.fillStyle="#d34d49",a.fillRect(m+5,y+5,7,3);return}if(["trainer","boss","tutor"].includes(i.kind)){const p=QowImage(i.kind==="boss"?"/ui/overworld/frlg/hiker.png":"/ui/overworld/frlg/youngster.png");if(p?.complete&&p.naturalWidth){const fw=Math.max(1,Math.floor(p.naturalWidth/10)),fh=Math.min(p.naturalHeight,24);a.drawImage(p,0,0,fw,fh,m,y-8,16,24)}else a.fillStyle="#f4d55d",a.fillRect(m+4,y-6,8,14);return}if(["gym","league"].includes(i.kind)){const p=QowImage("/ui/overworld/frlg/gym-sign.png");p?.complete&&p.naturalWidth?a.drawImage(p,m-1,y-8,18,24):(a.fillStyle="#e9ddc1",a.fillRect(m+3,y-5,10,18));return}const p={city:"▣",heal:"+",shop:"₽",mystery:"?",legendary:"✦",wild:"!"}[i.kind]??"•";a.font="bold 13px monospace",a.textAlign="center",a.textBaseline="middle",a.fillStyle=i.kind==="wild"?"#f7e36b":"#f1efe0",a.strokeStyle="rgba(15,25,28,.8)",a.lineWidth=3,a.strokeText(p,m+8,y+8),a.fillText(p,m+8,y+8)};
const QowDrawPlayer=(a,i,d,r)=>{const u=QowImage("/ui/overworld/frlg/red-normal.png"),h=i.x*QowTileSize-r.x+QowTileSize/2,m=i.y*QowTileSize-r.y+QowTileSize,y=i.facing??"down",p=i.steps??0;if(u?.complete&&u.naturalWidth){const fw=Math.max(1,Math.floor(u.naturalWidth/9)),fh=Math.min(u.naturalHeight,24),base=y==="up"?3:y==="left"||y==="right"?6:0,frame=base+(p%2),flip=y==="right";a.save();if(flip){a.translate(h+16,0),a.scale(-1,1),a.drawImage(u,frame*fw,0,fw,fh,0,m-40,32,48)}else a.drawImage(u,frame*fw,0,fw,fh,h-16,m-40,32,48);a.restore()}else a.fillStyle="#dd4d45",a.fillRect(h-8,m-22,16,22);if(d){const b=QowImage(d),dx=y==="right"?-18:y==="left"?18:0,dy=y==="down"?-20:y==="up"?18:6;if(b?.complete&&b.naturalWidth)a.drawImage(b,h-12+dx,m-22+dy,24,24)}};
const QowPaintCanvas=(a,i,d,r,u,h)=>{if(!a)return;const m=a.getContext("2d",{alpha:!1});if(!m)return;m.imageSmoothingEnabled=!1;const y=QowPalette(i.region,i.biome);m.fillStyle=y.bg,m.fillRect(0,0,a.width,a.height);const p=QowClamp(d.x*QowTileSize-a.width/2+QowTileSize/2,0,Math.max(0,i.w*QowTileSize-a.width)),b=QowClamp(d.y*QowTileSize-a.height/2+QowTileSize/2,0,Math.max(0,i.h*QowTileSize-a.height)),v={x:p,y:b},k=new Set(r??[]),q=new Set(u??[]),C=Math.max(0,Math.floor(p/QowTileSize)-1),Z=Math.min(i.w-1,Math.ceil((p+a.width)/QowTileSize)+1),K=Math.max(0,Math.floor(b/QowTileSize)-1),A=Math.min(i.h-1,Math.ceil((b+a.height)/QowTileSize)+1);for(let L=K;L<=A;L++)for(let E=C;E<=Z;E++){const T=E+","+L;if(!k.has(T)){m.fillStyle="#071011",m.fillRect(E*QowTileSize-p,L*QowTileSize-b,QowTileSize,QowTileSize);continue}QowDrawTile(m,0,0,L,E,v,i);if(!q.has(T)){m.fillStyle="rgba(3,9,10,.58)",m.fillRect(E*QowTileSize-p,L*QowTileSize-b,QowTileSize,QowTileSize)}}for(const L of i.pickups??[])if(!(h?.picked??[]).includes(L.id)&&q.has(L.x+","+L.y))QowDrawEntity(m,{kind:"pickup"},L.x,L.y,0,v);for(const L of i.destinations??[])if(q.has(L.x+","+L.y))QowDrawEntity(m,L,L.x,L.y,0,v);QowDrawPlayer(m,d,h?.leadSrc,v);};

const QowCanvas=({map:a,player:i,leadSrc:d})=>{const r=X.useRef(null),u=X.useRef({x:i.x,y:i.y}),h=X.useRef(0);X.useEffect(()=>{const m=r.current;if(!m)return;let y=0,p=!1;const b=u.current,v={x:i.x,y:i.y},k=performance.now(),q=t=>{if(p)return;const C=Math.min(1,(t-k)/112),Z=1-Math.pow(1-C,3),K={x:b.x+(v.x-b.x)*Z,y:b.y+(v.y-b.y)*Z,facing:i.facing,steps:i.steps},A=QowVisible(i.x,i.y,5,a.w,a.h);QowPaintCanvas(m,a,K,i.seen??[],A,{picked:i.picked??[],leadSrc:d}),C<1?y=requestAnimationFrame(q):(u.current=v)};y=requestAnimationFrame(q);const C=()=>{cancelAnimationFrame(y),y=requestAnimationFrame(q)};window.addEventListener("pokeregions:overworld-assets",C);return()=>{p=!0,cancelAnimationFrame(y),window.removeEventListener("pokeregions:overworld-assets",C)}},[a.key,i.x,i.y,i.facing,i.steps,(i.seen??[]).length,(i.picked??[]).length,d]);return l.jsx("canvas",{ref:r,className:"ow-canvas",width:QowCanvasW,height:QowCanvasH,"aria-label":"Tilebasierte PokéRegions Overworld"})};
