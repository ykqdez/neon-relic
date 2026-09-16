window.audioActionChecks = async () => {
  const rows=[],check=(passed,name,detail)=>rows.push({passed:!!passed,name,detail});
  const g=resetAudit(),s=auditSaved.sound,p=g.player;
  window.soundSystem=s;s.isMuted=false;await s.ctx.resume();s.setGameState('playing');
  const reset=()=>{s.stopAll();s.lastSoundTimes={};s.setGameState('playing');};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  try {
    reset();s.playWeaponAttack('black_hole');s.playHurt();
    const buffers=[...s.voices].map(v=>SOUND_SAMPLE_NAMES.find(n=>s.buffers.get(n)===v.node.buffer));
    check(buffers.includes('gravity-open')&&buffers.includes('player-hurt'),'gravity activation and player damage have distinct samples',buffers);
    reset();for(let i=0;i<100;i++)s.playGem(i%2?25:1);
    check(s.voices.size===1&&[...s.voices][0].node.buffer===s.buffers.get('crystal-pickup')&&s.buffers.get('crystal-pickup').duration<.09,'crystal bursts use one short cue, shorter than shared cooldown');
    reset();let rng=0;const random=Math.random;Math.random=()=>{rng++;return .5;};
    const rates=[];
    try {for(let i=0;i<8;i++){s.lastSoundTimes['weapon:orbital_satellites']=-Infinity;s.playWeaponAttack('orbital_satellites');rates.push([...s.voices][0].node.playbackRate.value);s.stopAll();}}
    finally{Math.random=random;}
    check(rng===0&&new Set(rates).size>1&&rates.every(r=>r>=.97&&r<=1.03),'attack microvariation is bounded and does not use gameplay RNG',rates);
    const records=[],play=s.playSample;
    s.playSample=function(name,options){records.push({name,...options});return play.call(this,name,options);};
    try {
      reset();const w=new PlasmaCannon();w.level=1;w.fire(p,[],quietPool());w.timer=999;
      const before=records.filter(r=>r.group==='impact').length;
      w.update(.1,p,[dummy(36,0,5)],quietPool());
      check(records.filter(r=>r.group==='impact').length===before+1,'actual surviving plasma collision emits impact');
      w.update(.01,p,[],quietPool());check(records.filter(r=>r.group==='impact').length===before+1,'projectile flight alone emits no impact');
      const lethal=new PlasmaCannon();lethal.level=1;lethal.fire(p,[],quietPool());lethal.timer=999;
      const weak=dummy(36,0,5);weak.hp=1;lethal.update(.1,p,[weak],quietPool());
      check(records.filter(r=>r.group==='impact').length===before+1&&weak.isDead,'lethal impact uses death cue without redundant impact layer');
      for(const type of ['PrismSniper','BurstSentry','ChargeStriker']) {
        const enemy=new EnemyTypes[type](150,0),start=records.filter(r=>r.group==='enemy-warning').length;
        enemy.shootTimer=0;enemy.attackTimer=0;enemy.stateTimer=0;
        for(let i=0;i<20;i++)enemy.update(1/60,p,[enemy],[],g);
        check(records.filter(r=>r.group==='enemy-warning').length===start+1,'one warning on actual windup transition '+type);
      }
      const boss=new EnemyTypes.BossTitan(180,0),warnings=records.filter(r=>r.group==='enemy-warning').length;
      boss.phase=3;boss.executeAttack(p,[boss],[],g);
      check(boss.hazardZones.length===1&&records.filter(r=>r.group==='enemy-warning').length===warnings+1,'Boss ground hazard warns when its visible zone is created');
      const hp=p.hp;p.invulnerableTimer=0;p.takeDamage(5);const damageCues=records.filter(r=>r.group==='player-hurt').length;p.takeDamage(5);
      check(p.hp<hp&&records.filter(r=>r.group==='player-hurt').length===damageCues,'invulnerable rejected damage produces no extra hurt cue');
    } finally{s.playSample=play;}
    for(const evolved of [false,true]) {
      reset();const w=new PrismRay();w.level=5;if(evolved)w.evolve();w.fire(p,[dummy(100,0)],quietPool());w.timer=999;
      const weapons={prism_ray:w};s.syncWeaponSustains(weapons);
      const initial=[...s.voices].find(v=>v.group==='sustain:prism_ray');
      check(initial?.node.loop===true,'beam gets a real looping sustain evolved='+evolved);
      for(let i=0;i<24;i++){w.update(1/60,p,[],quietPool());s.syncWeaponSustains(weapons);}
      check([...s.voices].filter(v=>v.group==='sustain:prism_ray').length===1&&s.voices.has(initial),'three beams share one persistent sustain evolved='+evolved);
      for(let i=0;i<70;i++){w.update(1/60,p,[],quietPool());s.syncWeaponSustains(weapons);}
      await sleep(80);
      check(![...s.voices].some(v=>v.group==='sustain:prism_ray'),'beam ending releases sustain evolved='+evolved);
    }
    reset();const hole=new BlackHoleGenerator();hole.level=5;hole.fire(p,[],quietPool());hole.fire(p,[],quietPool());
    const weapons={black_hole:hole};s.syncWeaponSustains(weapons);
    check([...s.voices].filter(v=>v.group==='sustain:black_hole').length===1,'overlapping gravity wells share one sustain');
    for(const state of ['paused','upgrade','gameover','ready']) {
      s.setGameState(state);s.playHurt();s.playGem();s.playWeaponAttack('plasma_cannon');s.syncWeaponSustains(weapons);
      check(s.voices.size===0,'state blocks combat and stops tails: '+state);
      s.setGameState('playing');s.lastSoundTimes={};s.syncWeaponSustains(weapons);
      check([...s.voices].some(v=>v.group==='sustain:black_hole'),'resume recreates only active sustain after '+state);
    }
    s.isMuted=true;check(s.voices.size===0,'mute removes stale loops');s.isMuted=false;
    hole.holes=[];s.syncWeaponSustains(weapons);check(!s.voices.size,'unmute does not resurrect expired effects');
    reset();s.playImpact({x:p.x+80,y:p.y});const near=[...s.voices][0];
    s.lastSoundTimes.impact=-Infinity;s.playImpact({x:p.x-500,y:p.y});const far=[...s.voices][1];
    check(near.volume>far.volume&&near.pan.pan.value>0&&far.pan.pan.value<0,'impact attenuation and panning follow world position',{near:near.volume,far:far.volume});
    const count=s.voices.size;s.lastSoundTimes.impact=-Infinity;s.playImpact({x:p.x+1000,y:p.y});check(s.voices.size===count,'distant impact is culled');
    reset();s.playEnemyCue('sniper',{x:10000,y:0});check(s.voices.size===0,'offscreen enemy warning is silent');
    s.playExplosion(true);check(s.combatMixTarget===1&&![...s.voices].some(v=>v.priority),'player supernova no longer ducks combat as a danger alert');
    s.playEnemyCue('sniper',{x:p.x+50,y:p.y});check(s.combatMixTarget<=.35,'enemy danger gets audible mix priority');
    reset();s.setGameState('gameover');s.playResult(true);check([...s.voices].some(v=>v.group==='result'),'victory cue allowed in results state');
    s.setGameState('playing');check(s.voices.size===0,'restart clears result tail');
    // Under saturation the two sustain beds must not steal each other every frame.
    reset();for(let i=0;i<7;i++)s.playSample('prism-loop',{loop:true,duration:2,group:'weapon:fixture'+i,importance:50,cooldown:0});
    const beam=new PrismRay();beam.level=5;beam.beams=[{life:1}];hole.holes=[{x:0,y:0,life:2}];
    s.syncWeaponSustains({prism_ray:beam,black_hole:hole});const stable=[...s.voices].find(v=>v.group.startsWith('sustain:'));
    for(let i=0;i<100;i++)s.syncWeaponSustains({prism_ray:beam,black_hole:hole});
    check(s.voices.size===8&&s.voices.has(stable),'saturated sustains remain virtual instead of repeatedly stealing peers');
    for(const name of ['prism-loop','gravity-loop']) {
      const data=s.buffers.get(name).getChannelData(0);
      const join=Math.abs(data[0]-data[data.length-1]);
      check(join<.08,'periodic sustain has bounded wrap discontinuity '+name,{join});
    }
    // Real-time active beam must still produce signal after the old one-shot had ended.
    reset();const analyser=s.ctx.createAnalyser();analyser.fftSize=4096;s.master.connect(analyser);
    const beamLong=new PrismRay();beamLong.level=5;beamLong.evolve();beamLong.fire(p,[],quietPool());beamLong.timer=999;
    const started=performance.now();let previous=started,tailPeak=0;
    const wave=new Float32Array(analyser.fftSize);
    try{
      while(performance.now()-started<1150){
        await sleep(16);const now=performance.now(),dt=(now-previous)/1000;previous=now;
        beamLong.update(dt,p,[],quietPool());s.syncWeaponSustains({prism_ray:beamLong});
        if(now-started>650&&now-started<950){analyser.getFloatTimeDomainData(wave);for(const x of wave)tailPeak=Math.max(tailPeak,Math.abs(x));}
      }
      check(tailPeak>.001&&![...s.voices].some(v=>v.loop),'evolved beam audible at 0.65–0.95s and silent after ending',{tailPeak});
    }finally{s.master.disconnect(analyser);analyser.disconnect();}
    reset();const mixed=Object.fromEntries(Object.entries(WeaponRegistry).map(([id,Type])=>{const w=new Type();w.level=5;w.evolve();return [id,w];}));
    const targets=Array.from({length:24},(_,i)=>dummy(60+(i%6)*30,(Math.floor(i/6)-1.5)*30,13));
    const meter=s.ctx.createAnalyser();meter.fftSize=4096;s.master.connect(meter);
    const data=new Float32Array(meter.fftSize);let peak=0,maxVoices=0,maxSustains=0;
    const start=performance.now();let prior=start,warning=false,hurt=false;
    try {
      while(performance.now()-start<2200){
        await sleep(16);const now=performance.now(),dt=(now-prior)/1000;prior=now;
        for(const w of Object.values(mixed))w.update(dt,p,targets,quietPool());s.syncWeaponSustains(mixed);
        if(!warning&&now-start>500){warning=true;s.playEnemyCue('sniper',{x:80,y:0});}
        if(!hurt&&now-start>1000){hurt=true;s.playHurt();}
        meter.getFloatTimeDomainData(data);for(const x of data)peak=Math.max(peak,Math.abs(x));
        maxVoices=Math.max(maxVoices,s.voices.size);maxSustains=Math.max(maxSustains,[...s.voices].filter(v=>v.loop).length);
      }
      check(peak>0&&peak<.9&&maxVoices<=20&&maxSustains<=2,'real six-weapon onsets, sustains and danger cues retain headroom',{peak,maxVoices,maxSustains});
    }finally{s.master.disconnect(meter);meter.disconnect();}
  }finally{s.stopAll();s.isMuted=true;window.soundSystem=null;}
  return rows;
};
