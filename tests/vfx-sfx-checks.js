window.vfxSfxChecks = async () => {
  const rows = [];
  const check = (passed, name, detail) => rows.push({ passed: !!passed, name, detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 13.1 VFX Level Scaling: Lv1 < Lv2 < Lv3 < Lv4 < Lv5 < Evolution
  for (const id of Object.keys(WeaponRegistry)) {
    const profiles = [];
    for (let lvl = 1; lvl <= 5; lvl++) {
      profiles.push(window.getWeaponVfxProfile(id, lvl, false));
    }
    const evoProfile = window.getWeaponVfxProfile(id, 5, true);

    let intensityGrowing = true;
    let particleGrowing = true;
    let glowGrowing = true;
    let impactGrowing = true;

    for (let i = 1; i < 5; i++) {
      if (profiles[i].intensity <= profiles[i - 1].intensity) intensityGrowing = false;
      if (profiles[i].particleCount <= profiles[i - 1].particleCount) particleGrowing = false;
      if (profiles[i].glow <= profiles[i - 1].glow) glowGrowing = false;
      if (profiles[i].impactScale < profiles[i - 1].impactScale) impactGrowing = false;
    }

    const evoQualitativeLeap = evoProfile.intensity > profiles[4].intensity &&
      evoProfile.particleCount > profiles[4].particleCount &&
      evoProfile.glow > profiles[4].glow &&
      evoProfile.tier === 6;

    check(intensityGrowing && particleGrowing && glowGrowing && impactGrowing && evoQualitativeLeap,
      `VFX level scaling and evolution leap: ${id}`,
      { profiles: profiles.map(p => ({ lvl: p.tier, intensity: p.intensity, particles: p.particleCount, glow: p.glow })), evo: { tier: evoProfile.tier, intensity: evoProfile.intensity } }
    );
  }

  // 13.2 Black Hole Pull: Distance reduction, inner > outer displacement, Boss immunity
  {
    const g = resetAudit();
    const w = new WeaponRegistry.black_hole();
    w.level = 5;
    w.timer = 999;
    const eInner = new EnemyTypes.SwarmDrone(30, 0);
    const eMid = new EnemyTypes.SwarmDrone(70, 0);
    const eOuter = new EnemyTypes.SwarmDrone(120, 0);
    eInner.hp = eInner.maxHp = 9999;
    eMid.hp = eMid.maxHp = 9999;
    eOuter.hp = eOuter.maxHp = 9999;
    const boss = new EnemyTypes.BossTitan(50, 0, 1, g.diffConfig);

    w.holes = [{
      x: 0,
      y: 0,
      radius: 140,
      pullStrength: 220,
      damage: 20,
      life: 3.0,
      maxLife: 3.0,
      rotation: 0,
      tickTimer: 0.2,
      isEvolved: false,
      level: 5,
      pulledEnemies: []
    }];

    const enemies = [eInner, eMid, eOuter, boss];
    for (let frame = 0; frame < 5; frame++) {
      w.update(1 / 60, g.player, enemies, quietPool());
    }

    const dispInner = 30 - eInner.x;
    const dispMid = 70 - eMid.x;
    const dispOuter = 120 - eOuter.x;

    check(dispInner > 0 && dispMid > 0 && dispOuter > 0,
      'black hole pull strictly decreases distance to singularity',
      { dispInner, dispMid, dispOuter }
    );
    check(dispInner > dispMid && dispMid > dispOuter,
      'inner ring pull displacement strictly greater than outer ring',
      { dispInner, dispMid, dispOuter }
    );
    check(boss.x === 50 && boss.vx === 0,
      'boss retains resistance against black hole pull displacement',
      { bossX: boss.x }
    );
  }

  // 13.3 Audio Lifecycle: Spawn -> Loop -> Expire / Supernova -> State Cleanups
  {
    const g = resetAudit();
    const s = auditSaved.sound;
    const p = g.player;
    window.soundSystem = s;
    s.isMuted = false;
    await s.ctx.resume();
    s.setGameState('playing');
    s.stopAll();
    s.lastSoundTimes = {};

    const hole = new BlackHoleGenerator();
    hole.level = 5;
    hole.evolve();

    // 1. Spawn sound
    s.playWeaponAttack('black_hole', true, { x: 0, y: 0 });
    const spawnVoice = [...s.voices].find(v => v.group === 'weapon:black_hole');
    check(spawnVoice && spawnVoice.node.buffer === s.buffers.get('gravity-open'),
      'black hole spawn triggers gravity-open sound'
    );

    // 2. Sustain loop
    hole.holes = [{ x: 0, y: 0, life: 2.0, maxLife: 2.0, radius: 100, isEvolved: true }];
    s.syncWeaponSustains({ black_hole: hole });
    const loopVoice = [...s.voices].find(v => v.group === 'sustain:black_hole');
    check(loopVoice && loopVoice.loop,
      'active black hole maintains looping sustain'
    );

    // 3. Pause suspends loop
    s.setGameState('paused');
    check(![...s.voices].some(v => v.group === 'sustain:black_hole' && !v.stopping),
      'pausing game halts black hole sustain'
    );

    // 4. Resume restores loop
    s.setGameState('playing');
    s.syncWeaponSustains({ black_hole: hole });
    check([...s.voices].some(v => v.group === 'sustain:black_hole'),
      'resuming game restores active black hole sustain'
    );

    // 5. Expiration releases loop
    hole.holes[0].life = 0;
    s.syncWeaponSustains({ black_hole: hole });
    await sleep(60);
    check(![...s.voices].some(v => v.group === 'sustain:black_hole' && !v.stopping),
      'expired black hole terminates sustain loop'
    );

    // 6. Supernova explosion sound
    hole.triggerSupernova(hole.holes[0], p, [], quietPool());
    check([...s.voices].some(v => v.group === 'explosion'),
      'supernova triggers explosion sound'
    );

    // 7. Mute clears all voices
    s.isMuted = true;
    check(s.voices.size === 0,
      'mute clears all voices without residue'
    );
    s.isMuted = false;
  }

  // 13.4 Stress Test: 6 Weapons Lv5 Evolved Simultaneous Firing & Rendering
  {
    const g = resetAudit();
    const s = auditSaved.sound;
    const p = g.player;
    window.soundSystem = s;
    s.isMuted = false;
    await s.ctx.resume();
    s.setGameState('playing');
    s.stopAll();
    s.lastSoundTimes = {};

    const weapons = {};
    for (const [id, Type] of Object.entries(WeaponRegistry)) {
      const w = new Type();
      w.level = 5;
      w.evolve();
      weapons[id] = w;
    }

    const enemies = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return new EnemyTypes.SwarmDrone(Math.cos(a) * 150, Math.sin(a) * 150);
    });

    let canvasErrors = 0;
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 400;
    testCanvas.height = 300;
    const tCtx = testCanvas.getContext('2d');

    for (let i = 0; i < 45; i++) {
      for (const w of Object.values(weapons)) {
        w.update(1 / 60, p, enemies, quietPool());
      }
      s.syncWeaponSustains(weapons);
      try {
        tCtx.clearRect(0, 0, 400, 300);
        for (const w of Object.values(weapons)) {
          w.render(tCtx, p);
        }
      } catch (err) {
        canvasErrors++;
      }
    }

    check(canvasErrors === 0, 'all 6 weapons render simultaneously without canvas errors');
    check(s.voices.size <= s.maxVoices, 'audio voices remain bounded under 6-weapon stress', s.voices.size);

    s.stopAll();
  }

  return rows;
};
