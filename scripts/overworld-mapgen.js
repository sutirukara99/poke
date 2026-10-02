/*
 * Pokémon-style procedural overworld generator + native FRLG renderer.
 *
 * This layer deliberately separates logical collision tiles from visual
 * metatiles. Generated layouts remain deterministic and validated, while the
 * renderer can use the exact FireRed/LeafGreen primary/secondary metatiles.
 */

const QowNativeReferenceCache=new Map,QowNativeAtlasState={};

const QowNativeBytes=a=>{
  const clean=String(a??"").replace(/\s/g,""),abc="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",out=[];
  let value=0,bits=0;
  for(const ch of clean){if(ch==="=")break;const n=abc.indexOf(ch);if(n<0)continue;value=value<<6|n,bits+=6;if(bits>=8)bits-=8,out.push(value>>bits&255)}
  return new Uint8Array(out)
};

const QowNativeReference=(setName,refName)=>{
  const key=setName+"|"+refName;if(QowNativeReferenceCache.has(key))return QowNativeReferenceCache.get(key);
  const set=QowNativeFrlgCatalog?.[setName],ref=set?.references?.[refName];if(!set||!ref)return null;
  const bytes=QowNativeBytes(ref.mapB64),blocks=new Uint16Array(ref.w*ref.h);
  for(let i=0;i<blocks.length;i++)blocks[i]=(bytes[i*2]??0)|((bytes[i*2+1]??0)<<8);
  const data={...ref,blocks};QowNativeReferenceCache.set(key,data);return data
};

const QowNativePools=(setName,refName)=>{
  const ref=QowNativeReference(setName,refName);if(!ref)return{passable:[],blocked:[]};
  const pass=new Map,block=new Map;
  for(const raw of ref.blocks){const id=raw&1023,collision=raw>>10&3,target=collision===0?pass:block;target.set(id,(target.get(id)??0)+1)}
  const rank=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]).map(([id])=>id);
  return{passable:rank(pass),blocked:rank(block)}
};

const QowNativeEnsureAtlas=setName=>{
  const set=QowNativeFrlgCatalog?.[setName];if(!set||typeof document==="undefined")return null;
  const state=QowNativeAtlasState[setName]??=( {atlas:null,indexMax:0,building:false} );
  if(state.atlas)return state;if(state.building)return null;
  const primary=QowImage(QowActiveTileset.rawTiles),secondary=QowImage(set.tilesDataUri);
  if(!primary?.complete||!primary.naturalWidth||!secondary?.complete||!secondary.naturalWidth)return null;
  state.building=true;
  try{
    const sourcePixels=img=>{const c=document.createElement("canvas");c.width=img.naturalWidth,c.height=img.naturalHeight;const x=c.getContext("2d",{willReadFrequently:true});if(!x)throw new Error("native FRLG source canvas unavailable");x.imageSmoothingEnabled=false,x.drawImage(img,0,0);return{w:c.width,h:c.height,p:x.getImageData(0,0,c.width,c.height).data}},
      pri=sourcePixels(primary),sec=sourcePixels(secondary),priMeta=QowFrlgBytes(QowActiveTileset.metatilesB64),secMeta=QowFrlgBytes(set.metatilesB64),
      secondaryCount=Math.floor(secMeta.length/16),max=640+secondaryCount,cols=32,rows=Math.ceil(max/cols),
      atlas=document.createElement("canvas");atlas.width=cols*16,atlas.height=rows*16;
    const ctx=atlas.getContext("2d");if(!ctx)throw new Error("native FRLG atlas unavailable");ctx.imageSmoothingEnabled=false;
    for(let id=0;id<max;id++){
      const data=ctx.createImageData(16,16),meta=id<640?priMeta:secMeta,offset=(id<640?id:id-640)*16;
      if(offset+15>=meta.length)continue;
      for(let n=0;n<8;n++){
        const o=offset+n*2,entry=meta[o]|meta[o+1]<<8,tileId=entry&1023,hFlip=!!(entry&1024),vFlip=!!(entry&2048),palIndex=entry>>>12&15,
          palette=set.palettes?.[palIndex]??QowActiveTileset.palettes?.[palIndex]??QowActiveTileset.palettes?.[0],
          src=tileId<640?pri:sec,local=tileId<640?tileId:tileId-640,quad=n&3,qx=quad%2*8,qy=Math.floor(quad/2)*8,top=n>=4;
        for(let py=0;py<8;py++)for(let px=0;px<8;px++){
          const sx=(local%16)*8+(hFlip?7-px:px),sy=Math.floor(local/16)*8+(vFlip?7-py:py);
          if(sx<0||sy<0||sx>=src.w||sy>=src.h)continue;
          const si=(sy*src.w+sx)*4,colorIndex=QowFrlgColorIndex(src.p[si]);if(top&&colorIndex===0)continue;
          const color=palette?.[colorIndex]??[0,0,0],di=((qy+py)*16+qx+px)*4;
          data.data[di]=color[0]??0,data.data[di+1]=color[1]??0,data.data[di+2]=color[2]??0,data.data[di+3]=255
        }
      }
      ctx.putImageData(data,id%cols*16,Math.floor(id/cols)*16)
    }
    state.atlas=atlas,state.indexMax=max,state.cols=cols;
    window.dispatchEvent(new Event("pokeregions:overworld-assets"))
  }catch(err){console.warn?.("PokéRegions native FRLG atlas failed",setName,err)}finally{state.building=false}
  return state.atlas?state:null
};

