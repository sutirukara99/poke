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
          palette=palIndex<7?(QowActiveTileset.palettes?.[palIndex]??QowActiveTileset.palettes?.[0]):(set.palettes?.[palIndex]??QowActiveTileset.palettes?.[palIndex]??QowActiveTileset.palettes?.[0]),
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
  /*
   * IMPORTANT: secondary metatile IDs are tileset-specific. Filling every
   * generated cell with "popular" IDs from a reference map produced the
   * brown/grey checkerboard seen in production because an ID that means path
   * in one secondary set can be a cliff/roof/detail in another.
   *
   * Generated terrain therefore uses the original FRLG General semantic
   * metatiles. Secondary tiles are reserved for explicit, spatially coherent
   * stamps copied from original reference maps (buildings/scenery chunks).
   */
  map.nativeSet=setName,map.nativeRef=refName,map.nativeTiles??=Array(map.w*map.h).fill(null);
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
  // Route 1 is deliberately the outdoor texture reference: it contains
  // natural tree/grass/ground transitions without city roofs or house walls.
  // Region identity is expressed by topology/biome rather than mixing city
  // metatiles into a field.
  return["palletTown","route1"]
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
 * Natural overworld engine v4.
 *
 * The map is generated as a walkable landscape mask first. We begin with a
 * solid natural boundary (trees / rock / water), carve one readable route,
 * add authored clearings and optional side pockets, and only then place grass,
 * NPCs and rogue objectives. Visual metatiles are synthesized afterwards from
 * real FRLG reference-map adjacency by overworld-terrain-engine.js.
 *
 * This avoids the two failure modes from earlier versions:
 *   1) giant empty/open floors with random decoration islands
 *   2) repeated single tree/path metatiles that look like wallpaper
 */
