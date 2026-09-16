window.combatChecks = () => {
  const rows=[],check=(passed,name,detail)=>rows.push({passed:!!passed,name,detail});
  window.soundSystem=null;
  for(const difficulty of ['casual','normal','hard'])for(const fps of [10,30,60,144]) {
    const g=resetAudit(difficulty),p=g.player,e=new EnemyTypes.PrismSniper(150,0,1,g.diffConfig),bullets=[];
    let longest=0,streak=0,lockedMovement=0,lockedFrames=0,lastOrigin=null;
    for(let i=0;i<20*fps;i++) {
      p.y=Math.sin(i/fps)*35;
      e.update(1/fps,p,[e],bullets,g);
      if(e.attackState!=='recover'){streak+=1/fps;longest=Math.max(longest,streak);}else streak=0;
      if(e.isAimLocked){lockedFrames++;if(lastOrigin)lockedMovement+=Math.hypot(e.aimOrigin.x-lastOrigin.x,e.aimOrigin.y-lastOrigin.y);lastOrigin={...e.aimOrigin};}else lastOrigin=null;
    }
    check(bullets.length>=4&&longest<=g.diffConfig.sniperAimTime+1/fps+.001&&lockedFrames>0&&lockedMovement===0,
      `sniper completes finite warning, fixed lock and recovery ${difficulty}/${fps}`,{shots:bullets.length,longest,lockedMovement});
  }
  {
    const g=resetAudit(),p=g.player,e=new EnemyTypes.PrismSniper(1000,0),bullets=[];
    // Keep the shooter offscreen throughout, including after its approach movement.
    for(let i=0;i<600;i++){e.x=1000;e.update(1/60,p,[e],bullets,g);}
    check(!bullets.length&&e.attackState==='recover','offscreen sniper never aims or fires');
    e.x=150;e.shootTimer=0;e.update(1/60,p,[e],bullets,g);
    e.x=1000;e.update(1/60,p,[e],bullets,g);
    check(e.attackState==='recover'&&!e.isAimLocked&&!e.aimOrigin,'leaving view cancels pending sniper attack');
  }
  for(const difficulty of ['casual','normal','hard']) {
    const g=resetAudit(difficulty);g.elapsedTime=400;g.enemies=[];
    for(let i=0;i<600;i++)g.spawnWave();
    const counts=Object.fromEntries(['PrismSniper','RepairPriest','BurstSentry'].map(type=>[type,g.enemies.filter(e=>e instanceof EnemyTypes[type]).length]));
    check(counts.PrismSniper===3&&counts.RepairPriest===2&&counts.BurstSentry===2,'weighted pool admits and caps specialists '+difficulty,counts);
    g.enemies=Array.from({length:8},(_,i)=>i%2?new EnemyTypes.BurstSentry(150,i*2):new EnemyTypes.PrismSniper(150,i*2));
    for(const boss of [false,true]) {
      g.activeBoss=boss?{}:null;let peak=0;
      // Reset active warnings when testing a different budget.
      for(const e of g.enemies){e.attackState='recover';e.aimOrigin=null;e.shootTimer=0;e.attackTimer=0;}
      for(let i=0;i<600;i++) {
        for(const e of g.enemies)e.update(1/60,g.player,g.enemies,[],g);
        peak=Math.max(peak,g.enemies.filter(e=>e.attackState!=='recover').length);
      }
      check(peak>0&&peak<=(boss||difficulty==='casual'?1:2),`shared ranged warning budget ${difficulty}/boss=${boss}`,peak);
    }
  }
  for(const type of ['PrismSniper','BurstSentry']) {
    const g=resetAudit();g.camera={x:0,y:0,width:320,height:568,zoom:.78};
    const e=new EnemyTypes[type](300,0),bullets=[];
    for(let i=0;i<600;i++)e.update(1/60,g.player,[e],bullets,g);
    check(bullets.length>0&&e.x<190,'ranged enemy enters narrow phone view before attacking '+type);
  }
  {
    const g=resetAudit();g.elapsedTime=0;g.enemies=[];
    for(let i=0;i<200;i++)g.spawnWave();
    check(g.enemies.every(e=>e instanceof EnemyTypes.SwarmDrone||e instanceof EnemyTypes.NeonScout),'specialist unlocks preserve opening difficulty');
  }
  {
    const p=new Player(0,0),e=new EnemyTypes.BurstSentry(200,0),bullets=[];
    e.attackTimer=0;e.update(1/60,p,[e],bullets);
    const angle=e.aimAngle;let early=0;
    for(let i=0;i<50;i++){p.y+=1;e.update(1/60,p,[e],bullets);early+=bullets.length;}
    for(let i=0;i<10;i++)e.update(1/60,p,[e],bullets);
    check(early===0&&bullets.length===3&&e.aimAngle===angle&&e.attackState==='recover','fan attack has fixed warning, three shots and recovery');
    check(bullets.every(b=>Number.isFinite(b.vx)&&Number.isFinite(b.vy)&&b.life===3),'fan projectiles are finite and expire');
  }
  {
    const healer=new EnemyTypes.RepairPriest(0,0),p=new Player(200,0),normal=Array.from({length:5},()=>new EnemyTypes.RelicGolem(20,0));
    const elite=new EnemyTypes.RelicGolem(20,0);elite.isElite=true;
    const boss=new EnemyTypes.BossTitan(20,0),dead=new EnemyTypes.SwarmDrone(20,0),other=new EnemyTypes.RepairPriest(20,0);
    dead.isDead=true;dead.hp=0;
    for(const e of [...normal,elite,boss,other,healer])e.hp=10;
    healer.healTimer=0;healer.update(.01,p,[healer,...normal,elite,boss,dead,other]);
    check(normal.filter(e=>e.hp>10).length===3&&normal.every(e=>e.hp<=28),'support heals at most three allies with bounded healing');
    check([elite,boss,other,healer].every(e=>e.hp===10)&&dead.hp===0&&dead.isDead,'support cannot heal elites, bosses, healers or resurrect dead enemies');
    healer.isDead=true;healer.healTimer=0;const hp=normal[0].hp;healer.update(1,p,normal);check(normal[0].hp===hp,'dead support cannot heal');
  }
  for(const evolved of [false,true]) {
    const w=new WeaponRegistry.orbital_satellites(),p=new Player(0,0);w.level=5;if(evolved)w.evolve();
    const pool={...quietPool(),enemyBullets:Array.from({length:20},()=>({x:100,y:0,vx:-1000,vy:0,radius:5,life:2}))};
    w.update(.1,p,[],pool);
    check(pool.enemyBullets.length===19&&w.blockedProjectiles===1,'swept interception handles fast projectile once evolved='+evolved);
    w.update(.1,p,[],pool);check(pool.enemyBullets.length===19,'shared shield cooldown prevents full bullet immunity evolved='+evolved);
    for(let i=0;i<5;i++)w.update(.1,p,[],pool);
    check(w.blockedProjectiles>1&&w.angle>0,'shield recharges and orbits without enemies evolved='+evolved);
    const baseline=runDps('orbital_satellites',5,evolved,40,60,'single',{},'sim',13);
    const area=runDps('orbital_satellites',5,evolved,40,60,'single',{area:{level:5}},'sim',13);
    check(baseline>0&&area>=baseline,'small close target coverage and nonnegative area benefit evolved='+evolved,{baseline,area});
  }
  {
    const w=new WeaponRegistry.orbital_satellites(),p=new Player(0,0);w.level=5;
    const pool={...quietPool(),enemyBullets:[{x:10,y:0,vx:-200,vy:0,radius:5,life:2},{x:60,y:0,vx:-200,vy:0,radius:5,life:0}]};
    w.update(.1,p,[],pool);
    check(w.blockedProjectiles===0,'shield ignores already expired and already-inside projectiles');
    let monotonic=true;
    for(const level of [1,3,5])for(const distance of [20,40,70,100,140]) {
      const base=runDps('orbital_satellites',level,false,distance,60,'single',{},'sim',13);
      const area=runDps('orbital_satellites',level,false,distance,60,'single',{area:{level:5}},'sim',13);
      if(area<base)monotonic=false;
    }
    check(monotonic,'area upgrade never reduces satellite small-target coverage across level/distance grid');
  }
  const sound=auditSaved.sound,calls=[],play=sound.playSample;
  try {
    sound.playSample=(name,options)=>calls.push({name,...options});
    sound.playWeaponAttack('orbital_satellites');sound.playWeaponAttack('pulse_blade');sound.playWeaponAttack('prism_ray');
    check(calls.map(c=>c.name).join(',')==='orbital-contact,blade-swish,prism-beam'&&calls[0].cooldown>=230&&calls[0].volume<=.11,'role-matched samples and quiet limited satellite impacts',calls);
  }finally{sound.playSample=play;}
  // Actual enemy AI and knockback, not immortal stationary targets: 16 incoming small enemies.
  const roles=[];
  for(const id of Object.keys(WeaponRegistry))for(const evolved of [false,true]) {
    seedRng(441);const p=new Player(0,0);p.critChance=0;
    const w=new WeaponRegistry[id]();w.level=5;if(evolved)w.evolve();
    const enemies=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return new EnemyTypes.SwarmDrone(Math.cos(a)*180,Math.sin(a)*180,3);});
    let contactFrames=0;
    for(let i=0;i<600;i++) {
      w.update(1/60,p,enemies,quietPool());
      for(const e of enemies)if(!e.isDead)e.update(1/60,p,enemies,[]);
      if(enemies.some(e=>!e.isDead&&Math.hypot(e.x,e.y)<p.radius+e.radius))contactFrames++;
    }
    roles.push({id,evolved,kills:enemies.filter(e=>e.isDead).length,contactSeconds:+(contactFrames/60).toFixed(2),damage:w.damageDealt});
  }
  check(roles.every(r=>Number.isFinite(r.damage)&&r.kills>=0&&r.kills<=16),'six weapon incoming-swarm role benchmark',roles);
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=360;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#151c2a';ctx.fillRect(0,0,800,360);ctx.font='16px "Relic Pixel"';
  for(const [i,type] of ['SwarmDrone','NeonScout','RelicGolem','PrismSniper','FissionCore','ChargeStriker','RepairPriest','BurstSentry'].entries()) {
    const e=new EnemyTypes[type](55+i*98,75);if(type==='RepairPriest')e.healTimer=.5;
    PixelArt.enemy(ctx,e);
  }
  const pilot=new Player(160,245),sat=new WeaponRegistry.orbital_satellites();sat.level=5;sat.evolve();sat.angle=.4;sat.interceptFlash=.1;PixelArt.player(ctx,pilot);sat.render(ctx,pilot);
  const shooter=new EnemyTypes.PrismSniper(340,240);shooter.attackState='locked';shooter.isAimLocked=true;shooter.aimAngle=0;shooter.aimTimer=.9;PixelArt.enemy(ctx,shooter);
  const sentry=new EnemyTypes.BurstSentry(600,170);sentry.attackState='windup';sentry.attackTimer=.4;sentry.aimAngle=Math.PI/2;PixelArt.enemy(ctx,sentry);
  window.combatPreview=canvas.toDataURL();
  return rows;
};
