window.auditSaved={random:Math.random,now:Date.now,sound:window.soundSystem,mobile:game.isMobileDevice};
window.soundSystem=null;
window.auditClock=1700000000000;
function seedRng(seed){let s=seed>>>0;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function resetAudit(diff='normal'){
 const g=window.game;g.setDifficulty(diff);g.restart();g.resize();g.camera.x=0;g.camera.y=0;g.bossTime=480;g.isMobileDevice=auditSaved.mobile;
 g.input.touchId=null;g.input.keys={up:false,down:false,left:false,right:false};g.input.updateKeyboardVector();
 Date.now=()=>window.auditClock;seedRng(12345);return g;
}
function quietPool(){return {spawnDamageText(){},spawnSparks(){},spawnShockwave(){}};}
function dummy(x,y,radius=46){const e=new EnemyTypes.BaseEnemy(x,y,{hp:1e12,radius,knockbackResistance:1});return e;}
function runDps(id,level,evolved,dist=100,fps=60,layout='single',passives={},clockMode='sim',radius=46){
 seedRng(12345);auditClock=1700000000000;const p=new Player(0,0);p.recalculateStats(passives);p.critChance=0;
 const w=new WeaponRegistry[id]();w.level=level;if(evolved)w.evolve();
 const enemies=layout==='dense'?Array.from({length:24},(_,i)=>dummy(60+(i%6)*30,(Math.floor(i/6)-1.5)*30,13)):[dummy(dist,0,radius)];
 const pool=quietPool(),dt=1/fps;
 for(let i=0;i<10*fps;i++){
  if(clockMode==='sim')auditClock=1700000000000+i*dt*1000;
  if(layout==='moving'){enemies[0].x=Math.cos(i*dt*0.7)*dist;enemies[0].y=Math.sin(i*dt*0.7)*dist;}
  w.update(dt,p,enemies,pool);
 }
 return Math.round(w.damageDealt/10*100)/100;
}
window.auditBenchmarks=()=>{
 Date.now=()=>window.auditClock;const all=[];
 for(const id of Object.keys(WeaponRegistry)){
  const row={id,levelsAt100:[1,2,3,4,5].map(lv=>runDps(id,lv,false)),evolvedAt100:runDps(id,5,true)};
  row.distance=[100,200,300].map(d=>({d,lv5:runDps(id,5,false,d),evo:runDps(id,5,true,d)}));
  row.dense={lv5:runDps(id,5,false,100,60,'dense'),evo:runDps(id,5,true,100,60,'dense')};
  row.moving={lv5:runDps(id,5,false,100,60,'moving'),evo:runDps(id,5,true,100,60,'moving')};
  row.fps=[10,20,30,60,120,144].map(fps=>({fps,lv5:runDps(id,5,false,100,fps),evo:runDps(id,5,true,100,fps)}));
  all.push(row);
 }
 const areaCoverage=[13,24,46].flatMap(radius=>[0,40,70,100,140,180,220,260].map(distance=>({radius,distance,
  base:runDps('orbital_satellites',5,false,distance,60,'single',{},'sim',radius),baseArea5:runDps('orbital_satellites',5,false,distance,60,'single',{area:{level:5}},'sim',radius),
  evolved:runDps('orbital_satellites',5,true,distance,60,'single',{},'sim',radius),evolvedArea5:runDps('orbital_satellites',5,true,distance,60,'single',{area:{level:5}},'sim',radius)})));
 const passiveInteractions=[];for(let area=0;area<=5;area++)for(let haste=0;haste<=5;haste++)passiveInteractions.push({area,haste,
  base:runDps('orbital_satellites',5,false,100,60,'single',{area:{level:area},haste:{level:haste}}),
  evolved:runDps('orbital_satellites',5,true,100,60,'single',{area:{level:area},haste:{level:haste}})});
 return {method:'10s; cold start; dt=1/fps; radius46 immortal stationary boss target; attackDamage1,area1,crit0,CDR0; evolved keeps level5 as selectUpgrade; seed12345; Date.now advanced by dt; dense 24 radius13 targets in 6x4 grid x60..210 y-45..45; no AI or displacement; moving target angular speed0.7 rad/s',all,areaCoverage,passiveInteractions};
};
window.auditTests=()=>{
 const rows=[];const test=(name,fn)=>{try{rows.push({name,result:fn()});}catch(e){rows.push({name,error:e.stack});}};
 test('start_pause_resume',()=>{const g=resetAudit();g.state='ready';g.startGame();const a=g.state;g.togglePause();const b=g.state;g.togglePause();return {states:[a,b,g.state],grace:g.player.invulnerableTimer};});
 test('drawer_escape',()=>{const g=resetAudit();g.openBuildDetailModal();window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));const before=g.elapsedTime;if(g.state==='playing')g.update(1/60);return {state:g.state,drawerActive:document.getElementById('modal-build-detail').classList.contains('active'),timeAdvanced:g.elapsedTime>before};});
 test('blur_stuck_movement',()=>{const g=resetAudit();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));window.dispatchEvent(new Event('blur'));const paused=g.state;g.resumeGame();g.update(1/60);return {paused,resumeX:g.player.x,keys:g.input.keys,vector:{...g.input.vector}};});
 test('pause_key_repeat',()=>{const g=resetAudit();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP',repeat:false}));const first=g.state;window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP',repeat:true}));return {first,repeat:g.state};});
 test('restart_camera',()=>{const g=resetAudit();g.player.x=1200;g.camera.x=1200;g.restart();return {playerX:g.player.x,cameraX:g.camera.x,screenX:(g.player.x-g.camera.x)*g.camera.zoom+g.camera.width/2};});
 test('continuous_upgrade_queue',()=>{const g=resetAudit();g.player.addExp(100,()=>g.openUpgradeModal());const before={level:g.player.level,pending:g.player.pendingUpgrades};let picked=0;while(g.player.pendingUpgrades&&picked<50){g.selectUpgrade({type:'weapon',targetId:'pulse_blade'});picked++;}return {before,picked,after:{state:g.state,pending:g.player.pendingUpgrades,weapon:g.weapons.pulse_blade.level}};});
 test('all_six_evolution_recipes',()=>{const g=resetAudit();return Object.entries(g.upgradeSystem.evolutionRecipes).map(([id,pid])=>{for(const w of Object.values(g.weapons)){w.level=0;w.isEvolved=false;}for(const p of Object.values(g.passives))p.level=0;g.weapons[id].level=5;g.passives[pid].level=1;const card=g.upgradeSystem.generateChoices(g.weapons,g.passives).find(c=>c.type==='evolution');g.player.pendingUpgrades=1;g.selectUpgrade(card);return {id,card:card.targetId,evolved:g.weapons[id].isEvolved,level:g.weapons[id].level};});});
 test('passive_caps',()=>{const g=resetAudit();for(const p of Object.values(g.passives))p.level=5;g.player.recalculateStats(g.passives);const p=g.player;return {hp:p.maxHp,armor:p.armor,cdr:p.cooldownReduction,crit:p.critChance,critDamage:p.critDamage,area:p.areaBonus,speed:p.moveSpeed,regen:p.hpRegen,pickup:p.pickupRange,exp:p.expBonus};});
 test('armor_and_invulnerability',()=>{const p=new Player(0,0);p.armor=120;const a=p.takeDamage(100),b=p.takeDamage(100);return {first:a,second:b,hp:p.hp};});
 test('shield_overflow_and_highest_hit',()=>{const g=resetAudit();const e=dummy(100,0);e.hp=100;e.shieldHp=40;e.takeDamage(83,false,g);return {hp:e.hp,shield:e.shieldHp,total:g.stats.totalDamage,highest:g.stats.highestHit,attack:83};});
 test('overkill_accounting',()=>{const g=resetAudit();const e=dummy(100,0);e.hp=1;g.player.critChance=0;const w=new PulseBlade();w.level=5;w.fire(g.player,[e],g);return {hpRemoved:1,reportedWeapon:w.damageDealt,reportedTotal:g.stats.totalDamage,kills:w.kills};});
 test('orbital_haste_and_clock',()=>({base:runDps('orbital_satellites',5,false),haste5:runDps('orbital_satellites',5,false,100,60,'single',{haste:{level:5}}),frozenClock:runDps('orbital_satellites',5,false,100,60,'single',{},'frozen')}));
 test('orbital_area_inner_deadzone',()=>({base:runDps('orbital_satellites',5,true),area5:runDps('orbital_satellites',5,true,100,60,'single',{area:{level:5}})}));
 test('sniper_zero_distance',()=>{const g=resetAudit();const e=new EnemyTypes.PrismSniper(0,0,1,g.diffConfig);for(let i=0;i<300;i++)e.update(1/60,g.player,[],g.enemyBullets);return {finite:Number.isFinite(e.x)&&Number.isFinite(e.y)&&g.enemyBullets.every(b=>Number.isFinite(b.vx)&&Number.isFinite(b.vy)),bullets:g.enemyBullets.length};});
 test('boss_phases_resistance',()=>{const g=resetAudit();const b=new BossTitan(400,0,1,g.diffConfig);const phases=[];for(const r of [1,.66,.33]){b.hp=b.maxHp*r;b.update(1/60,g.player,g.enemies,g.enemyBullets,g);phases.push(b.phase);}const x=b.x;b.applyKnockback(999,999);b.applyDisplacement(999,999);return {phases,resists:b.x===x&&b.vx===0};});
 test('boss_spawn_cap_crowded_near',()=>{const g=resetAudit('casual');g.enemies=Array.from({length:g.diffConfig.maxEnemies},()=>new EnemyTypes.SwarmDrone(200,0));g.elapsedTime=480;g.updateSpawns(1/60);return {actual:g.enemies.filter(e=>!e.isDead).length,normalCap:g.diffConfig.maxEnemies,bossCap:Math.round(g.diffConfig.maxEnemies*.75),boss:g.bossSpawned,spawnTimer:g.spawnTimer};});
 test('fission_spawn_cap',()=>{const g=resetAudit('casual');g.spawnTimer=999;g.enemies=Array.from({length:95},()=>new EnemyTypes.SwarmDrone(500,0));const f=new EnemyTypes.FissionCore(400,0);f.isDead=true;g.enemies.push(f);g.update(1/60);return {living:g.enemies.length,cap:96,children:g.enemies.filter(e=>e.isChild).length};});
 test('crystal_merge_and_conservation',()=>{const g=resetAudit();for(let i=0;i<200;i++)g.spawnCrystal(i*20,0,1);return {count:g.crystals.length,total:g.crystals.reduce((a,c)=>a+c.value,0)};});
 test('crystal_exact_overlap',()=>{const g=resetAudit();g.crystals=[{x:0,y:0,value:1,magnetized:false}];g.updateCrystals(1/60);return {remaining:g.crystals.length,exp:g.player.currentExp};});
 test('pause_exploit_grace',()=>{const g=resetAudit();let damage=0;for(let i=0;i<100;i++){g.openPauseModal();g.resumeGame();g.player.update(.1,{magnitude:0},g.arenaBound);damage+=g.player.takeDamage(50);}return {damage,hp:g.player.hp,cycles:100};});
 test('choices_bias_50000',()=>{const g=resetAudit();const counts={};for(let i=0;i<50000;i++)for(const c of g.upgradeSystem.generateChoices(g.weapons,g.passives))counts[c.targetId]=(counts[c.targetId]||0)+1;return Object.fromEntries(Object.entries(counts).map(([id,n])=>[id,+(n/500).toFixed(2)]));});
 test('rarity_rates_50000',()=>{const u=new UpgradeSystem();return [false,true].map(isNew=>{const counts={common:0,rare:0,epic:0};for(let i=0;i<50000;i++)counts[u.rollRarity(isNew)]++;return {isNew,counts};});});
 test('maxed_fallback',()=>{const g=resetAudit();for(const w of Object.values(g.weapons)){w.level=5;w.evolve();}for(const p of Object.values(g.passives))p.level=5;return g.upgradeSystem.generateChoices(g.weapons,g.passives);});
 test('victory_and_restart',()=>{const g=resetAudit();g.spawnTimer=999;const b=new BossTitan(100,0,1,g.diffConfig);b.isDead=true;g.activeBoss=b;g.enemies=[b];g.update(1/60);const won={state:g.state,bossKills:g.stats.bossKills,title:document.getElementById('gameover-title').textContent};g.restart();return {won,after:{state:g.state,time:g.elapsedTime,enemies:g.enemies.length,level:g.player.level}};});
 test('death_flow',()=>{const g=resetAudit();g.player.takeDamage(1000);g.update(1/60);return {state:g.state,title:document.getElementById('gameover-title').textContent};});
 return rows;
};
function chooseAudit(g){const cards=g.upgradeSystem.generateChoices(g.weapons,g.passives);const score=c=>c.type==='evolution'?100:({'prism_ray':90,'plasma_cannon':85,'pulse_blade':70,'arc_core':65,'black_hole':60,'orbital_satellites':45,haste:55,crit:50,hp:40,armor:35,speed:25,exp:20,pickup:15,area:30}[c.targetId]||0);return cards.sort((a,b)=>score(b)-score(a))[0];}
window.auditFlows=()=>{
 const results=[];
 for(const diff of ['casual','normal','hard'])for(const seed of [1,42,2026]){
  const g=resetAudit(diff);seedRng(seed);let choices=0,minHp=100,maxEnemies=0,firstBoss=null,bossPhases=new Set(),bad=false;
  const levels=[];let lastLevel=1;
  for(let frame=0;frame<600*60&&g.state!=='gameover';frame++){
   if(g.state==='upgrade'){const saved=g.upgradeSystem.generateChoices;const nodes=[...document.querySelectorAll('#upgrade-cards-list .upgrade-card')];let best=null,bestScore=-1;for(const n of nodes){const text=n.textContent;let s=text.includes('EVOLUTION')?100:0;for(const [name,v] of [['棱镜射线',90],['等离子炮',85],['脉冲刃',70],['电弧核心',65],['黑洞发生器',60],['超频芯片',55],['聚焦透镜',50],['轨道卫星',45],['量子核心',40],['纳米装甲',35],['能量扩增器',30],['光子喷流',25],['数据解析器',20],['磁能发生器',15]])if(text.includes(name))s=Math.max(s,v);if(s>bestScore){best=n;bestScore=s;}}if(!best)throw Error('no cards');best.click();choices++;frame--;continue;}
   const p=g.player;let tx=Math.cos(g.elapsedTime*.055)*550,ty=Math.sin(g.elapsedTime*.055)*550;
   let nearest=null,dist=Infinity;for(const c of g.crystals){const d=Math.hypot(c.x-p.x,c.y-p.y);if(d<dist){nearest=c;dist=d;}}if(nearest){tx=nearest.x;ty=nearest.y;}
   let dx=tx-p.x,dy=ty-p.y,len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
   for(const e of g.enemies){const ex=p.x-e.x,ey=p.y-e.y,d=Math.hypot(ex,ey);if(d<150&&d>0){const f=(150-d)/150*2.4;dx+=ex/d*f;dy+=ey/d*f;}}
   for(const b of g.enemyBullets){const bx=p.x-b.x,by=p.y-b.y,d=Math.hypot(bx,by);if(d<75&&d>0){dx+=bx/d*(75-d)/75*2;dy+=by/d*(75-d)/75*2;}}
   if(Math.abs(p.x)>1100)dx-=Math.sign(p.x)*2;if(Math.abs(p.y)>1100)dy-=Math.sign(p.y)*2;
   len=Math.hypot(dx,dy)||1;g.input.vector={x:dx/len,y:dy/len,magnitude:1};auditClock+=1000/60;g.update(1/60);
   minHp=Math.min(minHp,p.hp);maxEnemies=Math.max(maxEnemies,g.enemies.length);
   if(p.level!==lastLevel){levels.push({t:+g.elapsedTime.toFixed(2),level:p.level});lastLevel=p.level;}
   if(g.activeBoss){if(firstBoss===null)firstBoss=+g.elapsedTime.toFixed(2);bossPhases.add(g.activeBoss.phase);}
   if(![p.x,p.y,p.hp,...g.enemies.flatMap(e=>[e.x,e.y,e.hp])].every(Number.isFinite)){bad=true;break;}
  }
  results.push({diff,seed,state:g.state,time:+g.elapsedTime.toFixed(2),level:g.player.level,kills:g.stats.kills,hp:+g.player.hp.toFixed(2),minHp:+minHp.toFixed(2),choices,maxEnemies,firstBoss,bossPhases:[...bossPhases],nonfinite:bad,weapons:Object.fromEntries(Object.entries(g.weapons).filter(([_,w])=>w.level).map(([id,w])=>[id,{lv:w.level,evolved:w.isEvolved}])),levels});
 }
 // Controlled coverage run: real spawns, death handling, all weapon updates; invulnerability only to guarantee reaching all time gates.
 for(const diff of ['casual','normal','hard']){
  const g=resetAudit(diff);seedRng(818);let maxEnemies=0,firstBoss=null,phases=new Set();const types=new Set();
  for(const w of Object.values(g.weapons)){w.level=5;w.evolve();}
  for(let i=0;i<900*60&&g.state!=='gameover';i++){
   if(g.state==='upgrade'){document.querySelector('#upgrade-cards-list .upgrade-card').click();i--;continue;}
   g.player.invulnerableTimer=100;g.input.vector={x:Math.cos(g.elapsedTime*.08),y:Math.sin(g.elapsedTime*.08),magnitude:1};auditClock+=1000/60;g.update(1/60);
   for(const e of g.enemies)types.add(e.constructor.name);maxEnemies=Math.max(maxEnemies,g.enemies.length);
   if(g.activeBoss){if(firstBoss===null)firstBoss=+g.elapsedTime.toFixed(3);phases.add(g.activeBoss.phase);}
  }
  results.push({controlled:true,diff,state:g.state,time:+g.elapsedTime.toFixed(3),firstBoss,bossKills:g.stats.bossKills,maxEnemies,types:[...types],phases:[...phases]});
 }
 return results;
};
window.auditLayout=()=>{
 const g=resetAudit();g.resize();g.player.level=35;for(const p of Object.values(g.passives))p.level=5;g.player.recalculateStats(g.passives);for(const w of Object.values(g.weapons)){w.level=5;w.evolve();}g.updateHUDBuild();g.updateHUD();document.getElementById('boss-hud').style.display='flex';
 const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const hud={pause:rect('#btn-pause'),protocols:rect('#btn-toggle-build'),boss:rect('#boss-hud'),exp:rect('.exp-bar-wrap'),dock:rect('#build-dock')};
 for(const w of Object.values(g.weapons))w.isEvolved=false;
 g.player.pendingUpgrades=1;g.openUpgradeModal();const cards=[...document.querySelectorAll('.upgrade-card')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,text:e.textContent.trim()};});
 const upgrade={dialog:rect('#modal-upgrade .modal-dialog'),list:rect('#upgrade-cards-list'),cards,scrollWidth:document.querySelector('#modal-upgrade .modal-dialog').scrollWidth,clientWidth:document.querySelector('#modal-upgrade .modal-dialog').clientWidth};
 for(const w of Object.values(g.weapons))w.evolve();g.state='playing';document.getElementById('modal-upgrade').classList.remove('active');g.openBuildDetailModal();const bd=document.getElementById('build-detail-content');
 return {viewport:[innerWidth,innerHeight],docWidth:document.documentElement.scrollWidth,hud,upgrade,drawer:{scrollHeight:bd.scrollHeight,clientHeight:bd.clientHeight,touchAction:getComputedStyle(document.body).touchAction}};
};
window.auditScrollSetup=()=>{auditLayout();const el=document.getElementById('build-detail-content');el.scrollTop=0;};
window.auditScrollRead=()=>{const e=document.getElementById('build-detail-content');return {scrollTop:e.scrollTop,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,rect:e.getBoundingClientRect().toJSON(),hit:document.elementFromPoint(200,400)?.className};};