const QowDrawNativeMapTile=(ctx,map,x,y,camera)=>{
  const visual=map?.nativeTiles?.[y*map.w+x];if(visual==null)return false;
  const setName=typeof visual==="object"?visual.set:map.nativeSet,id=typeof visual==="object"?visual.id:visual;
  if(!setName||!Number.isInteger(id))return false;const state=QowNativeEnsureAtlas(setName);
  if(!state?.atlas||id<0||id>=state.indexMax)return false;
  const px=x*QowTileSize-camera.x,py=y*QowTileSize-camera.y,sx=id%state.cols*16,sy=Math.floor(id/state.cols)*16;
  ctx.drawImage(state.atlas,sx,sy,16,16,px,py,16,16);return true
};

const QowNativeSetCell=(map,x,y,set,id)=>{
  if(x<0||y<0||x>=map.w||y>=map.h||!Number.isInteger(id))return;
  map.nativeTiles??=Array(map.w*map.h).fill(null),map.nativeTiles[y*map.w+x]={set,id}
};

const QowNativeSkin=(map,setName,refName)=>{
  const pools=QowNativePools(setName,refName),pass=pools.passable.filter(id=>id!==13).slice(0,5),blocked=pools.blocked.slice(0,5);
  map.nativeSet=setName,map.nativeTiles??=Array(map.w*map.h).fill(null);
  for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++){
    const tile=map.tiles[y*map.w+x],hash=QowHash(map.key+"|native|"+x+"|"+y);let id=null;
    if(tile==="grass")id=13;
    else if(tile==="flower")id=17;
    else if(tile==="water")id=299;
    else if(tile==="sand")id=269;
    else if(["wall","tree","rock"].includes(tile)&&blocked.length)id=blocked[hash%Math.min(3,blocked.length)];
    else if(["ground","path","ruin","bossfloor"].includes(tile)&&pass.length){
      if(map.layoutStyle==="cave")id=pass[hash%Math.min(3,pass.length)];
      else id=tile==="path"?189:tile==="ground"?1:pass[hash%Math.min(3,pass.length)]
    }
    if(Number.isInteger(id)&&map.nativeTiles[y*map.w+x]==null)QowNativeSetCell(map,x,y,setName,id)
  }
  return map
};

const QowStampReference=(map,setName,refName,sx,sy,w,h,dx,dy)=>{
  const ref=QowNativeReference(setName,refName);if(!ref)return;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
    const rx=sx+xx,ry=sy+yy,tx=dx+xx,ty=dy+yy;if(rx<0||ry<0||rx>=ref.w||ry>=ref.h||tx<0||ty<0||tx>=map.w||ty>=map.h)continue;
    const raw=ref.blocks[ry*ref.w+rx];QowNativeSetCell(map,tx,ty,setName,raw&1023)
  }
};

