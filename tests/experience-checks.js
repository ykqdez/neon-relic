window.experienceChecks = async () => {
  const rows=[],check=(passed,name,detail)=>rows.push({passed:!!passed,name,detail});
  const sound=auditSaved.sound,g=resetAudit();window.soundSystem=sound;
  const sample=sound.playSample;
  try {
    sound.isMuted=false;sound.hasUnlocked=true;await sound.ctx.resume();sound.setGameState('playing');
    await new Promise(r=>setTimeout(r,200));
    sound.playHurt();
    let calls=0,pauses=0;const pauseListener=()=>pauses++;
    sound.music.addEventListener('pause',pauseListener);
    sound.playSample=function(...args){calls++;return sample.apply(this,args);};
    const musicTime=sound.music.currentTime;
    g.player.addExp(g.player.nextLevelExp,()=>g.openUpgradeModal());
    check(g.state==='upgrade'&&calls===0&&sound.voices.size===0,'actual level-up is silent and clears combat tails');
    // Exercise chained choices, including evolution, without interrupting the music.
    g.player.pendingUpgrades=2;g.weapons.pulse_blade.level=5;
    g.selectUpgrade({type:'evolution',targetId:'pulse_blade'});
    check(g.state==='upgrade'&&calls===0,'evolution choice and next upgrade are silent');
    await new Promise(r=>setTimeout(r,200));
    check(!sound.music.paused&&sound.music.currentTime>musicTime&&pauses===0,'BGM continues through chained upgrades without pause/restart');
    g.pauseForSystem();check(sound.music.paused,'system blur during upgrade still pauses BGM');
    sound.isMuted=true;sound.isMuted=false;check(sound.music.paused,'unmute cannot bypass system pause during upgrade');
    g.selectUpgrade({type:'passive',targetId:'armor'});
    check(g.state==='paused'&&sound.music.paused,'finishing upgrade preserves system pause');
    sound.music.removeEventListener('pause',pauseListener);sound.playSample=sample;
    g.resumeGame();
    for(const v of [...sound.voices]){v.node.stop();v.release();}
    // Saturate low-value effects, then check that weapons and critical cues get real voices.
    for(let i=0;i<30;i++)sound.playSample('zap1',{group:'noise-'+i,cooldown:0});
    check(sound.voices.size<=12,'combat bus has a shared 12-voice limit');
    sound.lastSoundTimes['weapon:arc_core']=-Infinity;sound.playWeaponAttack('arc_core');
    check([...sound.voices].some(v=>v.group==='weapon:arc_core'&&v.node.buffer===sound.buffers.get('lightning-crack')),'lightning attack replaces low-priority noise with the thunder sample');
    const beforeDuck=sound.combatMixTarget;sound.lastSoundTimes.threeTone1=-Infinity;sound.playBossAlert();
    check([...sound.voices].some(v=>v.priority)&&sound.combatMixTarget<beforeDuck,'Boss warning ducks combat audio');
    const critical=[...sound.voices].filter(v=>v.priority);
    for(let i=0;i<40;i++)sound.playSample('zap1',{group:'noise-'+i,cooldown:0});
    check(critical.every(v=>sound.voices.has(v)),'low-priority burst cannot steal a critical cue');
    check(sound.compressor.ratio.value>1&&sound.compressor.threshold.value<0,'mixed SFX route through dynamic compression');
    for(const v of [...sound.voices]){v.node.stop();v.release();}
    check(sound.combatMixTarget===1,'combat gain recovers when cues finish');
    const analyser=sound.ctx.createAnalyser();analyser.fftSize=8192;sound.master.connect(analyser);
    const wave=new Float32Array(analyser.fftSize);let peak=0;
    try {
      for(const id of Object.keys(WeaponRegistry)){sound.lastSoundTimes['weapon:'+id]=-Infinity;sound.playWeaponAttack(id,true);}
      sound.lastSoundTimes.phaserDown1=-Infinity;sound.playHurt();
      for(let i=0;i<45;i++){
        await new Promise(r=>setTimeout(r,20));analyser.getFloatTimeDomainData(wave);
        for(const value of wave)peak=Math.max(peak,Math.abs(value));
      }
      check(Number.isFinite(peak)&&peak>0&&peak<.9,'six-weapon mixed output has headroom in measured burst',{peak});
    } finally {sound.master.disconnect(analyser);analyser.disconnect();}
    for(const v of [...sound.voices]){v.node.stop();v.release();}
    // Track the trajectory at different times; damage remains an instant hit as before.
    window.soundSystem=null;
    const blade=new WeaponRegistry.pulse_blade(),p=new Player(30,20),e=dummy(130,70);
    blade.level=1;blade.fire(p,[e],quietPool());blade.timer=999;
    const slash=blade.slashes[0],damage=blade.damageDealt;
    const start=PixelArt.bladePoint(slash,0),mid=PixelArt.bladePoint(slash,.5),end=PixelArt.bladePoint(slash,1);
    check(start.x===30&&start.y===20&&end.x===130&&end.y===70&&mid.x>30&&mid.x<130,'blade trajectory connects caster to target');
    p.x=300;p.y=300;
    blade.update(.08,p,[e],quietPool());
    check(slash.fromX===30&&slash.fromY===20&&blade.damageDealt===damage,'moving player does not teleport trail or repeat damage');
    const canvas=document.createElement('canvas');canvas.width=200;canvas.height=120;const ctx=canvas.getContext('2d');
    const frames=[];
    for(const age of [0,.08,.17,.24]) {
      slash.life=slash.maxLife-age;ctx.clearRect(0,0,200,120);blade.render(ctx);
      frames.push(canvas.toDataURL());
    }
    check(new Set(frames).size===4,'blade head and trail advance across rendered frames');
    window.bladePreview=frames;
    blade.update(.3,p,[e],quietPool());check(blade.slashes.length===0,'blade trails expire');
  } finally {sound.playSample=sample;sound.isMuted=true;window.soundSystem=null;}
  return rows;
};
