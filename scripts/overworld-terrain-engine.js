/*
 * PokéRegions terrain synthesis engine v4
 *
 * Produces a coherent FRLG visual layer from generated logical terrain.
 * Instead of assigning arbitrary metatile IDs, it learns adjacency from a
 * real reference map and reuses only combinations that actually occur there.
 *
 * Logical collision remains authoritative. The native layer is visual only.
 */
const QowTerrainModelCache=new Map;

const QowTerrainLogicalClass=tile=>{
  if(tile==="grass")return"grass";
  if(["tree","rock","wall"].includes(tile))return"blocked";
  if(["ground","ruin","bossfloor"].includes(tile))return"open";
  // path/water/sand/snow/lava/flowers deliberately use semantic fallback.
  return null
};
const QowTerrainRawClass=raw=>{
  const id=raw&1023,collision=raw>>10&3;
  if(id===13&&collision===0)return"grass";
  return collision===0?"open":"blocked"
};
const QowTerrainPairKey=(a,b)=>String(a)+"|"+String(b);
const QowTerrainSignature=(classes,w,h,x,y)=>{
  const at=(xx,yy)=>xx<0||yy<0||xx>=w||yy>=h?"blocked":classes[yy*w+xx]??"open";
  return [at(x,y-1),at(x+1,y),at(x,y+1),at(x-1,y)].join("/")
};
const QowTerrainModel=(setName,refName)=>{
  const key=setName+"|"+refName;if(QowTerrainModelCache.has(key))return QowTerrainModelCache.get(key);
  const ref=QowNativeReference(setName,refName);if(!ref)return null;
  const count=new Map,classes=Array(ref.blocks.length);
  for(let i=0;i<ref.blocks.length;i++){
    const raw=ref.blocks[i],id=raw&1023;classes[i]=QowTerrainRawClass(raw),count.set(id,(count.get(id)??0)+1)
  }
  const byClass={open:[],grass:[],blocked:[]},bySig=new Map,hPairs=new Map,vPairs=new Map;
  for(let y=1;y<ref.h-1;y++)for(let x=1;x<ref.w-1;x++){
    const raw=ref.blocks[y*ref.w+x],id=raw&1023,cls=classes[y*ref.w+x];
    // Unique one-off map objects/signs are intentionally excluded from terrain synthesis.
    if((count.get(id)??0)<3)continue;
    const sig=QowTerrainSignature(classes,ref.w,ref.h,x,y),candidate={x,y,id,cls,sig};
    byClass[cls].push(candidate);
    const sk=cls+"|"+sig,arr=bySig.get(sk)??[];arr.push(candidate),bySig.set(sk,arr);
    const left=ref.blocks[y*ref.w+x-1]&1023,up=ref.blocks[(y-1)*ref.w+x]&1023;
    const hk=QowTerrainPairKey(left,id),vk=QowTerrainPairKey(up,id);
    hPairs.set(hk,(hPairs.get(hk)??0)+1),vPairs.set(vk,(vPairs.get(vk)??0)+1)
  }
  const model={ref,byClass,bySig,hPairs,vPairs};QowTerrainModelCache.set(key,model);return model
};
const QowTerrainTargetSignature=(map,x,y)=>{
  const at=(xx,yy)=>{
    if(xx<0||yy<0||xx>=map.w||yy>=map.h)return"blocked";
    const c=QowTerrainLogicalClass(QowTile(map,xx,yy));
    return c??"open"
  };
  return [at(x,y-1),at(x+1,y),at(x,y+1),at(x-1,y)].join("/")
};
const QowTerrainChoose=(model,map,x,y,cls,leftVisual,upVisual)=>{
  const sig=QowTerrainTargetSignature(map,x,y),exact=model.bySig.get(cls+"|"+sig),pool=(exact?.length?exact:model.byClass[cls])??[];
  if(!pool.length)return null;
  let best=-Infinity,winners=[];
  for(const c of pool){
    let score=exact?.length?8:0;
    if((x&1)===(c.x&1))score+=.5;if((y&1)===(c.y&1))score+=.5;
    if(leftVisual?.set===map.nativeSet){
      const n=model.hPairs.get(QowTerrainPairKey(leftVisual.id,c.id))??0;
      if(n)score+=2+Math.min(2,Math.log2(n+1))
    }
    if(upVisual?.set===map.nativeSet){
      const n=model.vPairs.get(QowTerrainPairKey(upVisual.id,c.id))??0;
      if(n)score+=2+Math.min(2,Math.log2(n+1))
    }
    if(score>best){best=score,winners=[c]}else if(score===best)winners.push(c)
  }
  return winners[QowHash(map.key+"|texture|"+x+"|"+y)%winners.length]
};
const QowTerrainSynthesize=(map,setName,refName)=>{
  const model=QowTerrainModel(setName,refName);if(!model)return map;
  map.nativeSet=setName,map.nativeRef=refName,map.nativeTiles=Array(map.w*map.h).fill(null),
  map.visualEngine="reference-synthesis-v4";
  for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++){
    const tile=QowTile(map,x,y),cls=QowTerrainLogicalClass(tile);if(!cls)continue;
    const left=x>0?map.nativeTiles[y*map.w+x-1]:null,up=y>0?map.nativeTiles[(y-1)*map.w+x]:null,
      chosen=QowTerrainChoose(model,map,x,y,cls,left,up);
    if(chosen)map.nativeTiles[y*map.w+x]={set:setName,id:chosen.id}
  }
  return map
};