const QowStampSceneryChunks=(map,setName,refName,rng,protectedSet,style,count=3)=>{
  const ref=QowNativeReference(setName,refName);if(!ref)return;
  const size=5;
  for(let n=0;n<count;n++){
    const sx=rng.int(1,Math.max(1,ref.w-size-1)),sy=rng.int(1,Math.max(1,ref.h-size-1)),dx=rng.int(2,Math.max(2,map.w-size-2)),dy=rng.int(2,Math.max(2,map.h-size-2));
    for(let yy=0;yy<size;yy++)for(let xx=0;xx<size;xx++){
      const tx=dx+xx,ty=dy+yy,key=tx+","+ty;if(!QowIn(map,tx,ty)||protectedSet.has(key))continue;
      const raw=ref.blocks[(sy+yy)*ref.w+(sx+xx)],id=raw&1023,collision=raw>>10&3;
      let logical;
      if(id===13)logical="grass";else if(id===299)logical="water";else if(collision)logical=style==="forest"?"tree":style==="cave"?"wall":"rock";else logical=style==="coast"?"sand":"ground";
      map.tiles[ty*map.w+tx]=logical,QowNativeSetCell(map,tx,ty,setName,id)
    }
  }
};

const QowStampBuilding=(map,spec)=>{
  const {set,ref,sourceDoor,targetDoor,w,h}=spec,sx=sourceDoor.x-Math.floor(w/2),sy=sourceDoor.y-h+1,dx=targetDoor.x-Math.floor(w/2),dy=targetDoor.y-h+1;
  QowStampReference(map,set,ref,sx,sy,w,h,dx,dy);
  const blockTop=dy+1,blockBottom=targetDoor.y;
  for(let y=blockTop;y<=blockBottom;y++)for(let x=dx+1;x<dx+w-1;x++)if(x>=0&&y>=0&&x<map.w&&y<map.h)map.tiles[y*map.w+x]="wall";
  if(targetDoor.x>=0&&targetDoor.y>=0&&targetDoor.x<map.w&&targetDoor.y<map.h)map.tiles[targetDoor.y*map.w+targetDoor.x]="path";
  for(let y=targetDoor.y+1;y<=Math.min(map.h-1,targetDoor.y+2);y++)for(let x=targetDoor.x-1;x<=targetDoor.x+1;x++)if(x>0&&x<map.w-1)map.tiles[y*map.w+x]="path"
};

const QowPokemonStyle=biome=>biome==="forest"||biome==="night"?"forest":biome==="cave"||biome==="ruins"?"cave":["coast","sea","marsh"].includes(biome)?"coast":["mountain","snow","volcano"].includes(biome)?"mountain":"route";
const QowPokemonNativeSource=(style,region="kanto",mapIndex=0)=>{
  if(style==="forest")return["viridianForest","viridianForest"];
  if(style==="cave"||style==="mountain")return["cave","mtMoon1F"];
  const routeThemes={
    kanto:[["palletTown","route1"],["viridianCity","viridianCity"]],
    johto:[["viridianCity","viridianCity"],["palletTown","route1"]],
    hoenn:[["ceruleanCity","ceruleanCity"],["palletTown","route1"]],
    sinnoh:[["pewterCity","pewterCity"],["viridianCity","viridianCity"]]
  },pool=routeThemes[region]??routeThemes.kanto;
  return pool[Math.abs(mapIndex)%pool.length]
};
const QowMapIndex=(m,x,y)=>y*m.w+x;
const QowIn=(m,x,y)=>x>0&&y>0&&x<m.w-1&&y<m.h-1;
const QowPut=(m,x,y,t)=>{if(QowIn(m,x,y))m.tiles[QowMapIndex(m,x,y)]=t};
const QowProtect=(set,x,y,r=0)=>{for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)set.add(xx+","+yy)};
const QowCarveWidePath=(m,a,b,radius,protectedSet,tile="path",horizontalFirst=true)=>{
  let x=a.x,y=a.y;const carve=()=>{for(let yy=y-radius;yy<=y+radius;yy++)for(let xx=x-radius;xx<=x+radius;xx++){QowPut(m,xx,yy,tile),QowProtect(protectedSet,xx,yy)}};
  carve();const axis=(tx,ty,isX)=>{while((isX?x:y)!==(isX?tx:ty)){isX?x+=Math.sign(tx-x):y+=Math.sign(ty-y),carve()}};
  horizontalFirst?(axis(b.x,b.y,true),axis(b.x,b.y,false)):(axis(b.x,b.y,false),axis(b.x,b.y,true))
};
const QowOrganicPatch=(m,rng,protectedSet,cx,cy,rx,ry,tile,chance=.88)=>{
  for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){if(!QowIn(m,x,y)||protectedSet.has(x+","+y))continue;const nx=Math.abs(x-cx)/Math.max(1,rx),ny=Math.abs(y-cy)/Math.max(1,ry);if(nx*nx+ny*ny<=1.25&&rng.chance(chance))QowPut(m,x,y,tile)}
};
const QowFindWalkableNear=(m,x,y,occupied,radius=4)=>{
  for(let r=0;r<=radius;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.abs(dx)+Math.abs(dy)!==r)continue;const px=x+dx,py=y+dy,k=px+","+py;if(QowIn(m,px,py)&&!occupied.has(k)&&!QowBlocking(QowTile(m,px,py)))return{x:px,y:py}}
  return null
};