const QowV4RoadTile=(style,biome)=>style==="coast"?"sand":biome==="snow"?"snow":style==="cave"?"ground":"path";
const QowV4FloorTile=(style,biome)=>style==="coast"?"sand":biome==="snow"?"snow":"ground";
const QowV4BarrierTile=(style,biome)=>style==="coast"?"water":style==="mountain"?(biome==="volcano"?"lava":"rock"):style==="cave"?"wall":"tree";
const QowV4FillRect=(m,cx,cy,w,h,tile)=>{
  let cells=0,left=cx-Math.floor(w/2),top=cy-Math.floor(h/2);
  for(let y=top;y<top+h;y++)for(let x=left;x<left+w;x++)if(QowIn(m,x,y)){QowPut(m,x,y,tile),cells++}
  return cells
};
const QowV4FillOrganicRect=(m,rng,cx,cy,w,h,tile,edgeNoise=.28)=>{
  let cells=0,left=cx-Math.floor(w/2),top=cy-Math.floor(h/2);
  for(let y=top;y<top+h;y++)for(let x=left;x<left+w;x++){
    if(!QowIn(m,x,y))continue;
    const edge=x===left||x===left+w-1||y===top||y===top+h-1;
    if(edge&&rng.chance(edgeNoise))continue;
    QowPut(m,x,y,tile),cells++
  }
  return cells
};
const QowV4CarveAreaStep=(m,rng,x,y,radius,floor,trail,protectedSet)=>{
  for(let yy=y-radius;yy<=y+radius;yy++)for(let xx=x-radius;xx<=x+radius;xx++){
    if(!QowIn(m,xx,yy))continue;
    const dx=Math.abs(xx-x),dy=Math.abs(yy-y),corner=dx===radius&&dy===radius;
    if(corner&&rng.chance(.62))continue;
    QowPut(m,xx,yy,floor)
  }
  // A thin recognizable dirt/snow/sand trail runs through the broad walkable
  // corridor. Only the trail itself is protected from later grass placement.
  QowPut(m,x,y,trail),QowProtect(protectedSet,x,y);
  if(radius>=3&&QowIn(m,x+1,y)){QowPut(m,x+1,y,trail),QowProtect(protectedSet,x+1,y)}
};
const QowV4CarveLandscapePath=(m,rng,a,b,radius,floor,trail,protectedSet,verticalFirst=true)=>{
  let x=a.x,y=a.y;
  const step=()=>QowV4CarveAreaStep(m,rng,x,y,radius,floor,trail,protectedSet);
  const axis=(target,isX)=>{
    while((isX?x:y)!==target){
      isX?x+=Math.sign(target-x):y+=Math.sign(target-y),step()
    }
  };
  step(),verticalFirst?(axis(b.y,false),axis(b.x,true)):(axis(b.x,true),axis(b.y,false))
};
const QowV4BuildSpine=(m,rng,run,style,biome,protectedSet)=>{
  const early=(run.mapIndex??0)<=1,ys=[27,23,19,15,11,7,3],points=[{x:QowSpawn.x,y:ys[0]}],floor=QowV4FloorTile(style,biome),trail=QowV4RoadTile(style,biome),
    radius=style==="forest"?3:style==="mountain"||style==="cave"?3:early?4:3;
  let x=QowSpawn.x,dir=rng.chance(.5)?-1:1;
  for(let n=1;n<ys.length;n++){
    if(n===2||n===4||n===6){
      const step=early?rng.int(2,4):rng.int(3,6);let nx=x+dir*step;
      if(nx<10||nx>34)dir*=-1,nx=x+dir*step;
      x=QowClamp(nx,9,35);
      if(rng.chance(.68))dir*=-1
    }
    points.push({x,y:ys[n]})
  }
  for(let n=0;n<points.length-1;n++){
    QowV4CarveLandscapePath(m,rng,points[n],points[n+1],radius,floor,trail,protectedSet,n%2===0);
    m.rooms.push({id:"route-"+n,x:points[n].x,y:points[n].y,w:radius*2+3,h:radius*2+3,type:n===0?"start":"route-zone"});
    n&&m.edges.push(["route-"+(n-1),"route-"+n])
  }
  return points
};
const QowV4CarveClearing=(m,rng,cx,cy,w,h,style,biome)=>{
  const floor=QowV4FloorTile(style,biome);
  return QowV4FillOrganicRect(m,rng,cx,cy,w,h,floor,.18)
};
const QowV4AddGrassField=(m,rng,anchor,side,style,biome,protectedSet,index)=>{
  if(style==="cave"||style==="mountain"&&biome==="volcano")return null;
  const cx=QowClamp(anchor.x+side*rng.int(4,6),5,m.w-6),cy=QowClamp(anchor.y+rng.int(-1,1),5,m.h-6),
    w=rng.int(6,9),h=rng.int(4,6),floor=QowV4FloorTile(style,biome);
  QowV4CarveClearing(m,rng,cx,cy,w+2,h+2,style,biome);
  let cells=0,left=cx-Math.floor(w/2),top=cy-Math.floor(h/2);
  for(let y=top;y<top+h;y++)for(let x=left;x<left+w;x++){
    if(!QowIn(m,x,y)||protectedSet.has(x+","+y))continue;
    const edge=x===left||x===left+w-1||y===top||y===top+h-1;
    if(edge&&rng.chance(.22)){QowPut(m,x,y,floor);continue}
    QowPut(m,x,y,"grass"),cells++
  }
  if(cells)m.features.push({id:"grass-field-"+index,x:cx,y:cy,cells});
  return{x:cx,y:cy,w,h,tile:"grass"}
};
const QowV4AddSidePocket=(m,rng,source,side,style,biome,protectedSet,index)=>{
  const floor=QowV4FloorTile(style,biome),trail=QowV4RoadTile(style,biome),
    end={x:QowClamp(source.x+side*rng.int(7,10),6,m.w-7),y:QowClamp(source.y+rng.int(-1,1),6,m.h-7)};
  QowV4CarveLandscapePath(m,rng,source,end,1,floor,trail,protectedSet,false);
  QowV4CarveClearing(m,rng,end.x,end.y,rng.int(7,9),rng.int(5,7),style,biome);
  m.features.push({id:"side-clearing-"+index,x:end.x,y:end.y,cells:35});
  m.rooms.push({id:"side-"+index,x:end.x,y:end.y,w:7,h:5,type:"side-pocket"});
  return end
};
const QowV4AddNaturalLandmarks=(m,rng,run,style,biome,spine,protectedSet)=>{
  const marks=[];
  if(style==="route"&&rng.chance(.58)){
    const p=spine[rng.int(2,spine.length-3)],side=rng.chance(.5)?-1:1,cx=QowClamp(p.x+side*rng.int(8,11),5,m.w-6),cy=QowClamp(p.y+rng.int(-2,2),6,m.h-7);
    QowV4CarveClearing(m,rng,cx,cy,8,7,style,biome);
    const cells=QowV4FillOrganicRect(m,rng,cx,cy,5,4,"water",.12);
    marks.push({id:"pond",x:cx,y:cy,cells})
  }else if(style==="mountain"&&biome!=="volcano"){
    const p=spine[rng.int(2,spine.length-3)],side=rng.chance(.5)?-1:1,cx=QowClamp(p.x+side*6,5,m.w-6),cy=p.y;
    const cells=QowV4FillOrganicRect(m,rng,cx,cy,5,4,"rock",.2);marks.push({id:"rock-outcrop",x:cx,y:cy,cells})
  }
  for(const mark of marks)mark.cells&&m.features.push(mark);
  return marks
};
const QowV4ScatterFlowers=(m,rng,style,protectedSet)=>{
  if(!["route","forest"].includes(style))return;
  let placed=0,tries=0;
  while(placed<10&&tries++<120){
    const x=rng.int(3,m.w-4),y=rng.int(3,m.h-4),t=QowTile(m,x,y);
    if(t!=="ground"||protectedSet.has(x+","+y))continue;
    QowPut(m,x,y,"flower"),placed++
  }
};
const QowV4PlaceNear=(m,preferred,occupied,radius=5,predicate=null)=>{
  for(let r=0;r<=radius;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)+Math.abs(dy)!==r)continue;
    const x=preferred.x+dx,y=preferred.y+dy,key=x+","+y,t=QowTile(m,x,y);
    if(!QowIn(m,x,y)||occupied.has(key)||QowBlocking(t)||predicate&&!predicate(t,x,y))continue;
    occupied.add(key);return{x,y}
  }
  return null
};
const QowV4CompositionStats=m=>({
  walkableCells:m.tiles.filter(t=>!QowBlocking(t)).length,
  pathCells:m.tiles.filter(t=>t==="path").length,
  grassCells:m.tiles.filter(t=>t==="grass").length,
  blockingCells:m.tiles.filter(t=>QowBlocking(t)).length,
  branches:m.features.filter(f=>String(f.id).startsWith("side-clearing")).length,
  fields:m.features.filter(f=>String(f.id).startsWith("grass-field")).length
});
const QowBuildPokemonAttempt=(run,attempt=0)=>{
  const key=QowKey(run),rng=QowRng(QowHash(key+"|natural-v4|"+attempt)),choices=QowChoices(run),
    biome=QowRegionBias(run.region,choices[0]?.node?.biome??"grassland"),flavor=QowFloorFlavor(run,biome),style=QowPokemonStyle(biome),early=(run.mapIndex??0)<=1,
    barrier=QowV4BarrierTile(style,biome),
    m={key,w:QowW,h:QowH,tiles:Array(QowW*QowH).fill(barrier),destinations:[],pickups:[],secrets:[],npcs:[],rooms:[],edges:[],features:[],biome,layoutStyle:style,generationVersion:4,composition:early?"early-natural":"natural-route",arena:false,...flavor,spawn:{...QowSpawn},attempt},
    protectedSet=new Set;

  const spine=QowV4BuildSpine(m,rng,run,style,biome,protectedSet);
  QowV4CarveClearing(m,rng,QowSpawn.x,QowSpawn.y,9,5,style,biome);
  QowV4CarveClearing(m,rng,spine.at(-1).x,spine.at(-1).y,9,5,style,biome);

  const branchAnchors=[],branchCount=early?1:2;
  for(let n=0;n<branchCount;n++){
    const source=spine[Math.min(spine.length-2,2+n*2)],side=n%2===0?-1:1,
      end=QowV4AddSidePocket(m,rng,source,side,style,biome,protectedSet,n);
    branchAnchors.push(end),m.edges.push(["route-"+Math.max(0,1+n*2),"side-"+n])
  }

  const fields=[],fieldCount=style==="cave"?0:early?2:style==="forest"?4:3;
  for(let n=0;n<fieldCount;n++){
    const source=spine[Math.min(spine.length-2,1+n)],side=n%2===0?1:-1,
      field=QowV4AddGrassField(m,rng,source,side,style,biome,protectedSet,n);
    field&&fields.push(field)
  }
  QowV4AddNaturalLandmarks(m,rng,run,style,biome,spine,protectedSet);
  QowV4ScatterFlowers(m,rng,style,protectedSet);

  const [nativeSet,nativeRef]=QowPokemonNativeSource(style,run.region,run.mapIndex??0);
  m.nativeTheme=nativeSet,m.nativeReference=nativeRef;

  const occupied=new Set;
  for(let index=0;index<choices.length;index++){
    const choice=choices[index];let preferred,predicate=null;
    if(["city","gym","league","boss"].includes(choice.node.kind))preferred=spine.at(-1);
    else if(choice.node.kind==="wild"&&fields.length)preferred=fields[index%fields.length],predicate=t=>t==="grass";
    else if(choice.node.kind==="trainer")preferred=spine[Math.min(spine.length-2,3+index)];
    else preferred=branchAnchors[index%Math.max(1,branchAnchors.length)]??spine[Math.min(spine.length-2,2+index)];
    const pos=QowV4PlaceNear(m,preferred,occupied,6,predicate)??QowV4PlaceNear(m,preferred,occupied,7)??{x:preferred.x,y:preferred.y};
    if(choice.node.kind==="wild")QowPut(m,pos.x,pos.y,"grass");
    const dest={id:choice.node.id,kind:choice.node.kind,title:choice.node.title,detail:choice.node.detail,x:pos.x,y:pos.y,lane:choice.lane,node:choice.node,room:"target-"+index,facing:"down"};
    m.destinations.push(dest),m.rooms.push({id:"target-"+index,x:pos.x,y:pos.y,w:3,h:3,type:choice.node.kind})
  }

  const npcCount=early?1:2;
  for(let n=0;n<npcCount;n++){
    const source=spine[Math.min(spine.length-2,2+n*2)],side=n%2===0?1:-1,
      p=QowV4PlaceNear(m,{x:source.x+side*2,y:source.y},occupied,4,t=>t!=="grass");
    if(p)m.npcs.push({id:key+"-npc-"+n,kind:"wanderer",x:p.x,y:p.y,facing:side>0?"left":"right",dialogue:QowNpcDialogue(run,biome,n)})
  }

  const pickupMax=m.condition==="rich"?4:early?2:3,pickupAnchors=[...branchAnchors,...fields,...spine.slice(2,-2)];
  for(let n=0;n<pickupMax;n++){
    const anchor=pickupAnchors[n%Math.max(1,pickupAnchors.length)]??spine[Math.min(spine.length-1,n+2)],
      p=QowV4PlaceNear(m,anchor,occupied,5);if(!p)continue;
    const secret=n===0&&branchAnchors.length>0&&rng.chance(.55);
    m.pickups.push({id:key+"-pickup-"+n,x:p.x,y:p.y,room:secret?"side-0":"route-loot-"+n,secret});
    if(secret)m.secrets.push({id:key+"-secret-0",room:"side-0",x:p.x,y:p.y})
  }

  QowTerrainSynthesize(m,nativeSet,nativeRef);
  m.compositionStats=QowV4CompositionStats(m);
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
