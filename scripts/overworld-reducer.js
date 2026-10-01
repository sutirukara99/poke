if(i.type==="discardHeld"&&r.phase!=="battle"&&(r.heldItems[i.item]??0)>0){r.heldItems[i.item]--,r.message=Ge[i.item].name+" wurde weggeworfen.";return d}
if(i.type==="overworldDebug"&&r.phase==="map"){
  const Qs=QowEnsure(r),Qm=QowBuild(r);
  if(i.action==="regen"){Qs.debugSalt=(Qs.debugSalt??0)+1,Qs.pendingNode=null,Qs.lastMessage="Debug: Floor wird mit neuem Salt regeneriert.";return d}
  if(i.action==="reveal"){
    const Qall=[];for(let Qy=0;Qy<Qm.h;Qy++)for(let Qx=0;Qx<Qm.w;Qx++)Qall.push(Qx+","+Qy);
    Qs.seen=Qall,Qs.lastMessage="Debug: kompletter Floor aufgedeckt.";
    return d
  }
  if(i.action==="wild"){
    const Qwild=Qm.destinations.find(Q=>Q.kind==="wild");
    if(Qwild){Qs.pendingNode=Qwild.id,Qs.encounterOnly=!0,Qs.danger=0,Qs.lastMessage="Debug: Wildbegegnung ausgelöst."}
    else Qs.lastMessage="Debug: Auf diesem Floor ist kein Wild-Ziel verfügbar.";
    return d
  }
  if(i.action==="exit"){
    const Qtarget=Qm.destinations.find(Q=>["city","gym","league","boss"].includes(Q.kind))??Qm.destinations.at(-1);
    if(Qtarget){
      const Qspots=[[Qtarget.x,Qtarget.y+1,"up"],[Qtarget.x,Qtarget.y-1,"down"],[Qtarget.x+1,Qtarget.y,"left"],[Qtarget.x-1,Qtarget.y,"right"]].filter(Q=>!QowBlocking(QowTile(Qm,Q[0],Q[1])));
      const Qspot=Qspots[0]??[Qtarget.x,Qtarget.y,"up"];
      Qs.x=Qspot[0],Qs.y=Qspot[1],Qs.facing=Qspot[2],QowReveal(Qs,Qs.x,Qs.y,Qm.w,Qm.h),Qs.lastMessage="Debug: zum nächsten Hauptziel teleportiert.";
    }
    return d
  }
}
if(i.type==="overworldMove"&&r.phase==="map"){
  const Qs=QowEnsure(r),Qm=QowBuild(r);
  if(Qs.pendingNode)return d;
  const Qdir=i.dir,Qdx=Qdir==="left"?-1:Qdir==="right"?1:0,Qdy=Qdir==="up"?-1:Qdir==="down"?1:0;
  Qs.facing=Qdir;
  const Qx=Qs.x+Qdx,Qy=Qs.y+Qdy;
  if(Qx<0||Qy<0||Qx>=Qm.w||Qy>=Qm.h||QowBlocking(QowTile(Qm,Qx,Qy))){Qs.lastMessage="Der Weg ist blockiert.";return d}
  Qs.prevX=Qs.x,Qs.prevY=Qs.y,Qs.x=Qx,Qs.y=Qy,Qs.steps=(Qs.steps??0)+1,QowReveal(Qs,Qx,Qy,Qm.w,Qm.h);
  const Qtile=QowTile(Qm,Qx,Qy),Qgain=QowDangerGain(r,Qtile,Qm);
  Qs.danger=Math.max(0,Math.min(100,(Qs.danger??0)+Qgain));
  const Qpickup=Qm.pickups.find(Q=>Q.x===Qx&&Q.y===Qy&&!(Qs.picked??[]).includes(Q.id));
  const Qdest=Qm.destinations.find(Q=>Q.x===Qx&&Q.y===Qy);
  Qs.lastMessage=Qpickup?"Hier liegt ein Item-Ball. E zum Aufheben.":Qdest?QowKindLabel(Qdest.kind)+" · E zum Interagieren":"Erkunde das Gebiet · WASD bewegen · E interagieren";
  if(Qtile==="grass"&&(Qs.danger??0)>=100){
    const Qwild=Qm.destinations.find(Q=>Q.kind==="wild");
    if(Qwild){Qs.pendingNode=Qwild.id,Qs.encounterOnly=!0,Qs.danger=0,Qs.grassSteps=0,Qs.lastMessage="Das Gras raschelt – ein wildes Pokémon erscheint!",r.rng=u.state;return d}
  }
  const Qtrainer=Qm.destinations.find(Q=>Q.kind==="trainer"&&!(Qs.defeatedTrainers??[]).includes(Q.id)&&QowTrainerSees(Qm,Q,Qx,Qy));
  if(Qtrainer){Qs.pendingNode=Qtrainer.id,Qs.encounterOnly=!1,Qs.lastMessage="! Ein Trainer hat dich entdeckt!",r.rng=u.state;return d}
  r.rng=u.state;
  return d
}
if(i.type==="overworldInteract"&&r.phase==="map"){
  const Qs=QowEnsure(r),Qm=QowBuild(r);
  if(Qs.pendingNode)return d;
  const Qf=QowFront(Qs),Qpickup=Qm.pickups.find(Q=>(Q.x===Qf.x&&Q.y===Qf.y||Q.x===Qs.x&&Q.y===Qs.y)&&!(Qs.picked??[]).includes(Q.id));
  if(Qpickup){
    Qs.picked??=[],Qs.picked.push(Qpickup.id);
    const Qroll=Qpickup.secret?u.next()*.55:u.next();Qpickup.secret&&(r.secretsFound=(r.secretsFound??0)+1);
    if(Qroll<.16){
      const Qdisc=QjourneyFindDiscovery(r.region,d.worldDiscoveries??[],u);
      if(Qdisc){d.worldDiscoveries??=[],d.worldDiscoveries.includes(Qdisc.id)||d.worldDiscoveries.push(Qdisc.id),r.secretsFound=(r.secretsFound??0)+1,Qs.lastMessage="✦ "+Qdisc.name+" entdeckt! "+QjourneyApplyDiscovery(r,Qdisc)}
      else r.ultraBalls++,Qs.lastMessage="Du findest einen Hyperball."
    }else if(Qroll<.42)r.balls++,Qs.lastMessage="Du findest einen Pokéball.";
    else if(Qroll<.68)r.potions++,Qs.lastMessage="Du findest einen Trank.";
    else if(Qroll<.85)r.superPotions++,Qs.lastMessage="Du findest einen Supertrank.";
    else{const Qmoney=u.int(90,220);r.money+=Qmoney,Qs.lastMessage="Du findest "+Qmoney+" ₽."}Qpickup.secret&&(Qs.lastMessage="Geheimfund! "+Qs.lastMessage)
    r.rng=u.state;
    return d
  }
  const Qdest=Qm.destinations.find(Q=>Q.x===Qf.x&&Q.y===Qf.y||Q.x===Qs.x&&Q.y===Qs.y);
  if(Qdest){Qs.pendingNode=Qdest.id,Qs.encounterOnly=!1,Qs.lastMessage=QowKindLabel(Qdest.kind)+".";return d}
  Qs.lastMessage="Hier gibt es nichts zum Interagieren.";
  return d
}
if(i.type==="journeyAction"&&r.phase==="map"){return d}
if((i.type==="node"||i.type==="journeyTravel"||i.type==="overworldTrigger")&&r.phase==="map"){if(i.type==="journeyTravel"||i.type==="overworldTrigger"){const Qj=r.journey??(r.journey=QjourneyState());Qj.lastPath=i.id,Qj.scouted=!1;Qj.overworld&&(Qj.overworld.pendingNode=null)}