/*
 * Authored-looking Pokémon map grammar.
 * The route spine guarantees progression; these deterministic feature stamps
 * create the human-made pockets, clearings, ponds, gardens and chicanes that
 * make generated floors read like actual GBA routes rather than dungeon rooms.
 */
const QowFeatureTemplates={
  route:[
    {id:"grass-pocket",rows:[" ggg ","ggggg","gg.gg","ggggg"," ggg "]},
    {id:"pond-grove",rows:[" ttt ","twwwt","tw.wt","twwwt"," ttt "]},
    {id:"flower-garden",rows:[" fff ","fgggf","fg.gf","fgggf"," fff "]},
    {id:"tree-corner",rows:["tttt ","t....","t....","t....","     "]}
  ],
  forest:[
    {id:"forest-clearing",rows:["ttttt","tgggt","tg.gt","tgggt","ttttt"]},
    {id:"deep-grass",rows:["tgggt","ggggg","gg.gg","ggggg","tgggt"]},
    {id:"woodland-ring",rows:["ttttt","t...t","t...t","t...t","ttttt"]}
  ],
  coast:[
    {id:"lagoon",rows:[" www ","wwwww","ww.ww","wwwww"," www "]},
    {id:"beach-grass",rows:[" ggg ","ggggg","gg.gg","ggggg"," sss "]},
    {id:"rocky-shore",rows:[" rrr ","rwwwr","rw.wr","rwwwr"," rrr "]}
  ],
  mountain:[
    {id:"boulder-chicane",rows:[" rr  "," rrr ","  .r ","rrr  ","  rr "]},
    {id:"highland-pocket",rows:["rrrrr","rgggr","rg.gr","rgggr","rrrrr"]},
    {id:"snow-pocket",rows:[" rrr ","rsssr","rs.sr","rsssr"," rrr "]}
  ],
  cave:[
    {id:"rock-island",rows:["rrrrr","r...r","r...r","r...r","rrrrr"]},
    {id:"cave-pocket",rows:["rrrrr","rgggr","rg.gr","rgggr","rrrrr"]},
    {id:"stone-chicane",rows:["rr   "," rr  ","  .  ","  rr ","   rr"]}
  ]
};
const QowFeatureTile=(ch,style,biome)=>({
  ".":style==="coast"?"sand":style==="cave"?"ground":"path",
  g:"grass",f:"flower",t:"tree",w:"water",r:biome==="volcano"?"lava":"rock",s:biome==="snow"?"snow":"sand"
}[ch]??null);
const QowStampFeature=(m,template,cx,cy,style,biome,protectedSet)=>{
  const h=template.rows.length,w=Math.max(...template.rows.map(r=>r.length)),ox=cx-Math.floor(w/2),oy=cy-Math.floor(h/2);
  let painted=0;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<template.rows[yy].length;xx++){
    const ch=template.rows[yy][xx],x=ox+xx,y=oy+yy,key=x+","+y,tile=QowFeatureTile(ch,style,biome);
    if(!tile||!QowIn(m,x,y))continue;
    if(protectedSet.has(key)&&ch!==".")continue;
    if(ch==="."&&!protectedSet.has(key))continue;
    QowPut(m,x,y,tile),painted++
  }
  if(painted)m.features.push({id:template.id,x:cx,y:cy,cells:painted});
  return painted
};
const QowApplyFeatureGrammar=(m,rng,style,biome,spine,branches,protectedSet)=>{
  m.features??=[];
  const templates=QowFeatureTemplates[style]??QowFeatureTemplates.route,
    anchors=[...branches,...spine.slice(1,-1)].sort(()=>0); // deterministic order; RNG chooses positions below.
  const used=new Set;
  const count=style==="forest"?5:style==="cave"?4:style==="route"?4:3;
  for(let n=0;n<count;n++){
    const source=anchors[rng.int(0,Math.max(0,anchors.length-1))]??spine[Math.min(spine.length-1,n+1)],
      side=n%2===0?-1:1,cx=QowClamp(source.x+side*rng.int(4,8),4,m.w-5),cy=QowClamp(source.y+rng.int(-3,3),4,m.h-5),k=cx+","+cy;
    if(used.has(k)){n--;if(used.size>12)break;continue}
    used.add(k);
    QowStampFeature(m,rng.pick(templates),cx,cy,style,biome,protectedSet)
  }
  return m
};

