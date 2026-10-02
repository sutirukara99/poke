/*
 * Authored chunk composer for the Phaser vertical slice.
 *
 * Early Kanto/Johto routes are assembled from macro segments instead of
 * painting random cells. Each segment owns its path, clearing and optional
 * encounter/landmark pocket. The result is deterministic from the run seed.
 */
const QowChunkComposerVersion="chunk-v1";
const QowUseChunkRoute=run=>!run.arena&&["kanto","johto"].includes(run.region)&&(run.mapIndex??0)<=1;

const QowChunkInside=(m,x,y)=>x>0&&y>0&&x<m.w-1&&y<m.h-1;
const QowChunkPut=(m,x,y,t)=>{if(QowChunkInside(m,x,y))m.tiles[y*m.w+x]=t};
const QowChunkRect=(m,cx,cy,w,h,t)=>{
  for(let y=cy-Math.floor(h/2);y<cy-Math.floor(h/2)+h;y++)
    for(let x=cx-Math.floor(w/2);x<cx-Math.floor(w/2)+w;x++)QowChunkPut(m,x,y,t)
};
const QowChunkOrganic=(m,rng,cx,cy,w,h,t)=>{
  const left=cx-Math.floor(w/2),top=cy-Math.floor(h/2);
  for(let y=top;y<top+h;y++)for(let x=left;x<left+w;x++){
    if(!QowChunkInside(m,x,y))continue;
    const edge=x===left||x===left+w-1||y===top||y===top+h-1;
    if(edge&&rng.chance(.28))continue;
    QowChunkPut(m,x,y,t)
  }
};
const QowChunkLine=(m,a,b,floor,path)=>{
  let x=a.x,y=a.y;
  const stamp=()=>{
    for(let yy=y-3;yy<=y+3;yy++)for(let xx=x-3;xx<=x+3;xx++){
      const corner=Math.abs(xx-x)===3&&Math.abs(yy-y)===3;
      if(!corner)QowChunkPut(m,xx,yy,floor)
    }
    QowChunkPut(m,x,y,path);QowChunkPut(m,x+1,y,path)
  };
  stamp();
  while(y!==b.y){y+=Math.sign(b.y-y);stamp()}
  while(x!==b.x){x+=Math.sign(b.x-x);stamp()}
};
const QowChunkGrass=(m,rng,cx,cy,w,h)=>{
  QowChunkOrganic(m,rng,cx,cy,w+2,h+2,"ground");
  let cells=0;
  const left=cx-Math.floor(w/2),top=cy-Math.floor(h/2);
  for(let y=top;y<top+h;y++)for(let x=left;x<left+w;x++){
    if(!QowChunkInside(m,x,y))continue;
    const edge=x===left||x===left+w-1||y===top||y===top+h-1;
    if(edge&&rng.chance(.18))continue;
    QowChunkPut(m,x,y,"grass");cells++
  }
  return cells
};
const QowChunkPond=(m,rng,cx,cy)=>{
  QowChunkOrganic(m,rng,cx,cy,8,6,"ground");
  QowChunkOrganic(m,rng,cx,cy,5,4,"water")
};
const QowChunkSidePocket=(m,rng,source,side)=>{
  const end={x:QowClamp(source.x+side*rng.int(7,9),6,m.w-7),y:source.y};
  let x=source.x;
  while(x!==end.x){
    x+=Math.sign(end.x-x);
    for(let yy=source.y-1;yy<=source.y+1;yy++)QowChunkPut(m,x,yy,"ground");
    QowChunkPut(m,x,source.y,"path")
  }
  QowChunkOrganic(m,rng,end.x,end.y,7,5,"ground");
  QowChunkPut(m,end.x,end.y,"path");
  return end
};

const QowChunkFind=(m,start,occupied,predicate=()=>true,radius=7)=>{
  for(let r=0;r<=radius;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)+Math.abs(dy)!==r)continue;
    const x=start.x+dx,y=start.y+dy,key=x+","+y,t=QowTile(m,x,y);
    if(!QowChunkInside(m,x,y)||occupied.has(key)||QowBlocking(t)||!predicate(t,x,y))continue;
    occupied.add(key);return{x,y}
  }
  return null
};

