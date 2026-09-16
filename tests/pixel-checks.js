window.pixelScene = (screen = 'battle') => {
  const g=resetAudit('casual');
  g.elapsedTime=182;g.player.level=12;g.player.hp=82;g.player.rotationAngle=1;
  const types=['SwarmDrone','NeonScout','RelicGolem','PrismSniper','FissionCore','ChargeStriker','RepairPriest','BurstSentry'];
  g.enemies=Array.from({length:18},(_,i)=>{
    const angle=i/18*Math.PI*2,r=120+(i%3)*80;
    return new EnemyTypes[types[i%types.length]](Math.cos(angle)*r,Math.sin(angle)*r);
  });
  for(const w of Object.values(g.weapons))w.level=4;
  g.weapons.orbital_satellites.level=5;g.weapons.orbital_satellites.evolve();
  for(const id of ['armor','haste','hp','crit'])g.passives[id].level=2;
  g.player.recalculateStats(g.passives);
  if(screen==='boss') {
    const b=new BossTitan(120,-130,1,g.diffConfig);b.phase=2;b.hp=b.maxHp*.6;
    b.hazardZones=[{x:-85,y:90,radius:65,timer:.6,maxTimer:1.8}];
    g.enemies.push(b);g.activeBoss=b;document.querySelector('#boss-hud').style.display='flex';
  }
  for(const w of Object.values(g.weapons)){w.update(.016,g.player,g.enemies,g);w.update(.09,g.player,g.enemies,g);}
  for(let i=0;i<20;i++)g.spawnCrystal(Math.cos(i*2.3)*(45+i*9),Math.sin(i*2.3)*(45+i*9),i%5===0?25:1);
  g.enemyBullets=Array.from({length:8},(_,i)=>({x:150-i*22,y:90+i*7,radius:5,color:'#ff0055'}));
  g.updateHUDBuild();g.updateHUD();g.render();
  if(screen==='start'){g.state='ready';document.querySelector('#modal-start').classList.add('active');}
  if(screen==='upgrade'){g.player.pendingUpgrades=1;g.openUpgradeModal();}
  if(screen==='pause')g.openPauseModal();
  if(screen==='gear')g.openBuildDetailModal();
  return {state:g.state,enemies:g.enemies.length};
};

