/*
 * PokéRegions Phaser Overworld bridge
 *
 * Phaser owns the live game loop, camera, keyboard cadence and sprite tweening.
 * React remains responsible for HUD and the existing reducer/backend.
 */
const QowPhaserVersion="phaser-v2",QowPhaserViewportW=240,QowPhaserViewportH=160;
const QowPhaserAvailable=()=>!!window.Phaser;

const QowPhaserTerrainCanvas=map=>{
  const canvas=document.createElement("canvas");
  canvas.width=map.w*QowTileSize;
  canvas.height=map.h*QowTileSize;
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx)return canvas;
  ctx.imageSmoothingEnabled=false;
  const palette=QowPalette(map.region,map.biome);
  ctx.fillStyle=palette.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  const camera={x:0,y:0};
  for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)QowDrawTile(ctx,0,0,y,x,camera,map);
  return canvas
};
const QowPhaserSemanticTile=(tile,index)=>{
  if(Number.isInteger(index?.[tile]))return index[tile];
  if(tile==="snow"||tile==="ruin"||tile==="bossfloor"||tile==="lava")return index?.ground??0;
  return index?.ground??0
};
const QowPhaserTileData=(map,index)=>Array.from({length:map.h},(_,y)=>Array.from({length:map.w},(_,x)=>QowPhaserSemanticTile(QowTile(map,x,y),index)));
const QowPhaserIntegerScale=(host,game)=>{
  if(!host||!game?.canvas)return;
  const scale=Math.max(1,Math.min(4,Math.floor(Math.min(host.clientWidth/QowPhaserViewportW,host.clientHeight/QowPhaserViewportH))||1));
  game.canvas.style.width=(QowPhaserViewportW*scale)+"px";
  game.canvas.style.height=(QowPhaserViewportH*scale)+"px";
  game.canvas.style.maxWidth="100%";
  game.canvas.style.maxHeight="100%"
};

const QowPhaserEntityTexture=entity=>{
  if(entity.kind==="pickup")return"ow-item";
  if(entity.kind==="boss")return"ow-hiker";
  if(entity.kind==="heal")return"ow-nurse";
  if(["trainer","tutor","shop","wanderer"].includes(entity.kind))return"ow-youngster";
  if(entity.kind==="gym")return"ow-gym-sign";
  if(["city","mystery","legendary"].includes(entity.kind))return"ow-sign";
  return null
};

const QowPhaserFacingFrame=dir=>dir==="up"?3:dir==="left"||dir==="right"?6:0;

