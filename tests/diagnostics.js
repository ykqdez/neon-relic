window.auditExtra=()=>{
 const out={};let g=resetAudit();
 const sample=()=>{const counts={};for(let i=0;i<50000;i++)for(const c of g.upgradeSystem.generateChoices(g.weapons,g.passives))counts[c.targetId]=(counts[c.targetId]||0)+1;return Object.fromEntries(Object.entries(counts).map(([id,n])=>[id,+(n/500).toFixed(2)]));};
 Math.random=auditSaved.random;out.nativeRandomChoices=sample();
 const savedGenerate=g.upgradeSystem.generateChoices;
 // Independent equal-probability reference, never used by production code.
 const ids=[...Object.keys(g.weapons),...Object.keys(g.passives)],counts={};
 for(let i=0;i<50000;i++){const arr=[...ids];for(let j=arr.length-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));[arr[j],arr[k]]=[arr[k],arr[j]];}for(const id of arr.slice(0,3))counts[id]=(counts[id]||0)+1;}
 out.fisherYatesReference=Object.fromEntries(Object.entries(counts).map(([id,n])=>[id,+(n/500).toFixed(2)]));
 g=resetAudit();g.player.hp=20;g.player.currentExp=11;g.player.pendingUpgrades=1;g.state='upgrade';g.selectUpgrade({type:'weapon',targetId:'pulse_blade',bonus:{healPercent:.15,expPercent:.2}});out.epicQueue={level:g.player.level,pending:g.player.pendingUpgrades,state:g.state,hp:g.player.hp};
 g=resetAudit();for(const id of ['armor','pickup','haste','crit','hp','speed','exp','area'])g.passives[id].level=1;g.player.recalculateStats(g.passives);const w=g.weapons.pulse_blade;w.level=5;g.player.pendingUpgrades=1;g.openUpgradeModal();const element=document.querySelector('.upgrade-card');element.click();const before={lv:w.level,evolved:w.isEvolved,pending:g.player.pendingUpgrades,state:g.state};element.click();out.staleCardClick={before,after:{lv:w.level,evolved:w.isEvolved,pending:g.player.pendingUpgrades,state:g.state}};
 g=resetAudit('casual');out.spawnWeights=[];for(const t of [0,90,150,240,330]){g.elapsedTime=t;const count={};for(let i=0;i<10000;i++){g.enemies=[];g.spawnWave();const type=g.enemies[0].constructor.name;count[type]=(count[type]||0)+1;}out.spawnWeights.push({t,count});}
 g=resetAudit();g.state='playing';g.input.keys.right=true;g.input.updateKeyboardVector();g.camera.x=1200;g.restart();out.restartInput={vector:{...g.input.vector},cameraX:g.camera.x};
 g=resetAudit();g.openBuildDetailModal();g.togglePause();const time=g.elapsedTime;g.update(.1);g.closeBuildDetailModal();out.drawerGraceExploit={runningUnderDrawer:g.elapsedTime>time,state:g.state,grace:g.player.invulnerableTimer};
 g=resetAudit();let calls=0;const origSpawn=g.spawnShockwave;g.spawnShockwave=function(...args){calls++;return origSpawn.apply(this,args);};for(let i=0;i<1000;i++)g.spawnShockwave(0,0,50,'#ffffff');out.shockwavesUnbounded=g.shockwaves.length;g.spawnShockwave=origSpawn;
 // Instrument sound node creation without replacing synthesis implementation.
 const sound=auditSaved.sound;sound.isMuted=false;if(sound.ctx){const ctx=sound.ctx,orig=ctx.createOscillator.bind(ctx);let nodes=0;ctx.createOscillator=()=>{nodes++;return orig();};sound.lastSoundTimes.hit=0;for(let i=0;i<100;i++)sound.playHit(true);const critNodes=nodes;nodes=0;sound.lastSoundTimes.hit=0;for(let i=0;i<100;i++)sound.playHit(false);out.audioThrottle={critNodes,normalNodes:nodes};ctx.createOscillator=orig;sound.isMuted=true;}
 // 3600 updates (60 seconds simulation), with full actual Canvas drawing. Measures CPU submission, not presented FPS.
 out.stress=[];for(const mobile of [false,true]){
  g=resetAudit('hard');g.isMobileDevice=mobile;g.resize(mobile?390:1728,mobile?844:896);g.spawnTimer=9999;g.eliteTimer=9999;
  for(const w of Object.values(g.weapons)){w.level=5;w.evolve();}for(const p of Object.values(g.passives))p.level=5;g.player.recalculateStats(g.passives);g.player.critChance=.35;
  g.enemies=Array.from({length:180},(_,i)=>{const e=new EnemyTypes.SwarmDrone(Math.cos(i)* (70+i),Math.sin(i)*(70+i));e.hp=e.maxHp=1e12;return e;});
  const timings=[];let maxShock=0,maxParticles=0;for(let i=0;i<3600;i++){const t=performance.now();auditClock+=1000/60;g.player.invulnerableTimer=100;g.update(1/60);g.render();timings.push(performance.now()-t);maxShock=Math.max(maxShock,g.shockwaves.length);maxParticles=Math.max(maxParticles,g.particles.length);}
  timings.sort((a,b)=>a-b);out.stress.push({mobile,viewport:[g.camera.width,g.camera.height],meanMs:timings.reduce((a,b)=>a+b,0)/timings.length,p95Ms:timings[Math.floor(timings.length*.95)],maxMs:timings.at(-1),maxShock,maxParticles,damageTexts:g.damageTexts.length});
 }
 g=resetAudit();g.player.x=900;g.camera.x=0;seedRng(93);let inside=0;const hw=g.camera.width/2/g.camera.zoom,hh=g.camera.height/2/g.camera.zoom;for(let i=0;i<1000;i++){const s=g.getOffscreenSpawnPosition();if(Math.abs(s.x-g.camera.x)<hw&&Math.abs(s.y-g.camera.y)<hh)inside++;}out.cameraLagSpawn={playerX:900,cameraX:0,inside,total:1000};
 return out;
};
