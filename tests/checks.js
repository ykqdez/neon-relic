// Assertions use real game classes; clocks/targets are controlled only inside the browser fixture.
window.regressionChecks = () => {
  const rows = [];
  const test = (name, fn) => {
    try { fn(); rows.push({ name, passed: true }); }
    catch (e) { rows.push({ name, passed: false, detail: e.stack }); }
  };
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const near = (a, b) => Math.abs(a-b) < 1e-8;
  for (const fps of [10, 20, 30, 60, 120, 144, 'jitter']) {
    test('one black hole lifetime at ' + fps, () => {
      const g = resetAudit(); g.player.critChance = 0;
      const w = new BlackHoleGenerator(); w.level = 5; w.timer = 999;
      const e = dummy(100, 0); w.fire(g.player, [e], quietPool());
      let t = 0, frame = 0;
      while (t < 4) {
        const dt = fps === 'jitter' ? [0.01,0.1,0.027,0.063][frame++ % 4] : 1/fps;
        w.update(dt, g.player, [e], quietPool()); t += dt;
      }
      assert(w.damageDealt === 260 && w.holes.length === 0, 'expected 13 hits / 260, got ' + w.damageDealt);
    });
  }
  for (const type of ['beam', 'hole']) for (const nextTick of [0.005, 0.01, 0.05]) {
    test(`${type} expiration tick ${nextTick}`, () => {
      const g = resetAudit(); g.player.critChance = 0;
      const w = type === 'beam' ? new PrismRay() : new BlackHoleGenerator(); w.level = 5;
      if (type === 'beam') w.evolve();
      const e = dummy(100, 0); w.fire(g.player, [e], quietPool()); w.timer = 999;
      const effect = type === 'beam' ? w.beams[1] : w.holes[0];
      if (type === 'beam') w.beams = [effect];
      effect.life = .01; effect.tickTimer = nextTick;
      w.update(.1, g.player, [e], quietPool());
      assert(w.damageDealt === (nextTick <= .01 ? effect.damage : 0), 'tick beyond lifetime or missing endpoint');
    });
  }
  test('beam multiple ticks and dead effect', () => {
    const g = resetAudit(); g.player.critChance = 0;
    const w = new PrismRay(); w.level = 5; w.evolve();
    const e = dummy(100,0); w.fire(g.player,[e],quietPool()); w.timer=999;
    const b=w.beams[1]; w.beams=[b]; b.tickTimer=0; b.life=.1;
    w.update(.1,g.player,[e],quietPool()); assert(w.damageDealt===72,'two active ticks');
    w.beams=[{...b,life:0,tickTimer:0}]; w.update(.1,g.player,[e],quietPool());
    assert(w.damageDealt===72,'zero lifetime must not hit');
  });
  test('beam jitter equals regular simulation for locked target', () => {
    function run(jitter) {
      const g=resetAudit();g.player.critChance=0;const w=new PrismRay();w.level=5;w.evolve();
      const e=dummy(100,0);w.fire(g.player,[e],quietPool());w.beams=[w.beams[1]];w.timer=999;
      for(let t=0,i=0;t<1.2;i++){const dt=jitter?[.1,.01,.063,.027][i%4]:1/60;w.update(dt,g.player,[e],quietPool());t+=dt;}
      return w.damageDealt;
    }
    assert(run(true)===468 && run(false)===468,'13 central ticks over 1 second');
  });
  test('manual pause survives drawer close', () => {
    const g=resetAudit();g.openPauseModal();g.openBuildDetailModal();g.closeBuildDetailModal();
    assert(g.state==='paused' && g.pauseReasons.has('user_pause'),'drawer cleared user pause');
    g.resumeGame(); assert(g.state==='playing','explicit resume');
  });
  test('system pause survives drawer close and needs explicit resume', () => {
    const g=resetAudit();g.openBuildDetailModal();window.dispatchEvent(new Event('blur'));g.closeBuildDetailModal();
    assert(g.state==='paused' && g.pauseReasons.has('system_blur'),'lost system cause');
    window.dispatchEvent(new Event('focus'));assert(g.state==='paused','focus must not auto resume');
    g.resumeGame();assert(g.state==='playing','explicit resume failed');
  });
  test('explicit resume cannot dismiss open drawer', () => {
    const g=resetAudit();g.openBuildDetailModal();g.resumeGame();
    assert(g.state==='paused' && g.pauseReasons.has('build_detail'),'drawer cause cleared');
    g.closeBuildDetailModal();assert(g.state==='playing','drawer not released');
  });
  test('hidden document rejects every resume path', () => {
    const desc=Object.getOwnPropertyDescriptor(document,'hidden');
    try {
      const g=resetAudit();g.openBuildDetailModal();
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      document.dispatchEvent(new Event('visibilitychange'));g.closeBuildDetailModal();g.resumeGame();g.togglePause();
      assert(g.state==='paused' && g.pauseReasons.has('system_blur'),'hidden game resumed');
    } finally { if(desc)Object.defineProperty(document,'hidden',desc);else delete document.hidden; }
  });
  test('upgrade queue preserves system pause', () => {
    const g=resetAudit();g.player.pendingUpgrades=2;g.openUpgradeModal();window.dispatchEvent(new Event('blur'));
    document.querySelector('.upgrade-card').click();assert(g.state==='upgrade' && g.player.pendingUpgrades===1,'queue lost');
    document.querySelector('.upgrade-card').click();assert(g.state==='paused' && g.pauseReasons.has('system_blur'),'last card resumed background game');
    g.resumeGame();assert(g.state==='playing' && g.pauseReasons.size===0,'explicit resume after upgrade');
  });
  test('consumed card cannot apply again', () => {
    const g=resetAudit();g.player.pendingUpgrades=2;g.openUpgradeModal();const card=document.querySelector('.upgrade-card');
    card.click();const levels=JSON.stringify([g.weapons,g.passives],(key,val)=>key==='damageDealt'?undefined:val);
    card.click();assert(g.player.pendingUpgrades===1 && JSON.stringify([g.weapons,g.passives],(key,val)=>key==='damageDealt'?undefined:val)===levels,'stale card consumed next choice');
  });
  test('restart clears pause, input and camera', () => {
    const g=resetAudit();g.openBuildDetailModal();g.pauseForSystem();g.input.keys.right=true;g.input.updateKeyboardVector();g.camera.x=200;
    g.restart();assert(g.state==='playing' && g.pauseReasons.size===0 && g.input.vector.magnitude===0 && g.camera.x===0,'restart residue');
  });
  test('pause protection uses living game time and cannot be extended by spam', () => {
    const g=resetAudit();g.weapons={};g.spawnTimer=999;g.eliteTimer=999;g.bossTime=999;
    g.openPauseModal();g.resumeGame();const first=g.player.invulnerableTimer;
    g.update(.1);const remaining=g.player.invulnerableTimer;
    for(let i=0;i<20;i++){g.openPauseModal();g.resumeGame();}
    assert(near(g.player.invulnerableTimer,remaining),'spam extended protection');
    for(let i=0;i<312;i++)g.update(1/60);
    assert(!g.player.isDead && g.player.invulnerableTimer<=0,'must be alive with old grace expired');
    g.openPauseModal();g.resumeGame();assert(near(g.player.invulnerableTimer,first) && g.lastPauseGraceTime>=5,'fresh protection missing');
  });
  for (const evolved of [false,true]) for (const haste of [0,.4]) {
    test(`continuous satellite contact fps, evolved=${evolved}, CDR=${haste}`, () => {
      const damages=[];
      for(const fps of [10,30,60,120,144]) {
        const g=resetAudit();g.player.critChance=0;g.player.cooldownReduction=haste;
        const w=new OrbitalSatellites();w.level=5;if(evolved)w.evolve();const e=dummy(0,0,200);
        for(let i=0;i<60*fps;i++)w.update(1/fps,g.player,[e],quietPool());damages.push(w.damageDealt);
      }
      assert((Math.max(...damages)-Math.min(...damages))/Math.max(...damages)<=.02,JSON.stringify(damages));
    });
  }
  test('satellite reentry does not bank damage during absence', () => {
    const g=resetAudit();g.player.critChance=0;const w=new OrbitalSatellites();w.level=5;
    const e=dummy(0,0,200);w.update(.1,g.player,[e],quietPool());e.x=5000;
    for(let i=0;i<100;i++)w.update(.1,g.player,[e],quietPool());
    const before=w.damageDealt;e.x=0;w.update(.1,g.player,[e],quietPool());
    assert(w.damageDealt-before===30,'reentry burst');
    w.update(.1,g.player,[e],quietPool());assert(w.damageDealt-before===30,'negative debt retained');
    w.update(.1,g.player,[],quietPool());assert(w.hitCooldowns.size===0,'removed target retained');
  });
  for (const mobile of [false,true]) test('shockwave saturation priority mobile=' + mobile, () => {
    const g=resetAudit();g.isMobileDevice=mobile;g.camera.width=1000;const cap=mobile?20:35;
    for(let i=0;i<1000;i++)g.spawnShockwave(i,0,50,'white');assert(g.shockwaves.length===cap,'ordinary cap');
    g.spawnShockwave(2000,0,50,'red',true);g.spawnShockwave(3000,0,50,'white');
    assert(g.shockwaves.some(s=>s.x===2000),'ordinary evicted important event');
    g.shockwaves=[];for(let i=0;i<cap;i++)g.spawnShockwave(i,0,50,'red',true);
    g.spawnShockwave(4000,0,50,'white');assert(g.shockwaves.every(s=>s.priority) && g.shockwaves[0].x===0,'low priority admitted into protected pool');
    g.spawnShockwave(5000,0,50,'red',true);assert(g.shockwaves.length===cap && g.shockwaves[0].x===1,'high priority FIFO');
  });
  return rows;
};