window.pixelChecks = async () => {
  const rows=[];const check=(passed,name,detail)=>rows.push({passed:!!passed,name,detail});
  await PixelArt.ready;await auditSaved.sound.ready;await document.fonts.ready;
  check(PixelArt.failed.length===0 && Object.values(PixelArt.images).every(i=>i.naturalWidth>0),'all six sprite images decode',PixelArt.failed);
  check(document.fonts.check('12px "Relic Pixel"'),'Chinese pixel font loaded');
  check(auditSaved.sound.failed.length===0 && auditSaved.sound.buffers.size===SOUND_SAMPLE_NAMES.length,'all PCM sound samples decode',auditSaved.sound.failed);
  const g=resetAudit();const before=JSON.stringify({hp:g.player.hp,stats:g.stats,weapons:Object.values(g.weapons).map(w=>w.damageDealt)});
  let randomCalls=0;const original=Math.random;Math.random=()=>{randomCalls++;return .5;};
  try{for(let i=0;i<10;i++)g.render();}finally{Math.random=original;}
  check(randomCalls===0,'render does not consume gameplay randomness',randomCalls);
  check(before===JSON.stringify({hp:g.player.hp,stats:g.stats,weapons:Object.values(g.weapons).map(w=>w.damageDealt)}),'render does not change damage or HP');
  check(g.pixelCanvas.width===Math.ceil(g.camera.width/2)&&!g.ctx.imageSmoothingEnabled,'half-resolution nearest-neighbour canvas');
  const hpColors=[];
  for(const ratio of [.8,.4,.1]){g.player.hp=g.player.maxHp*ratio;g.updateHUD();await new Promise(r=>setTimeout(r,300));hpColors.push(getComputedStyle(document.querySelector('#hp-fill')).backgroundColor);}
  check(new Set(hpColors).size===3,'health bar retains healthy / hurt / danger colors',hpColors);
  const sound=auditSaved.sound;await sound.ctx.resume();sound.hasUnlocked=true;sound.isMuted=false;
  sound.setGameState('playing');await new Promise(r=>setTimeout(r,700));
  check(!sound.music.paused && sound.music.loop && sound.musicGain.gain.value<=.04,'BGM starts after unlock through mobile-compatible gain',sound.musicGain.gain.value);
  window.soundSystem=sound;g.openPauseModal();check(sound.music.paused,'game pause suspends BGM immediately');
  g.resumeGame();g.openBuildDetailModal();check(sound.music.paused,'equipment drawer suspends BGM immediately');
  g.closeBuildDetailModal();await new Promise(r=>setTimeout(r,150));
  g.player.pendingUpgrades=1;g.openUpgradeModal();check(!sound.music.paused,'upgrade keeps BGM playing');
  g.gameOver(false);check(sound.music.paused,'game over suspends BGM immediately');
  window.soundSystem=null;
  sound.setGameState('playing');sound.isMuted=true;await new Promise(r=>setTimeout(r,100));check(sound.music.paused,'mute suspends BGM');
  sound.setGameState('playing');sound.isMuted=false;
  for(let i=0;i<100;i++)sound.playSample('zap1',{cooldown:0,group:'budget-'+i});
  check(sound.voices.size<=sound.maxVoices,'sample voice budget',sound.voices.size);
  await new Promise(r=>setTimeout(r,1200));check(sound.voices.size===0,'sample voices release after playback',sound.voices.size);
  const attackCalls=[],playSample=sound.playSample;
  sound.playSample=function(name,options){if(options?.group?.startsWith('weapon:'))attackCalls.push({name,...options});return playSample.call(this,name,options);};
  window.soundSystem=sound;
  try {
    for(const evolved of [false,true])for(const id of Object.keys(WeaponRegistry)) {
      const w=new WeaponRegistry[id](),p=new Player(0,0),targets=[dummy(100,0)];
      w.level=5;if(evolved)w.evolve();
      const start=attackCalls.length;w.update(.016,p,targets,quietPool());
      const calls=attackCalls.slice(start);
      check(calls.length>0 && calls.every(c=>c.group==='weapon:'+id && sound.buffers.has(c.name)),`real weapon attack audio: ${id}/${evolved?'evolved':'base'}`,calls);
      if(id!=='orbital_satellites')check(calls.length===1,`one launch sound per volley: ${id}/${evolved}`);
      w.level=0;const inactive=attackCalls.length;w.update(.1,p,targets,quietPool());
      check(attackCalls.length===inactive,`unequipped weapon silent: ${id}/${evolved}`);
    }
    const samples=Object.keys(WeaponRegistry).map(id=>attackCalls.find(c=>c.group==='weapon:'+id)?.name);
    check(new Set(samples).size===6,'six distinct weapon attack samples',samples);
    const activeGroups=new Set([...sound.voices].filter(v=>v.group.startsWith('weapon:')).map(v=>v.group));
    check(activeGroups.size===6,'simultaneous weapons do not share a cooldown gate',[...activeGroups]);
    for(let i=0;i<100;i++)for(const id of Object.keys(WeaponRegistry))sound.playWeaponAttack(id,true);
    check([...sound.voices].filter(v=>v.group.startsWith('weapon:')).length<=12 && sound.voices.size<=20,'mixed weapon burst stays within voice budget',sound.voices.size);
    sound.isMuted=true;const mutedCount=sound.voices.size;
    for(const id of Object.keys(WeaponRegistry))sound.playWeaponAttack(id);
    check(sound.voices.size===mutedCount,'mute suppresses all weapon attacks');
  } finally {sound.playSample=playSample;window.soundSystem=null;sound.isMuted=true;}
  await new Promise(r=>setTimeout(r,2500));
  check(sound.voices.size===0,'all weapon sample nodes released',sound.voices.size);
  sound.isMuted=true;
  return rows;
};