const QowMountPhaser=(host,bridge)=>{
  const Phaser=window.Phaser;
  if(!Phaser||!host)return()=>{};
  let sceneRef=null,game=null,destroyed=false;

  class PokeregionsOverworldScene extends Phaser.Scene{
    constructor(){super("pokeregions-overworld")}
    preload(){
      this.load.spritesheet("ow-player",QowActiveTileset.objects.player,{frameWidth:16,frameHeight:24});
      this.load.image("ow-youngster",QowActiveTileset.objects.youngster);
      this.load.image("ow-hiker",QowActiveTileset.objects.hiker);
      this.load.image("ow-nurse",QowActiveTileset.objects.nurse);
      this.load.image("ow-item",QowActiveTileset.objects.itemBall);
      this.load.image("ow-sign",QowActiveTileset.objects.sign);
      this.load.image("ow-gym-sign",QowActiveTileset.objects.gymSign);
      const lead=bridge.current.leadSrc;
      if(lead)this.load.image("ow-lead",lead)
    }
    create(){
      sceneRef=this;
      this.mapData=bridge.current.map;
      this.localX=bridge.current.player.x;
      this.localY=bridge.current.player.y;
      this.moving=false;
      this.nextMoveAt=0;
      this.lastHeld="";
      this.terrainImage=null;
      this.tilemap=null;
      this.tileLayer=null;
      this.entitySprites=[];
      this.refreshTerrain();
      this.createEntities();

      const px=this.localX*QowTileSize+QowTileSize/2,py=this.localY*QowTileSize+QowTileSize;
      this.player=this.add.sprite(px,py,"ow-player",QowPhaserFacingFrame(bridge.current.player.facing??"down"))
        .setOrigin(.5,1).setDepth(100);
      this.player.setFlipX((bridge.current.player.facing??"down")==="right");
      const anims=[["down",[0,1,0,2]],["up",[3,4,3,5]],["left",[6,7,6,8]]];
      for(const [name,frames] of anims)if(!this.anims.exists("ow-walk-"+name))this.anims.create({
        key:"ow-walk-"+name,frames:frames.map(frame=>({key:"ow-player",frame})),frameRate:10,repeat:-1
      });

      if(this.textures.exists("ow-lead")){
        this.lead=this.add.image(px,py+1,"ow-lead").setOrigin(.5,1).setDisplaySize(16,16).setDepth(95)
      }

      this.cameras.main.setBounds(0,0,this.mapData.w*QowTileSize,this.mapData.h*QowTileSize);
      this.cameras.main.startFollow(this.player,true,1,1);
      this.cameras.main.setRoundPixels(true);
      this.cameras.main.setDeadzone(0,0);

      this.keys=this.input.keyboard.addKeys({
        up:"W",down:"S",left:"A",right:"D",
        upArrow:"UP",downArrow:"DOWN",leftArrow:"LEFT",rightArrow:"RIGHT",
        interact:"E",enter:"ENTER",space:"SPACE",menu:"M",escape:"ESC",debug:"F2"
      });
      this.input.keyboard.on("keydown",e=>{
        if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
        if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Enter"].includes(e.key))e.preventDefault()
      });

      this.assetRefresh=()=>this.refreshTerrain();
      window.addEventListener("pokeregions:overworld-assets",this.assetRefresh);

      window.__POKEREGIONS_PHASER_OVERWORLD__={
        move:dir=>this.requestMove(dir,true),
        interact:()=>this.interact(),
        scene:this
      };
    }
    refreshTerrain(){
      if(!this.mapData||destroyed)return;
      this.tileLayer?.destroy();this.tileLayer=null;this.tilemap?.destroy?.();this.tilemap=null;
      this.terrainImage?.destroy();this.terrainImage=null;
      const frlg=QowEnsureFrlgAtlas(),key="ow-semantic-"+QowHash(this.mapData.key+"|"+QowPhaserVersion);
      if(frlg?.atlas&&frlg?.index){
        if(this.textures.exists(key))this.textures.remove(key);
        this.textures.addCanvas(key,frlg.atlas);
        const data=QowPhaserTileData(this.mapData,frlg.index);
        this.tilemap=this.make.tilemap({data,tileWidth:16,tileHeight:16});
        const tiles=this.tilemap.addTilesetImage(key,key,16,16,0,0,0);
        if(tiles)this.tileLayer=this.tilemap.createLayer(0,tiles,0,0)?.setDepth(0)??null;
      }else{
        const fallbackKey=key+"-fallback",canvas=QowPhaserTerrainCanvas(this.mapData);
        if(this.textures.exists(fallbackKey))this.textures.remove(fallbackKey);
        this.textures.addCanvas(fallbackKey,canvas);
        this.terrainImage=this.add.image(0,0,fallbackKey).setOrigin(0,0).setDepth(0)
      }
    }
    createEntities(){
      for(const sprite of this.entitySprites)sprite.destroy();
      this.entitySprites=[];
      const state=bridge.current.player;
      const add=(entity,type)=>{
        if(type==="pickup"&&(state.picked??[]).includes(entity.id))return;
        if(entity.kind==="wild"||entity.hideEntity)return;
        const texture=QowPhaserEntityTexture(type==="pickup"?{kind:"pickup"}:entity);
        if(!texture||!this.textures.exists(texture))return;
        const sprite=this.add.image(entity.x*16+8,entity.y*16+16,texture)
          .setOrigin(.5,1).setDepth(70+entity.y);
        if(type!=="pickup"&&["trainer","boss","tutor","shop","heal","wanderer"].includes(entity.kind))sprite.setDisplaySize(16,24);
        else sprite.setDisplaySize(16,16);
        sprite.__owId=entity.id;
        sprite.__owType=type;
        this.entitySprites.push(sprite)
      };
      for(const p of this.mapData.pickups??[])add(p,"pickup");
      for(const n of this.mapData.npcs??[])add(n,"npc");
      for(const d of this.mapData.destinations??[])add(d,"destination")
    }
    setFacing(dir,walking=false){
      const base=QowPhaserFacingFrame(dir);
      if(!this.player)return;
      this.player.setFlipX(dir==="right");
      if(walking){
        const animDir=dir==="right"?"left":dir,key="ow-walk-"+animDir;
        this.player.anims?.play?.(key,true)
      }else{
        this.player.anims?.stop?.();
        this.player.setFrame(base)
      }
    }
    heldDirection(){
      const k=this.keys;
      if(k.left.isDown||k.leftArrow.isDown)return"left";
      if(k.right.isDown||k.rightArrow.isDown)return"right";
      if(k.up.isDown||k.upArrow.isDown)return"up";
      if(k.down.isDown||k.downArrow.isDown)return"down";
      return null
    }
    blocked(x,y){
      const map=bridge.current.map,state=bridge.current.player;
      return x<0||y<0||x>=map.w||y>=map.h||QowBlocking(QowTile(map,x,y))||!!QowSolidEntityAt(map,x,y,state)
    }
    requestMove(dir,fromTouch=false){
      if(this.moving||bridge.current.player.pendingNode)return false;
      const delta=dir==="left"?[-1,0]:dir==="right"?[1,0]:dir==="up"?[0,-1]:[0,1],
        tx=this.localX+delta[0],ty=this.localY+delta[1];
      this.setFacing(dir,false);
      if(this.blocked(tx,ty)){
        bridge.current.dispatch({type:"overworldMove",dir});
        this.nextMoveAt=this.time.now+90;
        return false
      }
      this.moving=true;
      const oldX=this.localX,oldY=this.localY;
      this.setFacing(dir,true);
      if(this.lead){
        this.lead.setPosition(oldX*16+8,oldY*16+16);
        this.lead.setDepth(60+oldY)
      }
      this.tweens.add({
        targets:this.player,
        x:tx*16+8,y:ty*16+16,
        duration:128,
        ease:"Linear",
        onUpdate:()=>{
          if(!this.player)return;
          this.player.x=Math.round(this.player.x);this.player.y=Math.round(this.player.y);
          this.player.setDepth(100+Math.floor(this.player.y/16))
        },
        onComplete:()=>{
          this.player?.setPosition(tx*16+8,ty*16+16);
          this.localX=tx;this.localY=ty;this.moving=false;this.setFacing(dir,false);
          this.nextMoveAt=this.time.now;
          bridge.current.dispatch({type:"overworldMove",dir})
        }
      });
      return true
    }
    interact(){
      if(this.moving||bridge.current.player.pendingNode)return;
      bridge.current.dispatch({type:"overworldInteract"})
    }
    syncExternalState(){
      const p=bridge.current.player;
      if(this.moving||!p)return;
      if(p.x!==this.localX||p.y!==this.localY){
        this.localX=p.x;this.localY=p.y;
        this.player?.setPosition(p.x*16+8,p.y*16+16);
        this.setFacing(p.facing??"down",false);
        this.cameras.main.centerOn(this.player.x,this.player.y)
      }
      const picked=new Set(p.picked??[]);
      for(const sprite of this.entitySprites)if(sprite.__owType==="pickup")sprite.setVisible(!picked.has(sprite.__owId))
    }
    update(time){
      this.syncExternalState();
      if(Phaser.Input.Keyboard.JustDown(this.keys.interact)||Phaser.Input.Keyboard.JustDown(this.keys.enter)||Phaser.Input.Keyboard.JustDown(this.keys.space))this.interact();
      if(Phaser.Input.Keyboard.JustDown(this.keys.menu)||Phaser.Input.Keyboard.JustDown(this.keys.escape))document.querySelector(".pr-game-menu-toggle")?.click();
      if(Phaser.Input.Keyboard.JustDown(this.keys.debug))window.dispatchEvent(new CustomEvent("pokeregions:phaser-debug"));
      if(this.moving||bridge.current.player.pendingNode)return;
      const dir=this.heldDirection();
      if(!dir){this.lastHeld="";return}
      if(dir!==this.lastHeld){this.lastHeld=dir;this.nextMoveAt=time}
      if(time>=this.nextMoveAt&&this.requestMove(dir))this.nextMoveAt=time
    }
    shutdown(){
      window.removeEventListener("pokeregions:overworld-assets",this.assetRefresh);
      if(window.__POKEREGIONS_PHASER_OVERWORLD__?.scene===this)delete window.__POKEREGIONS_PHASER_OVERWORLD__
    }
  }

  game=new Phaser.Game({
    type:Phaser.CANVAS,
    width:QowPhaserViewportW,
    height:QowPhaserViewportH,
    parent:host,
    backgroundColor:"#071011",
    pixelArt:true,
    antialias:false,
    roundPixels:true,
    banner:false,
    audio:{noAudio:true},
    scene:[PokeregionsOverworldScene],
    scale:{mode:Phaser.Scale.NONE,width:QowPhaserViewportW,height:QowPhaserViewportH},
    render:{antialias:false,pixelArt:true,roundPixels:true}
  });
  const resize=()=>QowPhaserIntegerScale(host,game);
  requestAnimationFrame(resize);
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;
  observer?.observe(host);
  window.addEventListener("resize",resize);

  return()=>{
    destroyed=true;
    observer?.disconnect();window.removeEventListener("resize",resize);
    try{sceneRef?.shutdown?.()}catch{}
    if(window.__POKEREGIONS_PHASER_OVERWORLD__?.scene===sceneRef)delete window.__POKEREGIONS_PHASER_OVERWORLD__;
    game?.destroy(true);
    host.replaceChildren()
  }
};

const QowPhaserCanvas=({map:a,player:i,leadSrc:d,dispatch:r})=>{
  const u=X.useRef(null),h=X.useRef({map:a,player:i,leadSrc:d,dispatch:r});
  h.current={map:a,player:i,leadSrc:d,dispatch:r};
  X.useEffect(()=>{
    if(!QowPhaserAvailable()||!u.current)return;
    return QowMountPhaser(u.current,h)
  },[a.key]);
  return l.jsx("div",{ref:u,className:"ow-phaser-host","data-engine":QowPhaserVersion,"aria-label":"PokéRegions Phaser Overworld"})
};