window.measureControls = () => {
  const g=resetAudit();const rows=[];
  const hide=()=>document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('active'));
  function measure(scope) {
    for(const el of document.querySelectorAll(scope)) {
      el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      const r=el.getBoundingClientRect();
      // Center and edge midpoints avoid falsely failing rounded transparent corners.
      const points=[[r.x+r.width/2,r.y+r.height/2],[r.x+3,r.y+r.height/2],[r.right-3,r.y+r.height/2]];
      rows.push({id:el.id || el.dataset.diff || el.className,width:r.width,height:r.height,
        hittable:points.every(([x,y])=>{const hit=document.elementFromPoint(x,y);return hit===el || el.contains(hit);})});
    }
  }
  hide();measure('#btn-pause,#btn-mute,#btn-toggle-build');
  for(const id of ['modal-start','modal-pause','modal-gameover','modal-build-detail']) {
    hide();document.getElementById(id).classList.add('active');
    if(id==='modal-build-detail')g.renderBuildDetailContent();
    measure('#'+id+' button');
  }
  hide();g.player.pendingUpgrades=1;g.openUpgradeModal();measure('.upgrade-card');hide();
  return rows;
};

window.checkSustainedAudio = async () => {
  const sound=auditSaved.sound, ctx=sound.ctx;await ctx.resume();sound.isMuted=false;sound.setGameState('playing');
  await sound.ready;
  const original=ctx.createBufferSource;let created=0,active=0,peak=0,disconnected=0;
  ctx.createBufferSource=function() {
    const node=original.call(this);created++;active++;peak=Math.max(peak,active);
    node.addEventListener('ended',()=>active--);
    const disconnect=node.disconnect.bind(node);node.disconnect=(...args)=>{disconnected++;return disconnect(...args);};
    return node;
  };
  try {
    const started=performance.now();let batches=0;
    while(performance.now()-started<60000){for(let j=0;j<100;j++)sound.playHit(batches%2===0);batches++;await new Promise(r=>setTimeout(r,5));}
    await new Promise(r=>setTimeout(r,1200));return {seconds:(performance.now()-started)/1000,batches,created,active,peak,disconnected};
  } finally {ctx.createBufferSource=original;sound.isMuted=true;}
};
