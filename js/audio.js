/**
 * 《霓虹遗迹 Neon Relic》- Web Audio API 程序化音效引擎
 * 零外部音频资源依赖，纯算法合成科幻光效声与打击感
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.hasUnlocked = false;
    this.lastSoundTimes = {
      hit: 0,
      gem: 0,
      slash: 0,
      explosion: 0
    };
    this.initAudioContext();
  }

  initAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
    }
  }

  // 移动端首次用户交互解锁音频
  unlock() {
    if (this.hasUnlocked || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.hasUnlocked = true;
      });
    } else {
      this.hasUnlocked = true;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // 1. 脉冲刃/光刃挥击
  playSlash() {
    if (this.isMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // 2. 远程射击/激光弹
  playShoot(type = 'plasma') {
    if (this.isMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'laser') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // 3. 电弧跃迁声
  playArc() {
    if (this.isMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.linearRampToValueAtTime(300, now + 0.05);
    osc.frequency.linearRampToValueAtTime(800, now + 0.1);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // 4. 击中敌人反馈 (加入高频限流，防止多怪同屏引发音频节点爆炸)
  playHit(isCrit = false) {
    if (this.isMuted || !this.ctx) return;
    const tNow = performance.now();
    if (!isCrit && tNow - this.lastSoundTimes.hit < 35) return;
    this.lastSoundTimes.hit = tNow;

    this.unlock();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isCrit ? 'square' : 'triangle';
    const startFreq = isCrit ? 520 : 340;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);

    const startGain = isCrit ? 0.28 : 0.12;
    gain.gain.setValueAtTime(startGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // 5. 敌人爆炸声 (程序化白噪音 + 降频滤波，加入限流)
  playExplosion(isLarge = false) {
    if (this.isMuted || !this.ctx) return;
    const tNow = performance.now();
    if (!isLarge && tNow - this.lastSoundTimes.explosion < 45) return;
    this.lastSoundTimes.explosion = tNow;

    this.unlock();
    const now = this.ctx.currentTime;
    const duration = isLarge ? 0.35 : 0.2;

    // 白噪缓冲
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isLarge ? 400 : 800, now);
    filter.frequency.linearRampToValueAtTime(60, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isLarge ? 0.35 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // 6. 经验晶体拾取叮咚声 (加入微小限流)
  playGem(val = 1) {
    if (this.isMuted || !this.ctx) return;
    const tNow = performance.now();
    if (tNow - this.lastSoundTimes.gem < 28) return;
    this.lastSoundTimes.gem = tNow;

    this.unlock();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = val > 20 ? 1046.5 : val > 4 ? 880 : 659.25; // E5 / A5 / C6
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.06);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // 7. 升级大调和弦声
  playLevelUp() {
    if (this.isMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const startTime = now + index * 0.06;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  // 8. 武器终极进化
  playEvolution() {
    if (this.isMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const chords = [440, 554.37, 659.25, 880, 1108.73];
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.7);

      gain.gain.setValueAtTime(0.01, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + 0.85);
    });
  }

  // 9. 玩家受伤
  playHurt() {
    if (this.isMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // 10. Boss 警告音
  playBossAlert() {
    if (this.isMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const st = now + i * 0.35;
      osc.frequency.setValueAtTime(300, st);
      osc.frequency.exponentialRampToValueAtTime(150, st + 0.28);

      gain.gain.setValueAtTime(0.35, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(st);
      osc.stop(st + 0.32);
    }
  }
}

window.soundSystem = new SoundSystem();
