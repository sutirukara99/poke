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
 * Pokémon route composition v3.
 *
 * Randomness chooses authored-looking arrangements, not individual noise.
 * A floor is composed from a narrow readable road, alternating encounter
 * fields, side pockets and large natural masses. This mirrors the way classic
 * Pokémon routes are mapped: clear travel line first, optional risk/reward
 * spaces second, decoration last.
 */
const QowRoadCell=(m,set,x,y,tile)=>{
  if(!QowIn(m,x,y))return;
  QowPut(m,x,y,tile),QowProtect(set,x,y)
};
const QowCarveRibbon=(m,a,b,set,tile="path",verticalFirst=true,width=2)=>{
  let x=a.x,y=a.y;
  const paint=axis=>{
    QowRoadCell(m,set,x,y,tile);
    if(width>1){
      const ox=axis==="v"?1:0,oy=axis==="h"?1:0;
      QowRoadCell(m,set,x+ox,y+oy,tile)
    }
  };
  const axis=(target,isX)=>{
    const dir=Math.sign(target-(isX?x:y));if(!dir){paint(isX?"h":"v");return}
    while((isX?x:y)!==target){isX?x+=dir:y+=dir,paint(isX?"h":"v")}
  };
  paint(verticalFirst?"v":"h");
  verticalFirst?(axis(b.y,false),axis(b.x,true)):(axis(b.x,true),axis(b.y,false))
};
const QowCarveSingle=(m,a,b,set,tile="path",horizontalFirst=true)=>{
  let x=a.x,y=a.y;
  const paint=()=>QowRoadCell(m,set,x,y,tile),axis=(target,isX)=>{while((isX?x:y)!==target){isX?x+=Math.sign(target-x):y+=Math.sign(target-y),paint()}};
  paint(),horizontalFirst?(axis(b.x,true),axis(b.y,false)):(axis(b.y,false),axis(b.x,true))
};
const QowPaintSoftRect=(m,rng,set,cx,cy,w,h,tile,protect=false)=>{
  const left=cx-Math.floor(w/2),top=cy-Math.floor(h/2);let cells=0;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
    const x=left+xx,y=top+yy,k=x+","+y;if(!QowIn(m,x,y)||set.has(k))continue;
    const corner=(xx===0||xx===w-1)&&(yy===0||yy===h-1);
    if(corner&&rng.chance(.7))continue;
    QowPut(m,x,y,tile),protect&&QowProtect(set,x,y),cells++
  }
  return cells
};
const QowFrameField=(m,rng,style,protectedSet)=>{
  const barrier=style==="coast"?"water":style==="mountain"?"rock":style==="cave"?"wall":"tree";
  if(style==="cave")return;
  for(let y=1;y<m.h-1;y++)for(let x=1;x<m.w-1;x++){
    const edge=Math.min(x,y,m.w-1-x,m.h-1-y);
    if(edge<=1||(edge===2&&rng.chance(.48)))QowPut(m,x,y,barrier)
  }
  // Long, coherent edge masses frame the route. Avoid small random speckles.
  for(let n=0;n<6;n++){
    const left=n%2===0,cx=left?rng.int(3,7):rng.int(m.w-8,m.w-4),cy=rng.int(5,m.h-6);
    QowPaintSoftRect(m,rng,protectedSet,cx,cy,rng.int(4,7),rng.int(4,7),barrier)
  }
};
const QowBuildSpine=(m,rng,style,early,protectedSet)=>{
  const road=style==="coast"?"sand":style==="cave"?"ground":"path",anchors=[{...QowSpawn}],ys=[23,19,15,11,7,3];
  let x=QowSpawn.x,dir=rng.chance(.5)?-1:1;
  for(let n=0;n<ys.length;n++){
    if(n%2===1||n===ys.length-1){
      const max=early?4:style==="mountain"?6:style==="forest"?5:4;
      let next=x+dir*rng.int(2,max);
      if(next<10||next>34)dir*=-1,next=x+dir*rng.int(2,max);
      x=QowClamp(next,9,35);
      if(rng.chance(.72))dir*=-1
    }
    anchors.push({x,y:ys[n]})
  }
  for(let n=0;n<anchors.length-1;n++){
    QowCarveRibbon(m,anchors[n],anchors[n+1],protectedSet,road,n%2===0,2);
    m.rooms.push({id:"route-"+n,x:anchors[n].x,y:anchors[n].y,w:5,h:5,type:n===0?"start":"route-zone"});
    n&&m.edges.push(["route-"+(n-1),"route-"+n])
  }
  return anchors
};
const QowAddRouteFields=(m,rng,run,style,biome,spine,protectedSet)=>{
  const fields=[],early=(run.mapIndex??0)<=1,count=early?2:style==="forest"?4:3;
  for(let n=0;n<count;n++){
    const anchor=spine[1+n%Math.max(1,spine.length-2)],side=n%2===0?-1:1,
      distance=early?rng.int(5,7):rng.int(5,9),cx=QowClamp(anchor.x+side*distance,5,m.w-6),cy=QowClamp(anchor.y+rng.int(-1,1),5,m.h-6);
    let tile="grass";
    if(style==="cave")tile="ground";
    else if(style==="mountain")tile=biome==="snow"?"snow":"ground";
    else if(style==="coast"&&n%2)tile="sand";
    const w=early?rng.int(6,8):rng.int(6,10),h=early?rng.int(4,5):rng.int(4,7),
      cells=QowPaintSoftRect(m,rng,protectedSet,cx,cy,w,h,tile,true);
    if(cells){
      fields.push({x:cx,y:cy,w,h,tile});
      m.features.push({id:tile==="grass"?"grass-field":style+"-pocket",x:cx,y:cy,cells})
    }
  }
  return fields
};
const QowAddNaturalMasses=(m,rng,run,style,biome,spine,protectedSet)=>{
  const early=(run.mapIndex??0)<=1,amount=early?3:style==="forest"?7:5;
  for(let n=0;n<amount;n++){
    const side=n%2===0?-1:1,anchor=spine[1+(n%(spine.length-2))],
      cx=QowClamp(anchor.x+side*rng.int(9,14),4,m.w-5),cy=QowClamp(anchor.y+rng.int(-2,2),4,m.h-5);
    let tile=style==="coast"?"water":style==="mountain"?(biome==="volcano"?"lava":"rock"):style==="cave"?"rock":"tree";
    const cells=QowPaintSoftRect(m,rng,protectedSet,cx,cy,rng.int(5,9),rng.int(4,7),tile);
    cells&&m.features.push({id:tile+"-mass",x:cx,y:cy,cells})
  }
  if(style==="route"&&rng.chance(early?.38:.65)){
    const side=rng.chance(.5)?-1:1,anchor=spine[rng.int(2,spine.length-2)],cx=QowClamp(anchor.x+side*rng.int(9,12),5,m.w-6),cy=QowClamp(anchor.y,6,m.h-7),
      cells=QowPaintSoftRect(m,rng,protectedSet,cx,cy,rng.int(5,7),rng.int(4,6),"water");
    cells&&m.features.push({id:"pond",x:cx,y:cy,cells})
  }
};
const QowAddFlowers=(m,rng,style,protectedSet)=>{
  if(!["route","forest"].includes(style))return;
  for(let n=0;n<12;n++){
    const x=rng.int(3,m.w-4),y=rng.int(3,m.h-4),k=x+","+y;
    if(!protectedSet.has(k)&&QowTile(m,x,y)==="ground")QowPut(m,x,y,"flower")
  }
};
const QowBuildPokemonAttempt=(run,attempt=0)=>{
  const key=QowKey(run),rng=QowRng(QowHash(key+"|pokemon-map-v3|"+attempt)),choices=QowChoices(run),
    biome=QowRegionBias(run.region,choices[0]?.node?.biome??"grassland"),flavor=QowFloorFlavor(run,biome),style=QowPokemonStyle(biome),early=(run.mapIndex??0)<=1,
    base=style==="cave"?"wall":style==="coast"?"sand":biome==="snow"?"snow":"ground",
    m={key,w:QowW,h:QowH,tiles:Array(QowW*QowH).fill(base),destinations:[],pickups:[],secrets:[],npcs:[],rooms:[],edges:[],features:[],biome,layoutStyle:style,generationVersion:3,composition:early?"early-route":"classic-route",arena:false,...flavor,spawn:{...QowSpawn},attempt},
    protectedSet=new Set;

  QowFrameField(m,rng,style,protectedSet);
  const spine=QowBuildSpine(m,rng,style,early,protectedSet);

  if(style==="cave"){
    for(const p of spine)QowPaintSoftRect(m,rng,protectedSet,p.x,p.y,rng.int(6,9),rng.int(4,6),"ground");
  }

  const fields=QowAddRouteFields(m,rng,run,style,biome,spine,protectedSet);
  QowAddNaturalMasses(m,rng,run,style,biome,spine,protectedSet);
  QowAddFlowers(m,rng,style,protectedSet);

  // One optional side pocket on early routes, two later. They terminate in a
  // readable clearing rather than stretching to the map edge.
  const branchAnchors=[],branchCount=early?1:2,road=style==="coast"?"sand":style==="cave"?"ground":"path";
  for(let n=0;n<branchCount;n++){
    const source=spine[2+n*2]??spine[2],side=n%2===0?-1:1,end={x:QowClamp(source.x+side*rng.int(7,10),5,m.w-6),y:QowClamp(source.y+rng.int(-1,1),5,m.h-6)};
    QowCarveSingle(m,source,end,protectedSet,road,true);
    QowPaintSoftRect(m,rng,protectedSet,end.x,end.y,5,5,style==="cave"?"ground":style==="coast"?"sand":"ground");
    branchAnchors.push(end),m.rooms.push({id:"side-"+n,x:end.x,y:end.y,w:5,h:5,type:"side-pocket"}),m.edges.push(["route-"+Math.max(0,1+n*2),"side-"+n])
  }

  // Spawn and route exit are compact clearings, never giant road carpets.
  QowPaintSoftRect(m,rng,new Set,QowSpawn.x,QowSpawn.y,5,3,road,true);
  const exit=spine.at(-1);QowPaintSoftRect(m,rng,new Set,exit.x,exit.y,5,3,road,true);

  const [nativeSet,nativeRef]=QowPokemonNativeSource(style,run.region,run.mapIndex??0);
  m.nativeTheme=nativeSet,m.nativeReference=nativeRef,m.visualLayer="frlg-general";
  // Do not paste arbitrary rectangular secondary-map fragments into fields.
  // They only remain for coherent town/building stamps.
  QowNativeSkin(m,nativeSet,nativeRef);

  const occupied=new Set,targetSlots=[];
  const takeSlot=(preferred,radius=5)=>{
    const p=QowFindWalkableNear(m,preferred.x,preferred.y,occupied,radius);
    if(p)occupied.add(p.x+","+p.y);
    return p
  };
  for(let index=0;index<choices.length;index++){
    const choice=choices[index];let preferred;
    if(["city","gym","league","boss"].includes(choice.node.kind))preferred=exit;
    else if(choice.node.kind==="wild"&&fields.length)preferred=fields[index%fields.length];
    else if(choice.node.kind==="trainer")preferred=spine[Math.min(spine.length-2,3+index)];
    else preferred=branchAnchors[index%Math.max(1,branchAnchors.length)]??spine[Math.min(spine.length-2,2+index)];
    const pos=takeSlot(preferred,choice.node.kind==="wild"?3:5)??{...preferred};
    if(choice.node.kind==="wild")QowPut(m,pos.x,pos.y,"grass");else QowPut(m,pos.x,pos.y,road);
    const dest={id:choice.node.id,kind:choice.node.kind,title:choice.node.title,detail:choice.node.detail,x:pos.x,y:pos.y,lane:choice.lane,node:choice.node,room:"target-"+index,facing:"down"};
    m.destinations.push(dest),targetSlots.push(pos),m.rooms.push({id:"target-"+index,x:pos.x,y:pos.y,w:3,h:3,type:choice.node.kind})
  }

  const npcCount=early?1:2,npcCandidates=spine.slice(2,-2);
  for(let n=0;n<Math.min(npcCount,npcCandidates.length);n++){
    const c=npcCandidates[(n*2+1)%npcCandidates.length],side=n%2===0?1:-1,p=takeSlot({x:c.x+side*3,y:c.y},4);
    if(p)m.npcs.push({id:key+"-npc-"+n,kind:"wanderer",x:p.x,y:p.y,facing:side>0?"left":"right",dialogue:QowNpcDialogue(run,biome,n)})
  }

  const pickupMax=m.condition==="rich"?4:early?2:3,pickupAnchors=[...branchAnchors,...fields,...spine.slice(2,-2)];
  for(let n=0;n<pickupMax;n++){
    const anchor=pickupAnchors[n%pickupAnchors.length]??spine[Math.min(spine.length-1,n+2)],p=takeSlot(anchor,5);if(!p)continue;
    const secret=n===0&&branchAnchors.length>0&&rng.chance(.58);m.pickups.push({id:key+"-pickup-"+n,x:p.x,y:p.y,room:secret?"side-0":"route-loot-"+n,secret});
    if(secret)m.secrets.push({id:key+"-secret-0",room:"side-0",x:p.x,y:p.y})
  }

  m.compositionStats={
    pathCells:m.tiles.filter(t=>t==="path").length,
    grassCells:m.tiles.filter(t=>t==="grass").length,
    blockingCells:m.tiles.filter(t=>["tree","rock","wall","water","lava"].includes(t)).length,
    branches:branchAnchors.length,
    fields:fields.length
  };
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