const QowBuildPokemonAttempt=(run,attempt=0)=>{
  const key=QowKey(run),rng=QowRng(QowHash(key+"|pokemon-map|"+attempt)),choices=QowChoices(run),biome=QowRegionBias(run.region,choices[0]?.node?.biome??"grassland"),flavor=QowFloorFlavor(run,biome),style=QowPokemonStyle(biome),
    m={key,w:QowW,h:QowH,tiles:Array(QowW*QowH).fill(style==="cave"?"wall":biome==="coast"||biome==="sea"?"sand":biome==="snow"?"snow":"ground"),destinations:[],pickups:[],secrets:[],npcs:[],rooms:[],edges:[],features:[],biome,layoutStyle:style,generationVersion:2,arena:false,...flavor,spawn:{...QowSpawn},attempt},
    protectedSet=new Set,spine=[{...QowSpawn}];
  for(const y of [23,19,15,11,7,3]){
    const prev=spine.at(-1),jitter=style==="forest"?rng.int(-6,6):style==="mountain"?rng.int(-7,7):style==="coast"?rng.int(-4,4):rng.int(-5,5),
      x=QowClamp(prev.x+jitter,style==="coast"?10:5,style==="coast"?30:39);spine.push({x,y})
  }

  if(style!=="cave"){
    for(let x=0;x<m.w;x++)m.tiles[x]=m.tiles[(m.h-1)*m.w+x]=style==="coast"?"water":style==="mountain"?"rock":"tree";
    for(let y=0;y<m.h;y++)m.tiles[y*m.w]=m.tiles[y*m.w+m.w-1]=style==="coast"?"water":style==="mountain"?"rock":"tree"
  }
  if(style==="coast"){
    const waterRight=rng.chance(.5),shore=waterRight?rng.int(30,34):rng.int(10,14);
    for(let y=1;y<m.h-1;y++)for(let x=1;x<m.w-1;x++)if(waterRight?x>shore:x<shore)QowPut(m,x,y,"water");
  }

  for(let n=0;n<spine.length-1;n++){
    QowCarveWidePath(m,spine[n],spine[n+1],style==="forest"||style==="cave"?1:1,protectedSet,style==="coast"?"sand":"path",rng.chance(.5));
    m.rooms.push({id:"route-"+n,x:spine[n].x,y:spine[n].y,w:7,h:5,type:n===0?"start":"route-segment"});
    n&&m.edges.push(["route-"+(n-1),"route-"+n])
  }
  if(style==="cave")for(const p of spine)QowOrganicPatch(m,rng,protectedSet,p.x,p.y,rng.int(3,5),rng.int(2,4),"ground",.94);

  const fork=spine[Math.max(2,spine.length-3)],targets=[];
  if(choices.length<=1)targets.push({...spine.at(-1)});
  else{
    const left={x:6+rng.int(0,3),y:4+rng.int(0,2)},right={x:38-rng.int(0,3),y:4+rng.int(0,2)};
    QowCarveWidePath(m,fork,left,1,protectedSet,style==="coast"?"sand":"path",true),QowCarveWidePath(m,fork,right,1,protectedSet,style==="coast"?"sand":"path",true);
    targets.push(left,right);if(choices.length>2)targets.splice(1,0,{...spine.at(-1)})
  }

  const branchAnchors=[];
  for(let n=1;n<=2;n++){
    const source=spine[rng.int(2,Math.max(2,spine.length-3))],side=n===1?-1:1,end={x:side<0?rng.int(4,8):rng.int(36,40),y:QowClamp(source.y+rng.int(-2,2),5,m.h-5)};
    QowCarveWidePath(m,source,end,0,protectedSet,style==="coast"?"sand":"path",true),branchAnchors.push(end);
    m.rooms.push({id:"side-"+n,x:end.x,y:end.y,w:5,h:5,type:"side-path"}),m.edges.push(["route-"+Math.max(0,spine.indexOf(source)-1),"side-"+n])
  }

  if(style==="route"){
    for(let n=0;n<7;n++){const cx=rng.int(4,m.w-5),cy=rng.int(4,m.h-5);QowOrganicPatch(m,rng,protectedSet,cx,cy,rng.int(2,5),rng.int(2,4),rng.chance(.72)?"grass":"tree",.82)}
    if(rng.chance(.7)){const side=rng.chance(.5)?1:-1,cx=QowClamp(22+side*rng.int(10,15),5,39),cy=rng.int(10,22);QowOrganicPatch(m,rng,protectedSet,cx,cy,rng.int(2,4),rng.int(2,3),"water",.92)}
    for(let n=0;n<10;n++)QowPut(m,rng.int(3,m.w-4),rng.int(3,m.h-4),"flower")
  }else if(style==="forest"){
    for(let n=0;n<14;n++)QowOrganicPatch(m,rng,protectedSet,rng.int(3,m.w-4),rng.int(3,m.h-4),rng.int(2,5),rng.int(2,4),rng.chance(.35)?"grass":"tree",.88);
    for(const p of spine)QowOrganicPatch(m,rng,protectedSet,p.x,p.y,2,2,"ground",.55)
  }else if(style==="coast"){
    for(let n=0;n<6;n++)QowOrganicPatch(m,rng,protectedSet,rng.int(5,m.w-6),rng.int(4,m.h-5),rng.int(2,4),rng.int(1,3),rng.chance(.5)?"grass":"water",.78)
  }else if(style==="mountain"){
    const obstacle=biome==="volcano"?"lava":"rock";for(let n=0;n<12;n++)QowOrganicPatch(m,rng,protectedSet,rng.int(3,m.w-4),rng.int(3,m.h-4),rng.int(1,3),rng.int(1,3),obstacle,.84)
  }else if(style==="cave"){
    for(let n=0;n<6;n++){const p=spine[rng.int(1,spine.length-1)];QowOrganicPatch(m,rng,protectedSet,p.x+rng.int(-4,4),p.y+rng.int(-2,2),rng.int(2,4),rng.int(2,3),"ground",.88)}
  }

  QowApplyFeatureGrammar(m,rng,style,biome,spine,branchAnchors,protectedSet);

  for(let y=QowSpawn.y-2;y<=QowSpawn.y+2;y++)for(let x=QowSpawn.x-3;x<=QowSpawn.x+3;x++)QowPut(m,x,y,style==="coast"?"sand":style==="cave"?"ground":"path");

  const [nativeSet,nativeRef]=QowPokemonNativeSource(style,run.region,run.mapIndex??0);m.nativeTheme=nativeSet;
  QowStampSceneryChunks(m,nativeSet,nativeRef,rng,protectedSet,style,style==="forest"||style==="cave"?4:3);

  const occupied=new Set;
  choices.forEach((choice,index)=>{
    const pos=targets[Math.min(index,targets.length-1)]??spine.at(-1);QowPut(m,pos.x,pos.y,choice.node.kind==="wild"?"grass":style==="coast"?"sand":"path");
    const dest={id:choice.node.id,kind:choice.node.kind,title:choice.node.title,detail:choice.node.detail,x:pos.x,y:pos.y,lane:choice.lane,node:choice.node,room:"target-"+index,facing:"down"};
    m.destinations.push(dest),occupied.add(pos.x+","+pos.y),m.rooms.push({id:"target-"+index,x:pos.x,y:pos.y,w:5,h:5,type:choice.node.kind})
  });

  const npcCandidates=spine.slice(2,-2);
  for(let n=0;n<Math.min(2,npcCandidates.length);n++)if(rng.chance(.72)){
    const c=npcCandidates[(n*2+rng.int(0,1))%npcCandidates.length],p=QowFindWalkableNear(m,c.x+2,c.y,occupied,3);if(p){occupied.add(p.x+","+p.y),m.npcs.push({id:key+"-npc-"+n,kind:"wanderer",x:p.x,y:p.y,facing:rng.pick(["up","down","left","right"]),dialogue:QowNpcDialogue(run,biome,n)})}
  }

  const pickupMax=m.condition==="rich"?5:3;
  for(let n=0;n<pickupMax;n++){
    const anchor=branchAnchors[n%branchAnchors.length]??spine[Math.min(spine.length-1,n+2)],p=QowFindWalkableNear(m,anchor.x,anchor.y,occupied,5);if(!p)continue;
    const secret=n===0&&rng.chance(.62);occupied.add(p.x+","+p.y),m.pickups.push({id:key+"-pickup-"+n,x:p.x,y:p.y,room:"side-"+(n%2+1),secret});
    if(secret)m.secrets.push({id:key+"-secret-0",room:"side-"+(n%2+1),x:p.x,y:p.y})
  }

  QowNativeSkin(m,nativeSet,nativeRef);
  return m
};

