/**
 * 《霓虹遗迹 Neon Relic》- 主游戏引擎
 * 渲染循环、响应式相机缩放、升级队列、多阶段 Boss 与生命周期管理
 */

const DIFFICULTY_PRESETS = {
  casual: {
    id: 'casual',
    name: '休闲 CASUAL',
    desc: '移动端专属调优：移速+自愈微流，死角视野拓宽，怪物解锁更平滑',
    playerBaseSpeed: 188,
    playerInvulDuration: 0.52,
    playerHpRegen: 0.45,
    playerPickupRange: 105,
    upgradeGracePeriod: 0.85,
    pauseGracePeriod: 0.50,
    spawnIntervalBase: 1.25,
    spawnIntervalMin: 0.24,
    hpScalePerMin: 0.20,
    maxEnemies: 120,
    unlockTimes: {
      drone: 0,
      scout: 0,
      golem: 90,
      fission: 150,
      sniper: 240,
      striker: 330
    },
    firstEliteTime: 145,
    eliteInterval: 100,
    eliteHpMult: 2.3,
    eliteShieldHp: 130,
    scoutSpeed: 135,
    sniperBulletSpeed: 210,
    sniperAimTime: 1.3,
    strikerDashSpeed: 310,
    strikerAimTime: 1.1,
    bossHp: 1900,
    bossBulletSpeedMult: 0.82,
    bossHazardTimer: 1.7
  },
  normal: {
    id: 'normal',
    name: '标准 NORMAL',
    desc: '经典 Roguelite 节奏：标准移速与刷怪曲线，适度压迫感',
    playerBaseSpeed: 175,
    playerInvulDuration: 0.40,
    playerHpRegen: 0.25,
    playerPickupRange: 80,
    upgradeGracePeriod: 0.60,
    pauseGracePeriod: 0.35,
    spawnIntervalBase: 1.10,
    spawnIntervalMin: 0.16,
    hpScalePerMin: 0.28,
    maxEnemies: 150,
    unlockTimes: {
      drone: 0,
      scout: 0,
      golem: 60,
      fission: 130,
      sniper: 220,
      striker: 300
    },
    firstEliteTime: 90,
    eliteInterval: 80,
    eliteHpMult: 3.2,
    eliteShieldHp: 240,
    scoutSpeed: 160,
    sniperBulletSpeed: 270,
    sniperAimTime: 1.0,
    strikerDashSpeed: 390,
    strikerAimTime: 0.8,
    bossHp: 2800,
    bossBulletSpeedMult: 1.0,
    bossHazardTimer: 1.2
  },
  hard: {
    id: 'hard',
    name: '极境 HARD',
    desc: '硬核狂暴挑战：怪物如潮涌现，高弹速冲锋与极短预警期',
    playerBaseSpeed: 170,
    playerInvulDuration: 0.32,
    playerHpRegen: 0.10,
    playerPickupRange: 75,
    upgradeGracePeriod: 0.40,
    pauseGracePeriod: 0.20,
    spawnIntervalBase: 0.95,
    spawnIntervalMin: 0.12,
    hpScalePerMin: 0.36,
    maxEnemies: 180,
    unlockTimes: {
      drone: 0,
      scout: 0,
      golem: 45,
      fission: 100,
      sniper: 180,
      striker: 240
    },
    firstEliteTime: 75,
    eliteInterval: 65,
    eliteHpMult: 3.8,
    eliteShieldHp: 320,
    scoutSpeed: 175,
    sniperBulletSpeed: 300,
    sniperAimTime: 0.8,
    strikerDashSpeed: 420,
    strikerAimTime: 0.65,
    bossHp: 3600,
    bossBulletSpeedMult: 1.15,
    bossHazardTimer: 0.95
  }
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('game-container');
    this.vignetteEl = document.getElementById('screen-vignette');

    // 难度预设选择（手机触控优先默认休闲模式）
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768;
    const savedDiff = localStorage.getItem('nr_difficulty');
    this.difficulty = (savedDiff && DIFFICULTY_PRESETS[savedDiff]) ? savedDiff : (isTouchDevice ? 'casual' : 'normal');
    this.diffConfig = DIFFICULTY_PRESETS[this.difficulty];

    // 随机种子生成器
    this.seed = this.generateSeed();
    this.initPrng(this.seed);

    // 状态机制: 'ready' (开始界面等待), 'playing', 'paused', 'upgrade', 'gameover'
    this.state = 'ready';
    this.elapsedTime = 0;
    this.lastTime = performance.now();
    this.stats = {
      kills: 0,
      totalDamage: 0,
      highestHit: 0,
      bossKills: 0
    };

    // 竞技场尺寸 (2600 x 2600)
    this.arenaBound = {
      halfWidth: 1300,
      halfHeight: 1300
    };

    // 预生成地图散落古代遗迹符文 (轻量地面装饰，不消耗FPS)
    this.arenaRunes = this.generateArenaRunes();

    // 玩家
    this.player = new Player(0, 0, this.diffConfig);

    // 输入管理器与摇杆元素
    const jContainer = document.getElementById('joystick-container');
    const jKnob = document.getElementById('joystick-knob');
    this.input = new InputManager(this.canvas, jContainer, jKnob);

    // 武器管理器
    this.weapons = {};
    for (const [id, Cls] of Object.entries(window.WeaponRegistry)) {
      this.weapons[id] = new Cls();
    }
    // 初始解锁脉冲刃
    this.weapons.pulse_blade.level = 1;

    // 被动能力集合
    this.passives = {};
    for (const key of Object.keys(new UpgradeSystem().passiveDefs)) {
      this.passives[key] = { level: 0 };
    }

    // 升级系统
    this.upgradeSystem = new UpgradeSystem();

    // 敌人与弹幕列表
    this.enemies = [];
    this.enemyBullets = [];
    this.activeBoss = null;

    // 对象池：经验晶体、粒子特效、浮动伤害数字
    this.crystals = [];
    this.particles = [];
    this.damageTexts = [];
    this.shockwaves = [];

    // 相机视口与动态响应式缩放
    this.camera = { x: 0, y: 0, width: 800, height: 600, zoom: 1.0 };

    // 刷怪计时器与节奏 (8 分钟 Boss 目标)
    this.spawnTimer = 0;
    this.eliteTimer = this.diffConfig.firstEliteTime;
    this.bossSpawned = false;
    this.bossTime = 480;  // 8 分钟 (480秒) 决战泰坦

    // 初始化画布缩放与视网膜高分屏
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 100));

    // 切后台自动暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') {
        this.openPauseModal();
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing') {
        this.openPauseModal();
      }
    });

    // 初始化 UI 监听
    this.initUI();

    // 加载并呈现历史战绩到开始界面
    this.updateStartScreenRecords();

    // 更新底部装备栏
    this.updateHUDBuild();

    // 启动游戏循环
    requestAnimationFrame((t) => this.loop(t));
  }

  generateSeed() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  }

  initPrng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    this.prng = () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  generateArenaRunes() {
    const runes = [];
    const positions = [
      { x: -600, y: -600, type: 'circle' },
      { x: 600, y: -600, type: 'diamond' },
      { x: -600, y: 600, type: 'diamond' },
      { x: 600, y: 600, type: 'circle' },
      { x: 0, y: -850, type: 'hex' },
      { x: 0, y: 850, type: 'hex' },
      { x: -850, y: 0, type: 'hex' },
      { x: 850, y: 0, type: 'hex' }
    ];
    for (const p of positions) {
      runes.push({ ...p, size: 45 + Math.random() * 20 });
    }
    return runes;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.camera.width = w;
    this.camera.height = h;

    // 响应式动态相机缩放 (解决 1080p 桌面画面过小与手机视野受限问题)
    if (w > 1200) {
      this.camera.zoom = 1.18; // 桌面端清晰聚焦
    } else if (w >= 768) {
      this.camera.zoom = 1.08; // 平板适配
    } else {
      // 手机端：拓宽横向视野，保持 470~520 世界单位预警宽度
      this.camera.zoom = Math.max(0.78, Math.min(0.86, w / 480));
    }
  }

  initUI() {
    // 难度按键选择器监听与双向同步
    const diffButtons = document.querySelectorAll('.diff-btn');
    const diffDescEl = document.getElementById('diff-desc');
    const updateDiffUI = (dKey) => {
      if (!DIFFICULTY_PRESETS[dKey]) return;
      this.difficulty = dKey;
      this.diffConfig = DIFFICULTY_PRESETS[dKey];
      localStorage.setItem('nr_difficulty', dKey);
      diffButtons.forEach(btn => {
        if (btn.dataset.diff === dKey) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      if (diffDescEl) diffDescEl.textContent = this.diffConfig.desc;
      if (this.player) {
        this.player.diffConfig = this.diffConfig;
        this.player.baseSpeed = this.diffConfig.playerBaseSpeed;
        this.player.invulDuration = this.diffConfig.playerInvulDuration;
        this.player.hpRegen = this.diffConfig.playerHpRegen;
        this.player.pickupRange = this.diffConfig.playerPickupRange;
        this.player.recalculateStats(this.passives);
      }
      this.eliteTimer = this.diffConfig.firstEliteTime;
    };
    diffButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        updateDiffUI(btn.dataset.diff);
      });
    });
    updateDiffUI(this.difficulty);

    // 开始行动按键
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }

    // 暂停按键
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }

    // 静音按键
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = window.soundSystem.toggleMute();
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
      });
    }

    // 恢复游戏
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.resumeGame());
    }

    // 重开按键
    const restartBtn = document.getElementById('btn-restart');
    const goRestartBtn = document.getElementById('btn-gameover-restart');
    const doRestart = () => this.restart();
    if (restartBtn) restartBtn.addEventListener('click', doRestart);
    if (goRestartBtn) goRestartBtn.addEventListener('click', doRestart);
  }

  startGame() {
    if (window.soundSystem) window.soundSystem.unlock();
    const startModal = document.getElementById('modal-start');
    if (startModal) startModal.classList.remove('active');
    this.state = 'playing';
    this.lastTime = performance.now();
  }

  updateStartScreenRecords() {
    const bestTime = parseFloat(localStorage.getItem('nr_best_time') || '0');
    const bossKills = localStorage.getItem('nr_boss_kills') || '0';
    const recTimeEl = document.getElementById('record-best-time');
    const recBossEl = document.getElementById('record-bosses');
    if (recTimeEl) recTimeEl.textContent = this.formatTime(bestTime);
    if (recBossEl) recBossEl.textContent = bossKills;
  }

  togglePause() {
    if (this.state === 'playing') {
      this.openPauseModal();
    } else if (this.state === 'paused') {
      this.resumeGame();
    }
  }

  openPauseModal() {
    this.state = 'paused';
    document.getElementById('modal-pause').classList.add('active');
  }

  resumeGame() {
    document.getElementById('modal-pause').classList.remove('active');
    this.state = 'playing';
    this.lastTime = performance.now();
    this.player.grantInvulnerability(this.diffConfig.pauseGracePeriod);
  }

  restart() {
    document.getElementById('modal-start').classList.remove('active');
    document.getElementById('modal-pause').classList.remove('active');
    document.getElementById('modal-gameover').classList.remove('active');
    document.getElementById('modal-upgrade').classList.remove('active');

    // 重新实例化
    this.seed = this.generateSeed();
    this.initPrng(this.seed);
    this.state = 'playing';
    this.elapsedTime = 0;
    this.lastTime = performance.now();
    this.stats = { kills: 0, totalDamage: 0, highestHit: 0, bossKills: 0 };

    this.player = new Player(0, 0, this.diffConfig);

    this.weapons = {};
    for (const [id, Cls] of Object.entries(window.WeaponRegistry)) {
      this.weapons[id] = new Cls();
    }
    this.weapons.pulse_blade.level = 1;

    this.passives = {};
    for (const key of Object.keys(this.upgradeSystem.passiveDefs)) {
      this.passives[key] = { level: 0 };
    }

    this.enemies = [];
    this.enemyBullets = [];
    this.activeBoss = null;
    this.crystals = [];
    this.particles = [];
    this.damageTexts = [];
    this.shockwaves = [];

    this.spawnTimer = 0;
    this.eliteTimer = this.diffConfig.firstEliteTime;
    this.bossSpawned = false;

    if (this.vignetteEl) this.vignetteEl.classList.remove('active');
    document.getElementById('boss-hud').style.display = 'none';
    this.updateHUDBuild();
  }

  // 主循环
  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.state === 'playing') {
      this.update(dt);
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  // 逻辑更新
  update(dt) {
    this.elapsedTime += dt;

    // 1. 更新玩家
    const moveVec = this.input.getVector();
    this.player.update(dt, moveVec, this.arenaBound);

    // 玩家受创屏幕红晕视觉反馈
    if (this.vignetteEl) {
      if (this.player.hurtTimer > 0) {
        this.vignetteEl.classList.add('active');
      } else {
        this.vignetteEl.classList.remove('active');
      }
    }

    // 玩家死亡判定
    if (this.player.isDead) {
      this.gameOver(false);
      return;
    }

    // 2. 更新相机平滑跟随
    this.camera.x += (this.player.x - this.camera.x) * 0.12;
    this.camera.y += (this.player.y - this.camera.y) * 0.12;

    // 3. 刷怪生成逻辑 (平滑演进与阶段规划)
    this.updateSpawns(dt);

    // 4. 更新所有武器
    for (const weapon of Object.values(this.weapons)) {
      weapon.update(dt, this.player, this.enemies, this);
    }

    // 5. 更新所有敌人
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isBoss) {
        e.update(dt, this.player, this.enemies, this.enemyBullets, this);
      } else {
        e.update(dt, this.player, this.enemies, this.enemyBullets);
      }

      // 触碰玩家造成接触伤害
      const distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);
      if (distToPlayer < this.player.radius + e.radius) {
        this.player.takeDamage(e.damage);
      }

      // 敌人死亡结算
      if (e.isDead) {
        this.stats.kills++;

        // 掉落经验晶体
        this.spawnCrystal(e.x, e.y, e.expValue);

        // 裂变怪特殊机制：生成 2 个小子体
        if (e instanceof EnemyTypes.FissionCore && !e.isChild) {
          this.enemies.push(new EnemyTypes.FissionCore(e.x - 12, e.y, 1, true));
          this.enemies.push(new EnemyTypes.FissionCore(e.x + 12, e.y, 1, true));
        }

        // 精英怪阵亡掉落高额经验
        if (e.isElite) {
          this.spawnCrystal(e.x, e.y, 25);
          this.spawnCrystal(e.x + 8, e.y + 8, 25);
        }

        // Boss 阵亡
        if (e.isBoss) {
          this.stats.bossKills++;
          this.activeBoss = null;
          document.getElementById('boss-hud').style.display = 'none';
          this.gameOver(true); // 击败 Boss 获胜！
          return;
        }

        this.enemies.splice(i, 1);
      }
    }

    // 6. 更新敌方飞行子弹
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // 命中玩家
      const d = Math.hypot(this.player.x - b.x, this.player.y - b.y);
      if (d < this.player.radius + b.radius) {
        this.player.takeDamage(b.damage);
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (b.life <= 0) {
        this.enemyBullets.splice(i, 1);
      }
    }

    // 7. 更新经验晶体与磁吸
    this.updateCrystals(dt);

    // 8. 更新粒子、冲击波与浮动文字
    this.updateEffects(dt);

    // 9. 更新 HUD 界面
    this.updateHUD();
  }

  // 刷怪曲线与节奏演进 (难度预设动态适配)
  updateSpawns(dt) {
    // 8 分钟 Boss 登场判定
    if (this.elapsedTime >= this.bossTime && !this.bossSpawned) {
      this.bossSpawned = true;
      if (window.soundSystem) window.soundSystem.playBossAlert();
      const bAngle = Math.random() * Math.PI * 2;
      this.activeBoss = new EnemyTypes.BossTitan(
        this.player.x + Math.cos(bAngle) * 450,
        this.player.y + Math.sin(bAngle) * 450,
        1,
        this.diffConfig
      );
      this.enemies.push(this.activeBoss);
      document.getElementById('boss-hud').style.display = 'flex';
    }

    // 精英怪定时生成
    this.eliteTimer -= dt;
    if (this.eliteTimer <= 0) {
      this.eliteTimer = this.diffConfig.eliteInterval;
      this.spawnElite();
    }

    // 常规怪刷新
    this.spawnTimer -= dt;
    const progress = Math.min(1, this.elapsedTime / 480);
    const interval = Math.max(
      this.diffConfig.spawnIntervalMin,
      this.diffConfig.spawnIntervalBase - progress * (this.diffConfig.spawnIntervalBase - this.diffConfig.spawnIntervalMin)
    );
    if (this.spawnTimer <= 0 && this.enemies.length < this.diffConfig.maxEnemies) {
      this.spawnTimer = interval;
      this.spawnWave();
    }
  }

  spawnWave() {
    const minutes = this.elapsedTime / 60;
    const hpMult = 1 + minutes * this.diffConfig.hpScalePerMin;
    const unlocks = this.diffConfig.unlockTimes;
    const t = this.elapsedTime;

    // 依据相机缩放比例动态计算屏幕视野外的生成距离
    const angle = Math.random() * Math.PI * 2;
    const dist = (Math.max(this.camera.width, this.camera.height) / this.camera.zoom) * 0.55 + 80;
    const sx = this.player.x + Math.cos(angle) * dist;
    const sy = this.player.y + Math.sin(angle) * dist;

    // 根据难度设定的阶梯解锁时间有序产生敌种
    const roll = Math.random();
    let enemy = null;

    if (t >= unlocks.striker && roll < 0.22) {
      enemy = new EnemyTypes.ChargeStriker(sx, sy, hpMult, this.diffConfig);
    } else if (t >= unlocks.sniper && roll < 0.38) {
      enemy = new EnemyTypes.PrismSniper(sx, sy, hpMult, this.diffConfig);
    } else if (t >= unlocks.fission && roll < 0.55) {
      enemy = new EnemyTypes.FissionCore(sx, sy, hpMult);
    } else if (t >= unlocks.golem && roll < 0.72) {
      enemy = new EnemyTypes.RelicGolem(sx, sy, hpMult);
    } else if (roll < 0.45) {
      enemy = new EnemyTypes.NeonScout(sx, sy, hpMult, this.diffConfig);
    } else {
      enemy = new EnemyTypes.SwarmDrone(sx, sy, hpMult);
    }

    this.enemies.push(enemy);
  }

  spawnElite() {
    const angle = Math.random() * Math.PI * 2;
    const sx = this.player.x + Math.cos(angle) * 420;
    const sy = this.player.y + Math.sin(angle) * 420;

    const affixes = ['berserk', 'shield', 'splitter'];
    const affix = affixes[Math.floor(Math.random() * affixes.length)];

    const elite = new EnemyTypes.RelicGolem(sx, sy, this.diffConfig.eliteHpMult);
    elite.isElite = true;
    elite.affix = affix;
    elite.radius = 32;
    elite.expValue = 40;

    if (affix === 'berserk') {
      elite.speed *= 1.35;
      elite.color = '#ff0033';
    } else if (affix === 'shield') {
      elite.shieldHp = this.diffConfig.eliteShieldHp;
      elite.color = '#00f0ff';
    } else if (affix === 'splitter') {
      elite.color = '#b026ff';
    }

    this.enemies.push(elite);
    this.spawnShockwave(sx, sy, 80, '#ffaa00');
  }

  // 经验晶体生成与就近上限聚合
  spawnCrystal(x, y, value) {
    if (this.crystals.length > 150) {
      // 靠近搜索：在最近 30 个晶体中寻找与当前 (x, y) 距离最近的进行能量合并，避免集中到最老晶体
      const searchStart = Math.max(0, this.crystals.length - 30);
      let closest = this.crystals[searchStart];
      let minD2 = Infinity;
      for (let i = searchStart; i < this.crystals.length; i++) {
        const c = this.crystals[i];
        const d2 = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d2 < minD2) {
          minD2 = d2;
          closest = c;
        }
      }
      if (closest) {
        closest.value += value;
        return;
      }
    }

    this.crystals.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      value: value,
      vx: 0,
      vy: 0,
      magnetized: false
    });
  }

  updateCrystals(dt) {
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const c = this.crystals[i];
      const dx = this.player.x - c.x;
      const dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy);

      if (dist < this.player.pickupRange) {
        c.magnetized = true;
      }

      if (c.magnetized) {
        const speed = 440;
        c.x += (dx / dist) * speed * dt;
        c.y += (dy / dist) * speed * dt;

        if (dist < this.player.radius + 10) {
          if (window.soundSystem) window.soundSystem.playGem(c.value);
          this.player.addExp(c.value, () => this.openUpgradeModal());
          this.crystals.splice(i, 1);
        }
      }
    }
  }

  // 浮动伤害数字
  spawnDamageText(x, y, amount, isCrit, color) {
    if (amount > this.stats.highestHit) {
      this.stats.highestHit = amount;
    }
    this.stats.totalDamage += amount;

    if (this.damageTexts.length > 50) {
      this.damageTexts.shift();
    }

    this.damageTexts.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y,
      text: isCrit ? `${amount}!` : `${amount}`,
      isCrit: isCrit,
      color: color,
      life: 0.65,
      maxLife: 0.65
    });
  }

  // 粒子火花
  spawnSparks(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 250) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 120;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color: color,
        radius: 1.5 + Math.random() * 2,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  // 冲击波光圈
  spawnShockwave(x, y, maxRadius, color) {
    this.shockwaves.push({
      x: x,
      y: y,
      radius: 5,
      maxRadius: maxRadius,
      color: color,
      life: 0.35,
      maxLife: 0.35
    });
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      sw.radius += (sw.maxRadius - sw.radius) * 12 * dt;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const dtObj = this.damageTexts[i];
      dtObj.y -= 35 * dt;
      dtObj.life -= dt;
      if (dtObj.life <= 0) this.damageTexts.splice(i, 1);
    }
  }

  // 肉鸽三选一升级弹窗 (升级队列机制)
  openUpgradeModal() {
    this.state = 'upgrade';
    const choices = this.upgradeSystem.generateChoices(this.weapons, this.passives);
    const container = document.getElementById('upgrade-cards-list');
    container.innerHTML = '';

    choices.forEach(card => {
      const el = document.createElement('div');
      el.className = `upgrade-card rarity-${card.rarity}`;
      el.innerHTML = `
        <div class="card-icon-box">${card.icon}</div>
        <div class="card-info">
          <div class="card-header-row">
            <span class="card-name">${card.name}</span>
            <span class="card-rarity-badge">${card.rarity.toUpperCase()}</span>
          </div>
          <span class="card-desc">${card.desc}</span>
          <span class="card-level-tag">${card.levelTag}</span>
        </div>
      `;

      el.addEventListener('click', () => {
        this.selectUpgrade(card);
      });
      container.appendChild(el);
    });

    document.getElementById('modal-upgrade').classList.add('active');
  }

  selectUpgrade(card) {
    if (card.type === 'weapon') {
      const w = this.weapons[card.targetId];
      if (w) w.level++;
    } else if (card.type === 'passive') {
      const p = this.passives[card.targetId];
      if (p) {
        p.level++;
        this.player.recalculateStats(this.passives);
      }
    } else if (card.type === 'evolution') {
      const w = this.weapons[card.targetId];
      if (w) {
        w.evolve();
        if (window.soundSystem) window.soundSystem.playEvolution();
      }
    } else if (card.type === 'heal') {
      this.player.heal(this.player.maxHp * 0.4);
      this.spawnShockwave(this.player.x, this.player.y, 240, '#00f0ff');
    }

    // 触发品质专属附加加成 (如史诗/稀有赠送的生命恢复与即时经验)
    if (card.bonus) {
      if (card.bonus.healPercent > 0) {
        this.player.heal(this.player.maxHp * card.bonus.healPercent);
        this.spawnShockwave(this.player.x, this.player.y, 140, '#00f0ff');
      }
      if (card.bonus.exp > 0) {
        this.player.addExp(card.bonus.exp, () => this.openUpgradeModal());
      }
    }

    this.updateHUDBuild();

    // 扣减升级队列
    this.player.pendingUpgrades = Math.max(0, this.player.pendingUpgrades - 1);

    // 如果连续升了多级，继续弹出剩余的三选一，绝不丢失升级机会！
    if (this.player.pendingUpgrades > 0) {
      this.openUpgradeModal();
    } else {
      document.getElementById('modal-upgrade').classList.remove('active');
      this.state = 'playing';
      this.lastTime = performance.now();
      // 赋予升级弹窗关闭后的防秒杀安全缓冲时间 (默认休闲模式0.85s)
      this.player.grantInvulnerability(this.diffConfig.upgradeGracePeriod);
    }
  }

  // 游戏结束与战报
  gameOver(isVictory) {
    this.state = 'gameover';

    let mvpWeapon = '脉冲刃';
    let maxDmg = 0;
    for (const w of Object.values(this.weapons)) {
      if (w.damageDealt > maxDmg) {
        maxDmg = w.damageDealt;
        mvpWeapon = w.name;
      }
    }

    const prevBestTime = parseFloat(localStorage.getItem('nr_best_time') || '0');
    if (this.elapsedTime > prevBestTime) {
      localStorage.setItem('nr_best_time', this.elapsedTime.toFixed(1));
    }
    const totalBossKills = parseInt(localStorage.getItem('nr_boss_kills') || '0') + (isVictory ? 1 : 0);
    localStorage.setItem('nr_boss_kills', totalBossKills.toString());

    document.getElementById('gameover-title').textContent = isVictory ? '遗迹征服！VICTORY' : '核心过载 DEFEAT';
    document.getElementById('gameover-title').style.color = isVictory ? '#00f0ff' : '#ff0055';
    document.getElementById('stat-time').textContent = this.formatTime(this.elapsedTime);
    document.getElementById('stat-level').textContent = `Lv.${this.player.level}`;
    document.getElementById('stat-kills').textContent = this.stats.kills;
    document.getElementById('stat-damage').textContent = Math.round(this.stats.totalDamage);
    document.getElementById('stat-highest-hit').textContent = this.stats.highestHit;
    document.getElementById('stat-mvp').textContent = mvpWeapon;
    document.getElementById('gameover-seed').textContent = `SEED: ${this.seed}`;

    const buildWrap = document.getElementById('final-build-items');
    buildWrap.innerHTML = '';
    for (const w of Object.values(this.weapons)) {
      if (w.level > 0) {
        const item = document.createElement('div');
        item.className = 'weapon-chip';
        item.innerHTML = `${w.icon}<span class="chip-level">${w.isEvolved ? 'MAX' : w.level}</span>`;
        buildWrap.appendChild(item);
      }
    }
    for (const [id, p] of Object.entries(this.passives)) {
      if (p.level > 0) {
        const def = this.upgradeSystem.passiveDefs[id];
        const item = document.createElement('div');
        item.className = 'weapon-chip';
        item.innerHTML = `${def.icon}<span class="chip-level">${p.level}</span>`;
        buildWrap.appendChild(item);
      }
    }

    document.getElementById('modal-gameover').classList.add('active');
  }

  // 更新 HUD 界面
  updateHUD() {
    // 计时器与击杀
    document.getElementById('hud-timer').textContent = this.formatTime(this.elapsedTime);
    document.getElementById('hud-kill-count').textContent = `KILLS ${this.stats.kills}`;

    // 等级与经验条
    document.getElementById('hud-level').textContent = `Lv.${this.player.level}`;
    const expPercent = Math.min(100, (this.player.currentExp / this.player.nextLevelExp) * 100);
    document.getElementById('exp-bar-fill').style.width = `${expPercent}%`;
    document.getElementById('exp-text').textContent = `${Math.floor(this.player.currentExp)} / ${this.player.nextLevelExp}`;

    // 动态血条颜色 (青色正常 -> 橙色受创 -> 红色危险)
    const hpRatio = this.player.hp / this.player.maxHp;
    const hpPercent = Math.max(0, Math.min(100, hpRatio * 100));
    const hpFill = document.getElementById('hp-fill');
    hpFill.style.width = `${hpPercent}%`;

    if (hpRatio > 0.5) {
      hpFill.style.background = '#00f0ff';
      hpFill.style.boxShadow = '0 0 8px rgba(0, 240, 255, 0.6)';
    } else if (hpRatio > 0.25) {
      hpFill.style.background = '#ffaa00';
      hpFill.style.boxShadow = '0 0 8px rgba(255, 170, 0, 0.6)';
    } else {
      hpFill.style.background = '#ff2255';
      hpFill.style.boxShadow = '0 0 10px rgba(255, 34, 85, 0.8)';
    }

    document.getElementById('hp-text').textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
    document.getElementById('armor-text').textContent = `DEF ${this.player.armor}`;

    // Boss 血条与阶段动态呈现
    if (this.activeBoss && !this.activeBoss.isDead) {
      const bHpPercent = Math.max(0, Math.min(100, (this.activeBoss.hp / this.activeBoss.maxHp) * 100));
      document.getElementById('boss-hp-fill').style.width = `${bHpPercent}%`;
      const phaseTag = document.getElementById('boss-phase-tag');
      if (phaseTag) {
        phaseTag.textContent = `PHASE ${this.activeBoss.phase}`;
        if (this.activeBoss.phase === 3) {
          phaseTag.style.color = '#ff0055';
          phaseTag.style.borderColor = '#ff0055';
        } else if (this.activeBoss.phase === 2) {
          phaseTag.style.color = '#ffaa00';
          phaseTag.style.borderColor = '#ffaa00';
        } else {
          phaseTag.style.color = '#00f0ff';
          phaseTag.style.borderColor = '#00f0ff';
        }
      }
    }
  }

  // 底部装备栏更新
  updateHUDBuild() {
    const buildView = document.getElementById('build-quick-view');
    if (!buildView) return;
    buildView.innerHTML = '';

    for (const w of Object.values(this.weapons)) {
      if (w.level > 0) {
        const chip = document.createElement('div');
        chip.className = 'weapon-chip';
        chip.innerHTML = `${w.icon}<span class="chip-level">${w.isEvolved ? '★' : w.level}</span>`;
        buildView.appendChild(chip);
      }
    }
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // 渲染总流程
  render() {
    const ctx = this.ctx;
    const w = this.camera.width;
    const h = this.camera.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    // 相机视口偏移并叠加响应式缩放
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. 绘制竞技场地板霓虹遗迹网格与古代符文
    this.renderArenaGrid(ctx);

    // 2. 绘制经验晶体
    this.renderCrystals(ctx);

    // 3. 绘制敌人
    for (const e of this.enemies) {
      e.render(ctx);
    }

    // 4. 绘制敌方弹幕
    for (const b of this.enemyBullets) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }

    // 5. 绘制玩家
    this.player.render(ctx);

    // 6. 绘制武器特效
    for (const weapon of Object.values(this.weapons)) {
      if (weapon instanceof window.WeaponRegistry.orbital_satellites) {
        weapon.render(ctx, this.player);
      } else {
        weapon.render(ctx);
      }
    }

    // 7. 绘制粒子与冲击波
    for (const sw of this.shockwaves) {
      const alpha = sw.life / sw.maxLife;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fill();
      ctx.restore();
    }

    // 8. 绘制浮动伤害文字
    for (const dtObj of this.damageTexts) {
      const alpha = dtObj.life / dtObj.maxLife;
      ctx.save();
      ctx.font = dtObj.isCrit ? 'bold 17px sans-serif' : 'bold 12px sans-serif';
      ctx.fillStyle = dtObj.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.fillText(dtObj.text, dtObj.x, dtObj.y);
      ctx.restore();
    }

    ctx.restore();

    // 9. 绘制屏幕边缘 Boss 与精英怪方向预警雷达指针 (强化手机端战场态势感知)
    this.renderOffscreenIndicators(ctx, w, h);
  }

  renderOffscreenIndicators(ctx, w, h) {
    const margin = 34;
    for (const e of this.enemies) {
      if ((e.isBoss || e.isElite) && !e.isDead) {
        // 计算目标在屏幕坐标系中的投影位置
        const screenX = (e.x - this.camera.x) * this.camera.zoom + w / 2;
        const screenY = (e.y - this.camera.y) * this.camera.zoom + h / 2;

        // 判断是否位于视野之外
        const isOffscreen = screenX < 25 || screenX > w - 25 || screenY < 25 || screenY > h - 25;
        if (!isOffscreen) continue;

        // 计算屏幕中心指向目标的方位角
        const cx = w / 2;
        const cy = h / 2;
        const angle = Math.atan2(screenY - cy, screenX - cx);

        // 沿视野边界约束截断指示器坐标 (避开顶部 HUD 与底部 Dock)
        const edgeX = Math.max(margin, Math.min(w - margin, cx + Math.cos(angle) * (w / 2 - margin)));
        const edgeY = Math.max(margin + 52, Math.min(h - margin - 45, cy + Math.sin(angle) * (h / 2 - margin)));

        const distWorld = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        const distText = `${Math.round(distWorld / 10)}m`;
        const color = e.isBoss ? '#ff0055' : '#ffaa00';
        const label = e.isBoss ? 'BOSS' : 'ELITE';

        ctx.save();
        ctx.translate(edgeX, edgeY);

        // 绘制霓虹导引箭头
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();

        // 标号与距离度量
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = color;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 5;
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, -12);
        ctx.font = '9px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(distText, 0, 16);

        ctx.restore();
      }
    }
  }

  renderArenaGrid(ctx) {
    const bound = this.arenaBound;
    const gridSize = 90;

    // 边界发光框
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-bound.halfWidth, -bound.halfHeight, bound.halfWidth * 2, bound.halfHeight * 2);

    // 内部网格细线与交叉点微光
    ctx.strokeStyle = 'rgba(0, 140, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const startX = -bound.halfWidth;
    const endX = bound.halfWidth;
    const startY = -bound.halfHeight;
    const endY = bound.halfHeight;

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // 散落古遗迹发光符文印记
    for (const rune of this.arenaRunes) {
      ctx.save();
      ctx.translate(rune.x, rune.y);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.lineWidth = 1.5;

      if (rune.type === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, rune.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, rune.size * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (rune.type === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -rune.size);
        ctx.lineTo(rune.size, 0);
        ctx.lineTo(0, rune.size);
        ctx.lineTo(-rune.size, 0);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const px = Math.cos(a) * rune.size;
          const py = Math.sin(a) * rune.size;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 中央遗迹符文总阵
    ctx.beginPath();
    ctx.arc(0, 0, 220, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 110, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(176, 38, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  renderCrystals(ctx) {
    for (const c of this.crystals) {
      ctx.save();
      ctx.translate(c.x, c.y);

      // 菱形能量水晶
      ctx.beginPath();
      const r = c.value > 20 ? 6.5 : (c.value > 4 ? 5 : 4);
      ctx.moveTo(0, -r * 1.3);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r * 1.3);
      ctx.lineTo(-r, 0);
      ctx.closePath();

      const color = c.value >= 25 ? '#ffaa00' : (c.value >= 5 ? '#b026ff' : '#00f0ff');
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 7;
      ctx.fill();

      ctx.restore();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
});