const QowChunkTemplates={
  meadow:{shift:0,grass:"both",landmark:null},
  bendLeft:{shift:-4,grass:"right",landmark:null},
  bendRight:{shift:4,grass:"left",landmark:null},
  pondLeft:{shift:2,grass:"right",landmark:"left"},
  pondRight:{shift:-2,grass:"left",landmark:"right"},
  trainerGate:{shift:0,grass:"both",landmark:"gate"}
};
const QowChunkSequences=[
  ["meadow","bendLeft","trainerGate","bendRight"],
  ["bendRight","meadow","pondLeft","bendLeft"],
  ["pondRight","bendLeft","meadow","trainerGate"],
  ["bendLeft","pondRight","bendRight","meadow"]
];

const QowBuildChunkRouteAttempt=(run,attempt=0)=>{
  const key=QowKey(run),rng=QowRng(QowHash(key+"|"+QowChunkComposerVersion+"|"+attempt)),
    biome=QowRouteBiome(run),flavor=QowFloorFlavor(run,biome),choices=QowChoices(run),
    m={key,w:QowW,h:QowH,tiles:Array(QowW*QowH).fill("tree"),destinations:[],pickups:[],secrets:[],npcs:[],rooms:[],edges:[],features:[],biome:"grassland",layoutStyle:"route",generationVersion:6,composition:"phaser-chunks",worldEngine:"phaser",chunkVersion:QowChunkComposerVersion,arena:false,...flavor,spawn:{...QowSpawn},attempt};

  // Tree frame is kept intact. The route itself is a series of authored macro
  // chunks with stable entry/exit sockets.
  const sequence=QowChunkSequences[QowHash(key+"|sequence")%QowChunkSequences.length],
    ys=[27,21,15,9,3],centers=[{x:22,y:27}],fields=[],landmarks=[];
  let x=22;
  for(let n=0;n<4;n++){
    const spec=QowChunkTemplates[sequence[n]],nextX=QowClamp(x+spec.shift,10,34),
      a={x,y:ys[n]},b={x:nextX,y:ys[n+1]};
    QowChunkLine(m,a,b,"ground","path");
    const mid={x:Math.round((x+nextX)/2),y:Math.round((ys[n]+ys[n+1])/2)};
    QowChunkOrganic(m,rng,mid.x,mid.y,9,7,"ground");
    QowChunkLine(m,a,b,"ground","path");

    if(spec.grass==="left"||spec.grass==="both"){
      const gx=QowClamp(mid.x-6,5,m.w-6),cells=QowChunkGrass(m,rng,gx,mid.y,6,4);
      fields.push({x:gx,y:mid.y,w:6,h:4}),m.features.push({id:"chunk-grass-"+n+"-l",x:gx,y:mid.y,cells})
    }
    if(spec.grass==="right"||spec.grass==="both"){
      const gx=QowClamp(mid.x+7,5,m.w-6),cells=QowChunkGrass(m,rng,gx,mid.y,6,4);
      fields.push({x:gx,y:mid.y,w:6,h:4}),m.features.push({id:"chunk-grass-"+n+"-r",x:gx,y:mid.y,cells})
    }
    if(spec.landmark==="left"||spec.landmark==="right"){
      const side=spec.landmark==="left"?-1:1,cx=QowClamp(mid.x+side*8,6,m.w-7);
      QowChunkPond(m,rng,cx,mid.y),landmarks.push({id:"pond-"+n,x:cx,y:mid.y}),m.features.push({id:"chunk-pond-"+n,x:cx,y:mid.y,cells:20})
    }
    if(spec.landmark==="gate"){
      for(let yy=mid.y-1;yy<=mid.y+1;yy++){
        QowChunkPut(m,mid.x-4,yy,"tree");QowChunkPut(m,mid.x+5,yy,"tree")
      }
      m.features.push({id:"chunk-gate-"+n,x:mid.x,y:mid.y,cells:6})
    }
    m.rooms.push({id:"chunk-"+n,x:mid.x,y:mid.y,w:13,h:7,type:sequence[n]});
    n&&m.edges.push(["chunk-"+(n-1),"chunk-"+n]);
    x=nextX;centers.push({x,y:ys[n+1]})
  }

  const sideSource=centers[2],sidePocket=QowChunkSidePocket(m,rng,sideSource,QowHash(key+"|side")%2?-1:1);
  landmarks.push({id:"side-pocket",x:sidePocket.x,y:sidePocket.y});
  m.features.push({id:"chunk-side-pocket",x:sidePocket.x,y:sidePocket.y,cells:35});
  m.rooms.push({id:"chunk-side",x:sidePocket.x,y:sidePocket.y,w:7,h:5,type:"side-pocket"});
  m.edges.push(["chunk-1","chunk-side"]);

  QowChunkOrganic(m,rng,QowSpawn.x,QowSpawn.y,9,5,"ground");
  QowChunkRect(m,QowSpawn.x,QowSpawn.y,2,4,"path");
  const exit=centers.at(-1);
  QowChunkOrganic(m,rng,exit.x,exit.y,9,5,"ground");
  QowChunkRect(m,exit.x,exit.y,2,4,"path");

  // Small flower accents, deliberately sparse and only on open ground.
  for(let n=0;n<10;n++){
    const c=centers[1+rng.int(0,Math.max(0,centers.length-2))],fx=QowClamp(c.x+rng.int(-7,7),3,m.w-4),fy=QowClamp(c.y+rng.int(-3,3),3,m.h-4);
    if(QowTile(m,fx,fy)==="ground")QowChunkPut(m,fx,fy,"flower")
  }

  const occupied=new Set;
  for(let index=0;index<choices.length;index++){
    const choice=choices[index];let preferred,predicate=()=>true;
    if(["city","gym","league","boss"].includes(choice.node.kind))preferred=exit;
    else if(choice.node.kind==="wild"&&fields.length){preferred=fields[index%fields.length];predicate=t=>t==="grass"}
    else if(choice.node.kind==="trainer")preferred=centers[Math.min(centers.length-2,2+index)];
    else preferred=landmarks[index%Math.max(1,landmarks.length)]??centers[Math.min(centers.length-2,1+index)];
    const pos=QowChunkFind(m,preferred,occupied,predicate,7)??QowChunkFind(m,preferred,occupied,()=>true,8)??{x:preferred.x,y:preferred.y};
    if(choice.node.kind==="wild")QowChunkPut(m,pos.x,pos.y,"grass");
    m.destinations.push({id:choice.node.id,kind:choice.node.kind,title:choice.node.title,detail:choice.node.detail,x:pos.x,y:pos.y,lane:choice.lane,node:choice.node,room:"target-"+index,facing:"down"});
    m.rooms.push({id:"target-"+index,x:pos.x,y:pos.y,w:3,h:3,type:choice.node.kind})
  }

  const npcPos=QowChunkFind(m,centers[2],occupied,t=>t==="ground"||t==="path",5);
  if(npcPos)m.npcs.push({id:key+"-npc-0",kind:"wanderer",x:npcPos.x,y:npcPos.y,facing:"down",dialogue:QowNpcDialogue(run,biome,0)});

  const pickupAnchors=[...landmarks,...fields,centers[1],centers[3]].filter(Boolean);
  for(let n=0;n<Math.min(3,pickupAnchors.length);n++){
    const p=QowChunkFind(m,pickupAnchors[n],occupied,t=>t!=="water",5);if(!p)continue;
    const secret=n===0&&landmarks.length>0;
    m.pickups.push({id:key+"-pickup-"+n,x:p.x,y:p.y,room:secret?"chunk-secret":"chunk-loot-"+n,secret});
    if(secret)m.secrets.push({id:key+"-secret",room:"chunk-secret",x:p.x,y:p.y})
  }

  m.nativeTheme="palletTown";m.nativeReference="route1";
  QowTerrainSynthesize(m,"palletTown","route1");
  m.compositionStats={
    walkableCells:m.tiles.filter(t=>!QowBlocking(t)).length,
    pathCells:m.tiles.filter(t=>t==="path").length,
    grassCells:m.tiles.filter(t=>t==="grass").length,
    blockingCells:m.tiles.filter(t=>QowBlocking(t)).length,
    branches:m.features.filter(f=>String(f.id).includes("side-pocket")).length,
    fields:fields.length
  };
  return m
};