const QowBuildTownMap=run=>{
  const key="town|"+QowKey(run),rng=QowRng(QowHash(key)),w=31,h=23,variants=[
    {set:"viridianCity",ref:"viridianCity",center:{x:26,y:26},mart:{x:36,y:19},gym:{x:36,y:10}},
    {set:"pewterCity",ref:"pewterCity",center:{x:17,y:25},mart:{x:28,y:18},gym:{x:15,y:16}},
    {set:"ceruleanCity",ref:"ceruleanCity",center:{x:22,y:19},mart:{x:29,y:28},gym:{x:31,y:21}}
  ],regionBias={kanto:0,johto:0,hoenn:2,sinnoh:1}[run.region]??0,variant=variants[(regionBias+(run.mapIndex??0)+rng.int(0,2))%variants.length],
    m={key,w,h,tiles:Array(w*h).fill("ground"),nativeTiles:Array(w*h).fill(null),region:run.region,biome:"city",weather:"clear",timeOfDay:"day",condition:"quiet",layoutStyle:"town",generationVersion:2,nativeTheme:variant.set,rooms:[],edges:[],destinations:[],pickups:[],secrets:[],npcs:[],features:[],spawn:{x:15,y:20}},protectedSet=new Set;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1)m.tiles[y*w+x]="tree";

  const slots=[
    {x:7,y:9},{x:23,y:9},{x:7,y:18},{x:23,y:18}
  ],rot=rng.int(0,3),ordered=slots.map((_,i)=>slots[(i+rot)%slots.length]),
    centerDoor=ordered[0],martDoor=ordered[1],gymDoor=ordered[2],houseDoor=ordered[3],plaza={x:15,y:12},exit={x:15,y:21};

  QowCarveWidePath(m,exit,plaza,1,protectedSet,"path",false);
  for(const door of [centerDoor,martDoor,gymDoor,houseDoor])QowCarveWidePath(m,plaza,door,1,protectedSet,"path",rng.chance(.5));
  QowOrganicPatch(m,rng,protectedSet,15,12,4,3,"path",1);

  const pondOnLeft=rng.chance(.5),pondX=pondOnLeft?3:27,pondY=rng.int(11,15);
  QowOrganicPatch(m,rng,protectedSet,pondX,pondY,2,3,"water",.95);
  for(let n=0;n<22;n++){const x=rng.int(2,w-3),y=rng.int(2,h-3);if(m.tiles[y*w+x]==="ground"&&!protectedSet.has(x+","+y))m.tiles[y*w+x]=rng.chance(.6)?"flower":"grass"}
  for(let n=0;n<5;n++){const cx=rng.pick([2,4,26,28]),cy=rng.int(3,19);QowOrganicPatch(m,rng,protectedSet,cx,cy,2,2,"tree",.8)}
  // Small authored town pockets keep the random layout readable like a real GBA settlement.
  for(const [id,cx,cy,tile] of [["garden",4,5,"flower"],["park",27,5,"grass"],["grove",3,18,"tree"]]){
    let cells=0;for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if(QowIn(m,x,y)&&!protectedSet.has(x+","+y)){QowPut(m,x,y,tile),cells++}
    cells&&m.features.push({id,x:cx,y:cy,cells})
  }

  QowNativeSkin(m,variant.set,variant.ref);
  [
    {id:"center",set:variant.set,ref:variant.ref,sourceDoor:variant.center,targetDoor:centerDoor,w:9,h:7},
    {id:"mart",set:variant.set,ref:variant.ref,sourceDoor:variant.mart,targetDoor:martDoor,w:9,h:7},
    {id:"gym-deco",set:variant.set,ref:variant.ref,sourceDoor:variant.gym,targetDoor:gymDoor,w:11,h:8},
    {id:"house-deco",set:"palletTown",ref:"palletTown",sourceDoor:{x:6,y:7},targetDoor:houseDoor,w:9,h:7}
  ].forEach(b=>QowStampBuilding(m,b));

  const tutorSide=rng.chance(.5)?-2:2,questSide=-tutorSide;
  m.services=[
    {id:"center",kind:"city",x:centerDoor.x,y:centerDoor.y,label:"Pokémon-Center betreten",detail:"Nurse, Heilung und PC",hideEntity:true},
    {id:"mart",kind:"city",x:martDoor.x,y:martDoor.y,label:"PokéMart betreten",detail:"Vorräte und Reisebedarf",hideEntity:true},
    {id:"tutor",kind:"tutor",x:plaza.x+tutorSide,y:plaza.y+2,label:"Move-Tutor",detail:"Moveset umbauen"},
    {id:"quest",kind:"city",x:plaza.x+questSide,y:plaza.y-2,label:"Quest-Brett",detail:"Nebenaufgabe suchen"},
    {id:"exit",kind:"city",x:exit.x,y:exit.y,label:"Stadt verlassen",detail:"Weiter zur nächsten Route",hideEntity:true}
  ];
  m.landmarks={center:centerDoor,mart:martDoor,gym:gymDoor,house:houseDoor,plaza,exit};
  return m
};

const QowTownServices=map=>map?.services??[
  {id:"center",kind:"city",x:8,y:10,label:"Pokémon-Center betreten",detail:"Nurse, Heilung und PC",hideEntity:true},
  {id:"mart",kind:"city",x:23,y:10,label:"PokéMart betreten",detail:"Vorräte und Reisebedarf",hideEntity:true},
  {id:"tutor",kind:"tutor",x:13,y:14,label:"Move-Tutor",detail:"Moveset umbauen"},
  {id:"quest",kind:"city",x:17,y:10,label:"Quest-Brett",detail:"Nebenaufgabe suchen"},
  {id:"exit",kind:"city",x:15,y:21,label:"Stadt verlassen",detail:"Weiter zur nächsten Route",hideEntity:true}
];
