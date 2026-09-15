/* CC0 sampled sound effects and chiptune music. Sources: assets/CREDITS.md. */
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
    this.maxVoices = 20;
    this.music = new Audio('assets/audio/relic-run.mp3');
    this.music.loop = true;
    this.music.preload = 'none';
    this.music.volume = 0.13;
    this.musicPending = false;
    this.music.addEventListener('error', () => {
      if (!this.failed.includes('relic-run.mp3')) this.failed.push('relic-run.mp3');
    });
    this.initAudioContext();
    this.ready = this.loadSamples();
    document.addEventListener('visibilitychange', () => { if(document.hidden)this.music.pause(); });
    window.addEventListener('blur', () => this.music.pause());
  }
  initAudioContext() {
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    this.ctx=new AudioCtx();
    this.master=this.ctx.createGain();this.master.gain.value=.55;this.master.connect(this.ctx.destination);
  }
  async loadSamples() {
    if(!this.ctx)return;
    const names=['laser1','laser5','zap1','zap2','spaceTrash1','spaceTrash4','pepSound1','powerUp3','powerUp8','phaserDown1','lowDown','threeTone1'];
    await Promise.all(names.map(async name=>{
      try {
        const response=await fetch(`assets/audio/${name}.ogg`);
        if(!response.ok)throw Error('HTTP '+response.status);
        const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.buffers.set(name,buffer);
      } catch { this.failed.push(name); }
    }));
  }
  get isMuted() { return this._isMuted; }
  set isMuted(value) {
    this._isMuted=!!value;
    if(this.master)this.master.gain.value=this._isMuted?0:.55;
    this.syncMusic();
  }
  unlock() {
    if(!this.ctx)return;
    if(this.ctx.state==='running'){this.hasUnlocked=true;this.syncMusic();return;}
    this.ctx.resume().then(()=>{this.hasUnlocked=true;this.syncMusic();}).catch(()=>{});
  }
  toggleMute() { this.isMuted=!this.isMuted; if(!this.isMuted)this.unlock(); return this.isMuted; }
  setGameState(state) {
    if(this.gameState===state)return;
    this.gameState=state;
    if(state!=='playing') {
      for(const voice of this.voices)if(!voice.priority){try{voice.node.stop();}catch{}}
    }
    this.syncMusic();
  }
  syncMusic() {
    if(!this.music)return;
    const wanted=this.gameState==='playing' && this.hasUnlocked && !this.isMuted && !document.hidden;
    if(!wanted){this.music.pause();return;}
    if(!this.music.paused || this.musicPending || this.failed.includes('relic-run.mp3'))return;
    this.musicPending=true;
    this.music.play().catch(()=>{}).finally(()=>{
      this.musicPending=false;
      if(this.gameState!=='playing'||this.isMuted||document.hidden)this.music.pause();
    });
  }
  playSample(name, {volume=.35,rate=1,cooldown=45,group=name,priority=false}={}) {
    if(this.isMuted || !this.ctx || this.ctx.state!=='running')return;
    const buffer=this.buffers.get(name);if(!buffer)return;
    const now=performance.now();
    if(now-(this.lastSoundTimes[group]??-Infinity)<cooldown)return;
    if(group==='hit' && [...this.voices].filter(v=>v.group==='hit').length>=4)return;
    if(this.voices.size>=this.maxVoices) {
      if(!priority)return;
      const oldest=[...this.voices].find(v=>!v.priority);if(!oldest)return;
      oldest.node.stop();oldest.release();
    }
    this.lastSoundTimes[group]=now;
    const node=this.ctx.createBufferSource(),gain=this.ctx.createGain();
    node.buffer=buffer;node.playbackRate.value=rate;gain.gain.value=volume;
    node.connect(gain);gain.connect(this.master);
    const voice={node,gain,group,priority};this.voices.add(voice);
    voice.release=()=>{if(!this.voices.delete(voice))return;node.disconnect();gain.disconnect();};
    node.onended=voice.release;
    node.start();
  }
  playSlash() { this.playSample('laser1',{volume:.19,rate:1.35,group:'slash',cooldown:70}); }
  playShoot(type='plasma') { this.playSample(type==='laser'?'laser5':'laser1',{volume:.22,group:'shoot',cooldown:65}); }
  playArc() { this.playSample('zap1',{volume:.22,cooldown:75}); }
  playHit(isCrit=false) { this.playSample(isCrit?'zap2':'pepSound1',{volume:isCrit?.20:.12,rate:isCrit?1.3:1.6,cooldown:isCrit?25:35,group:'hit'}); }
  playExplosion(isLarge=false) { this.playSample(isLarge?'spaceTrash4':'spaceTrash1',{volume:isLarge?.32:.16,cooldown:isLarge?100:65,group:'explosion',priority:isLarge}); }
  playGem(value=1) { this.playSample('pepSound1',{volume:.12,rate:value>=25?1.8:1.35,group:'gem',cooldown:65}); }
  playLevelUp() { this.playSample('powerUp3',{volume:.4,cooldown:200,priority:true}); }
  playEvolution() { this.playSample('powerUp8',{volume:.45,cooldown:300,priority:true}); }
  playHurt() { this.playSample('phaserDown1',{volume:.35,cooldown:100,priority:true}); }
  playBossAlert() { this.playSample('threeTone1',{volume:.5,rate:.7,cooldown:500,priority:true}); }
  playResult(victory) { this.playSample(victory?'powerUp8':'lowDown',{volume:.4,cooldown:500,priority:true}); }
}
window.soundSystem=new SoundSystem();
