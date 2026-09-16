/* Locally licensed samples and chiptune music. Sources: assets/CREDITS.md. */
const WEAPON_ATTACK_SOUNDS = Object.freeze({
  pulse_blade: {sample:'blade-swish',volume:.19,rate:1,cooldown:90},
  arc_core: {sample:'lightning-crack',volume:.28,rate:1.1,cooldown:120},
  orbital_satellites: {sample:'orbital-contact',volume:.11,rate:1,cooldown:230},
  plasma_cannon: {sample:'plasma-shot',volume:.25,rate:1,cooldown:100},
  black_hole: {sample:'phaserDown1',volume:.22,rate:.65,cooldown:400},
  prism_ray: {sample:'prism-beam',volume:.17,rate:1,cooldown:220}
});
const SOUND_SAMPLE_NAMES=Object.freeze(['laser1','laser5','zap1','zap2','spaceTrash1','spaceTrash4','pepSound1','powerUp3','powerUp8','phaserDown1','lowDown','threeTone1','lightning-crack','plasma-shot','enemy-shatter','orbital-contact','blade-swish','prism-beam']);
class SoundSystem {
  constructor() {
    this.ctx = null;
    this._isMuted = false;
    this.hasUnlocked = false;
    this.gameState = 'ready';
    this.lastSoundTimes = {};
    this.buffers = new Map();
    this.voices = new Set();
    this.failed = [];
    this.loadErrors = {};
    this.lastLoadAttempt = -Infinity;
    this.maxVoices = 20;
    this.music = new Audio('assets/audio/relic-run.mp3');
    this.music.loop = true;
    this.music.preload = 'none';
    this.music.volume = 1;
    this.musicPending = false;
    this.music.addEventListener('error', () => {
      if (!this.failed.includes('relic-run.mp3')) this.failed.push('relic-run.mp3');
    });
    this.initAudioContext();
    this.ready = this.loadSamples();
    // Remain installed: iOS may interrupt the context again after switching apps.
    for(const type of ['pointerdown','touchend','click','keydown']) {
      document.addEventListener(type,event=>{if(event.isTrusted)this.unlock();},{capture:true,passive:true});
    }
    document.addEventListener('visibilitychange', () => { if(document.hidden)this.music.pause(); });
    window.addEventListener('blur', () => this.music.pause());
  }
  initAudioContext() {
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    this.ctx=new AudioCtx({latencyHint:'interactive'});
    this.master=this.ctx.createGain();this.master.gain.value=.55;
    this.combatBus=this.ctx.createGain();this.criticalBus=this.ctx.createGain();
    this.compressor=this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value=-18;this.compressor.knee.value=12;this.compressor.ratio.value=4;
    this.compressor.attack.value=.003;this.compressor.release.value=.12;
    this.combatBus.connect(this.compressor);this.criticalBus.connect(this.compressor);
    this.compressor.connect(this.master);this.master.connect(this.ctx.destination);
    // iOS can ignore HTMLMediaElement.volume. A Web Audio gain controls BGM on the same output session.
    this.musicSource=this.ctx.createMediaElementSource(this.music);
    this.musicGain=this.ctx.createGain();this.musicGain.gain.value=.04;
    this.musicSource.connect(this.musicGain);this.musicGain.connect(this.ctx.destination);
    this.ctx.addEventListener('statechange',()=>{if(this.ctx.state==='running'&&this.hasUnlocked)this.syncMusic();});
  }
  async loadSamples() {
    if(!this.ctx)return;
    if(this.loadingSamples)return this.loadingSamples;
    this.lastLoadAttempt=performance.now();
    this.loadingSamples=Promise.all(SOUND_SAMPLE_NAMES.filter(name=>!this.buffers.has(name)).map(async name=>{
      try {
        const response=await fetch(`assets/audio/${name}.wav`);
        if(!response.ok)throw Error('HTTP '+response.status);
        const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.buffers.set(name,buffer);
        this.failed=this.failed.filter(item=>item!==name);delete this.loadErrors[name];
      } catch(error) {if(!this.failed.includes(name))this.failed.push(name);this.loadErrors[name]=String(error);}
    })).finally(()=>{this.loadingSamples=null;});
    return this.loadingSamples;
  }
  get isMuted() { return this._isMuted; }
  set isMuted(value) {
    this._isMuted=!!value;
    if(this.master)this.master.gain.value=this._isMuted?0:.55;
    if(this.musicGain)this.musicGain.gain.value=this._isMuted?0:.04;
    this.syncMusic();
  }
  unlock() {
    if(!this.ctx||this.isMuted||document.hidden)return;
    // Feature-detected; unsupported browsers keep their default session behavior.
    try {if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
    if(this.failed.some(name=>SOUND_SAMPLE_NAMES.includes(name))&&performance.now()-this.lastLoadAttempt>5000)this.ready=this.loadSamples();
    const firstUnlock=!this.hasUnlocked;
    this.hasUnlocked=true;
    if(firstUnlock||this.ctx.state!=='running'){
      // Submit the silent primer and resume while still inside the trusted gesture.
      const primer=this.ctx.createBufferSource();primer.buffer=this.ctx.createBuffer(1,1,this.ctx.sampleRate);
      primer.connect(this.master);primer.onended=()=>primer.disconnect();primer.start();
      this.ctx.resume().then(()=>this.syncMusic()).catch(error=>{this.lastUnlockError=String(error);});
    }
    this.syncMusic();
  }
  toggleMute() { this.isMuted=!this.isMuted; if(!this.isMuted)this.unlock(); return this.isMuted; }
  setGameState(state) {
    if(this.gameState===state)return;
    this.gameState=state;
    if(state!=='playing') {
      for(const voice of [...this.voices])if(state==='upgrade'||!voice.priority){voice.node.stop();voice.release();}
    }
    this.syncMusic();
  }
  musicWanted() {
    const blocked=[...(window.game?.pauseReasons||[])].some(reason=>reason!=='upgrade');
    return ['playing','upgrade'].includes(this.gameState) && this.hasUnlocked && !this.isMuted && !document.hidden && !blocked;
  }
  syncMusic() {
    if(!this.music)return;
    const wanted=this.musicWanted();
    if(!wanted){this.music.pause();return;}
    if(!this.music.paused || this.musicPending || this.failed.includes('relic-run.mp3'))return;
    this.musicPending=true;
    this.music.play().catch(()=>{}).finally(()=>{
      this.musicPending=false;
      if(!this.musicWanted())this.music.pause();
    });
  }
  updateMix() {
    if(!this.ctx)return;
    const voices=[...this.voices],combat=voices.filter(v=>!v.priority).length;
    // Keep simultaneous attacks readable; critical cues duck the combat bus, with a smooth recovery.
    const target=(voices.some(v=>v.priority)?.35:1)/Math.sqrt(Math.max(1,combat/3));
    this.combatMixTarget=target;
    this.combatBus.gain.setTargetAtTime(target,this.ctx.currentTime,target<this.combatBus.gain.value?.015:.15);
  }
  playSample(name, {volume=.35,rate=1,cooldown=45,group=name,priority=false,importance=priority?100:10}={}) {
    if(this.isMuted || this.gameState==='upgrade' || !this.ctx || this.ctx.state!=='running')return;
    const buffer=this.buffers.get(name);if(!buffer)return;
    const now=performance.now();
    if(now-(this.lastSoundTimes[group]??-Infinity)<cooldown)return;
    if(group==='hit' && [...this.voices].filter(v=>v.group==='hit').length>=4)return;
    if(group.startsWith('weapon:') && [...this.voices].filter(v=>v.group===group).length>=2)return;
    const voices=[...this.voices],weapons=voices.filter(v=>v.group.startsWith('weapon:'));
    const bus=voices.filter(v=>v.priority===priority);
    let candidates=null;
    if(group.startsWith('weapon:')&&weapons.length>=8)candidates=weapons;
    else if(bus.length>=(priority?4:12))candidates=bus;
    else if(voices.length>=this.maxVoices)candidates=voices;
    if(candidates){
      const victim=candidates.filter(v=>v.importance<=importance).sort((a,b)=>a.importance-b.importance)[0];
      if(!victim)return;victim.node.stop();victim.release();
    }
    this.lastSoundTimes[group]=now;
    const node=this.ctx.createBufferSource(),gain=this.ctx.createGain();
    node.buffer=buffer;node.playbackRate.value=rate;
    const duration=buffer.duration/rate,nowAudio=this.ctx.currentTime;
    gain.gain.setValueAtTime(0,nowAudio);gain.gain.linearRampToValueAtTime(volume,nowAudio+.004);
    gain.gain.setValueAtTime(volume,nowAudio+Math.max(.004,duration-.03));gain.gain.linearRampToValueAtTime(0,nowAudio+duration);
    node.connect(gain);gain.connect(priority?this.criticalBus:this.combatBus);
    const voice={node,gain,group,priority,importance};this.voices.add(voice);
    voice.release=()=>{if(!this.voices.delete(voice))return;node.disconnect();gain.disconnect();this.updateMix();};
    node.onended=voice.release;
    this.updateMix();
    node.start();
  }
  playWeaponAttack(id, evolved=false) {
    const profile=WEAPON_ATTACK_SOUNDS[id];if(!profile)return;
    // One sound per attack/contact, not per projectile or damage tick. Each weapon has its own gate.
    this.playSample(profile.sample,{volume:profile.volume,rate:profile.rate*(evolved?.85:1),
      cooldown:profile.cooldown,group:'weapon:'+id,importance:evolved?55:50});
  }
  playHit(isCrit=false) { this.playSample(isCrit?'zap2':'pepSound1',{volume:isCrit?.20:.12,rate:isCrit?1.3:1.6,cooldown:isCrit?25:35,group:'hit'}); }
  playExplosion(isLarge=false) { this.playSample(isLarge?'spaceTrash4':'spaceTrash1',{volume:isLarge?.32:.16,cooldown:isLarge?100:65,group:'explosion',priority:isLarge,importance:isLarge?70:25}); }
  playEnemyDeath(elite=false,boss=false) {
    this.playSample('enemy-shatter',{volume:boss?.28:elite?.18:.11,rate:boss?.65:elite?.85:1.12,
      cooldown:boss?250:90,group:boss?'boss-death':'enemy-death',priority:boss,importance:boss?90:20});
  }
  playGem(value=1) { this.playSample('pepSound1',{volume:.12,rate:value>=25?1.8:1.35,group:'gem',cooldown:65,importance:5}); }
  playHurt() { this.playSample('phaserDown1',{volume:.35,cooldown:100,priority:true}); }
  playBossAlert() { this.playSample('threeTone1',{volume:.5,rate:.7,cooldown:500,priority:true,importance:110}); }
  playResult(victory) { this.playSample(victory?'powerUp8':'lowDown',{volume:.4,cooldown:500,priority:true,importance:120}); }
}
window.soundSystem=new SoundSystem();
