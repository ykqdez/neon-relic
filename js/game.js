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
    spawnIntervalBase: 1.30,
    spawnIntervalMin: 0.45,
    hpScalePerMin: 0.16,
    maxEnemies: 96,
    enemyDamageMult: 0.80,
    enemyWeights: {
      drone: 30,
      scout: 18,
      golem: 14,
      fission: 14,
      sniper: 12,
      striker: 12
    },
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
    sniperLockTime: 0.50,
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
    spawnIntervalMin: 0.24,
    hpScalePerMin: 0.26,
    maxEnemies: 140,
    enemyDamageMult: 1.00,
    enemyWeights: {
      drone: 24,
      scout: 18,
      golem: 16,
      fission: 15,
      sniper: 14,
      striker: 13
    },
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
    sniperLockTime: 0.35,
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
    enemyDamageMult: 1.18,
    enemyWeights: {
      drone: 18,
      scout: 16,
      golem: 18,
      fission: 16,
      sniper: 16,
      striker: 16
    },
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
    sniperLockTime: 0.18,
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
    this.isMobileDevice = isTouchDevice;

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

    // 暂停原因集合管理 (A02) 与 恢复无敌冷却预算 (A06)
    this.pauseReasons = new Set();
    this.lastPauseGraceTime = -999;

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
      if (document.hidden) this.pauseForSystem();
    });
    window.addEventListener('blur', () => {
      this.pauseForSystem();
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

  // 动态屏幕适配与高分屏优化
  resize(customW = null, customH = null) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = customW !== null ? customW : window.innerWidth;
    const h = customH !== null ? customH : window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.camera.width = w;
    this.camera.height = h;

    // 综合考量视口短边、长宽比与设备特性，实现横竖屏自适应 FOV
    const minDim = Math.min(w, h);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isMobile = (minDim < 540) || (isTouch && Math.max(w, h) < 1000 && minDim < 600);
    const isLandscape = w > h;

    if (isMobile && isLandscape) {
      // 手机横屏 (如 844x390, 932x430)：以较短的垂直高度 h 为基准，确保垂直世界视野至少 500 单位
      this.camera.zoom = Math.min(0.78, Math.max(0.65, h / 500));
    } else if (isMobile && !isLandscape) {
      // 手机竖屏 (如 390x844, 430x932)：以水平宽度 w 为基准，保持 460~500 世界单位预警宽度
      this.camera.zoom = Math.max(0.78, Math.min(0.86, w / 480));
    } else if (minDim >= 600 && Math.max(w, h) <= 1366 && isTouch) {
      // 平板设备
      this.camera.zoom = 1.05;
    } else if (w > 1200) {
      // 桌面端宽屏
      this.camera.zoom = 1.18;
    } else {
      // 默认适中
      this.camera.zoom = 1.0;
    }
  }

  // 依据当前相机视口矩形边界计算离屏生成位置 (沿射线方向与屏幕外框求交并外扩 padding 世界单位，确保在屏幕外平滑进场)
  getOffscreenSpawnPosition(minPadding = 65, maxPadding = 95) {
    const zoom = (this.camera && this.camera.zoom) ? this.camera.zoom : 1.0;
    const halfW = (this.camera.width / 2) / zoom;
    const halfH = (this.camera.height / 2) / zoom;
    const angle = Math.random() * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tX = Math.abs(cos) > 1e-5 ? halfW / Math.abs(cos) : Infinity;
    const tY = Math.abs(sin) > 1e-5 ? halfH / Math.abs(sin) : Infinity;
    const tBorder = Math.min(tX, tY);
    const padding = minPadding + Math.random() * (maxPadding - minPadding);
    const dist = tBorder + padding;
    return {
      x: this.player.x + cos * dist,
      y: this.player.y + sin * dist
    };
  }

  // 统一检查当前是否允许额外生成敌人 (严格限制于各难度上限，仅统计存活实体)
  canSpawnEnemies(count = 1) {
    const isBossActive = !!(this.activeBoss && !this.activeBoss.isDead);
    const max = this.diffConfig && this.diffConfig.maxEnemies !== undefined
      ? this.diffConfig.maxEnemies
      : (this.maxEnemies || 90);
    const currentMax = isBossActive
      ? Math.round(max * 0.75)
      : max;
    const livingCount = this.enemies.reduce((acc, e) => acc + (e && !e.isDead ? 1 : 0), 0);
    return livingCount + count <= currentMax;
  }

  setDifficulty(dKey) {
    if (!DIFFICULTY_PRESETS[dKey]) return;
    this.difficulty = dKey;
    this.diffConfig = DIFFICULTY_PRESETS[dKey];
    localStorage.setItem('nr_difficulty', dKey);
    const diffButtons = document.querySelectorAll('.diff-btn');
    diffButtons.forEach(btn => {
      if (btn.dataset.diff === dKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    const diffDescEl = document.getElementById('diff-desc');
    if (diffDescEl) diffDescEl.textContent = this.diffConfig.desc;
    if (this.player) {
      this.player.diffConfig = this.diffConfig;
      this.player.baseSpeed = this.diffConfig.playerBaseSpeed;
      this.player.basePickupRange = this.diffConfig.playerPickupRange;
      this.player.baseHpRegen = this.diffConfig.playerHpRegen;
      this.player.invulnerableDuration = this.diffConfig.playerInvulDuration;
      this.player.recalculateStats(this.passives);
    }
    this.eliteTimer = this.diffConfig.firstEliteTime;
  }

  initUI() {
    // 难度按键选择器监听与双向同步
    const diffButtons = document.querySelectorAll('.diff-btn');
    diffButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setDifficulty(btn.dataset.diff);
      });
    });
    this.setDifficulty(this.difficulty);

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

    // 机体协议抽屉 (展开/关闭)
    const toggleBuildBtn = document.getElementById('btn-toggle-build');
    if (toggleBuildBtn) {
      toggleBuildBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openBuildDetailModal();
      });
    }
    const closeBuildBtn = document.getElementById('btn-close-build-detail');
    if (closeBuildBtn) {
      closeBuildBtn.addEventListener('click', () => this.closeBuildDetailModal());
    }
    const doneBuildBtn = document.getElementById('btn-done-build-detail');
    if (doneBuildBtn) {
      doneBuildBtn.addEventListener('click', () => this.closeBuildDetailModal());
    }
  }

  openBuildDetailModal() {
    if (this.state === 'ready' || this.state === 'upgrade' || this.state === 'gameover') return;
    this.pauseReasons.add('build_detail');
    this.state = 'paused';
    this.renderBuildDetailContent();
    const modal = document.getElementById('modal-build-detail');
    if (modal) modal.classList.add('active');
  }

  closeBuildDetailModal() {
    const modal = document.getElementById('modal-build-detail');
    if (modal) modal.classList.remove('active');
    this.pauseReasons.delete('build_detail');
    if (this.pauseReasons.size === 0 && this.state === 'paused') {
      this.resumeGame(false);
    }
  }

  renderBuildDetailContent() {
    const container = document.getElementById('build-detail-content');
    if (!container) return;
    container.innerHTML = '';

    // 1. 战术武器清单
    const wSection = document.createElement('div');
    wSection.className = 'bd-section';
    wSection.innerHTML = '<div class="bd-section-title">已装载战术武器 (WEAPONS)</div>';

    const activeWeapons = Object.values(this.weapons).filter(w => w.level > 0);
    if (activeWeapons.length === 0) {
      wSection.innerHTML += '<div style="color:var(--text-dim);font-size:0.75rem;padding:4px;">暂无装备武器</div>';
    } else {
      for (const w of activeWeapons) {
        const item = document.createElement('div');
        item.className = `bd-item ${w.isEvolved ? 'evolved' : ''}`;
        item.innerHTML = `
          <div class="bd-item-info">
            <span class="bd-item-icon">${w.icon}</span>
            <div>
              <div class="bd-item-name">${w.name} ${w.isEvolved ? '★ (EVOLVED)' : ''}</div>
              <div style="font-size:0.68rem;color:var(--text-dim);">${w.description || ''}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
            <span class="bd-item-lvl">${w.isEvolved ? 'EVO' : `Lv.${w.level}`}</span>
            <span class="bd-item-dps">${Math.round(w.damageDealt)} DMG</span>
          </div>
        `;
        wSection.appendChild(item);
      }
    }
    container.appendChild(wSection);

    // 2. 机体强化被动
    const pSection = document.createElement('div');
    pSection.className = 'bd-section';
    pSection.innerHTML = '<div class="bd-section-title">已生效强化被动 (PASSIVE PROTOCOLS)</div>';

    const activePassives = Object.entries(this.passives).filter(([_, p]) => p && p.level > 0);
    if (activePassives.length === 0) {
      pSection.innerHTML += '<div style="color:var(--text-dim);font-size:0.75rem;padding:4px;">暂无激活被动</div>';
    } else {
      for (const [id, p] of activePassives) {
        const def = this.upgradeSystem.passiveDefs[id];
        if (!def) continue;
        const item = document.createElement('div');
        item.className = 'bd-item';
        item.innerHTML = `
          <div class="bd-item-info">
            <span class="bd-item-icon">${def.icon}</span>
            <div>
              <div class="bd-item-name">${def.name}</div>
              <div style="font-size:0.68rem;color:var(--text-dim);">${def.desc || ''}</div>
            </div>
          </div>
          <span class="bd-item-lvl">Lv.${p.level}</span>
        `;
        pSection.appendChild(item);
      }
    }
    container.appendChild(pSection);
  }

  startGame() {
    if (window.soundSystem) window.soundSystem.unlock();
    const startModal = document.getElementById('modal-start');
    if (startModal) startModal.classList.remove('active');
    this.pauseReasons.clear();
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
    if (this.state === 'ready' || this.state === 'upgrade' || this.state === 'gameover') return;

    // 优先处理顶层抽屉：若协议详情遮罩处于打开状态，按下暂停键或 Esc 优先关闭顶层抽屉
    const modalBuildDetail = document.getElementById('modal-build-detail');
    if (modalBuildDetail && modalBuildDetail.classList.contains('active')) {
      this.closeBuildDetailModal();
      return;
    }

    if (this.state === 'playing') {
      this.openPauseModal();
    } else if (this.state === 'paused') {
      this.resumeGame();
    }
  }

  openPauseModal() {
    if (this.state === 'ready' || this.state === 'upgrade' || this.state === 'gameover') return;
    this.pauseReasons.add('user_pause');
    this.state = 'paused';
    const modalPause = document.getElementById('modal-pause');
    if (modalPause) modalPause.classList.add('active');
  }

  pauseForSystem() {
    if (this.state === 'ready' || this.state === 'gameover') return;
    this.pauseReasons.add('system_blur');
    // 升级选择完成后再显示暂停层，保留尚未消费的选择。
    if (this.state !== 'upgrade') {
      this.state = 'paused';
      document.getElementById('modal-pause')?.classList.add('active');
    }
  }

  resumeGame(explicit = true) {
    if (this.state === 'ready' || this.state === 'upgrade' || this.state === 'gameover') return;
    if (document.hidden) {
      this.pauseForSystem();
      return;
    }
    if (explicit) {
      this.pauseReasons.delete('user_pause');
      this.pauseReasons.delete('system_blur');
    }
    if (this.pauseReasons.size > 0 || this.state === 'playing') return;
    const modalPause = document.getElementById('modal-pause');
    if (modalPause) modalPause.classList.remove('active');
    const modalBuildDetail = document.getElementById('modal-build-detail');
    if (modalBuildDetail) modalBuildDetail.classList.remove('active');

    this.state = 'playing';
    this.lastTime = performance.now();

    // A06 防作弊与恢复保护预算：
    // 1. 若当前玩家已有无敌 (invulnerableTimer > 0)，不予发放新护盾，不延长现有无敌
    // 2. 要求至少经历 5.0 秒有效战斗时间 (elapsedTime - lastPauseGraceTime >= 5.0) 方可再次触发主动暂停护盾
    if (this.player && this.player.invulnerableTimer <= 0) {
      if (this.elapsedTime - this.lastPauseGraceTime >= 5.0) {
        this.lastPauseGraceTime = this.elapsedTime;
        const grace = this.diffConfig ? this.diffConfig.pauseGracePeriod : 0.35;
        this.player.grantInvulnerability(grace);
      }
    }
  }

  restart() {
    document.getElementById('modal-start').classList.remove('active');
    document.getElementById('modal-pause').classList.remove('active');
    document.getElementById('modal-gameover').classList.remove('active');
    document.getElementById('modal-upgrade').classList.remove('active');
    const modalBuildDetail = document.getElementById('modal-build-detail');
    if (modalBuildDetail) modalBuildDetail.classList.remove('active');

    this.pauseReasons.clear();
    this.lastPauseGraceTime = -999;

    // 重新实例化
    this.seed = this.generateSeed();
    this.initPrng(this.seed);
    this.state = 'playing';
    this.elapsedTime = 0;
    this.lastTime = performance.now();
    this.stats = { kills: 0, totalDamage: 0, highestHit: 0, bossKills: 0 };

    this.player = new Player(0, 0, this.diffConfig);

    // A04: 相机坐标即刻对齐玩家中心，不产生幽灵位移
    if (this.camera) {
      this.camera.x = this.player.x;
      this.camera.y = this.player.y;
    }

    // A04: 输入系统彻底重置
    if (this.input && typeof this.input.reset === 'function') {
      this.input.reset();
    }

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
    // A04: 首帧即刻更新 HUD (显示 00:00, Lv1, 满血)
    this.updateHUD();
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

    // 玩家受创屏幕红晕视觉反馈 (由 Player.hurtFlashTimer 驱动)
    if (this.vignetteEl) {
      if (this.player.hurtFlashTimer > 0) {
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

      // 触碰玩家造成接触伤害 (只有活着的敌人才能造成伤害，应用统一敌方伤害倍率)
      if (!e.isDead) {
        const distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);
        if (distToPlayer < this.player.radius + e.radius) {
          const dmgMult = (this.diffConfig && this.diffConfig.enemyDamageMult !== undefined) ? this.diffConfig.enemyDamageMult : 1.0;
          this.player.takeDamage(e.damage * dmgMult);
        }
      }

      // 敌人死亡结算
      if (e.isDead) {
        this.stats.kills++;

        // 掉落经验晶体
        this.spawnCrystal(e.x, e.y, e.expValue);

        // 裂变怪特殊机制：生成 2 个小子体 (严格遵守上限)
        if (e instanceof EnemyTypes.FissionCore && !e.isChild) {
          if (this.canSpawnEnemies(1)) {
            this.enemies.push(new EnemyTypes.FissionCore(e.x - 12, e.y, 1, true));
          }
          if (this.canSpawnEnemies(1)) {
            this.enemies.push(new EnemyTypes.FissionCore(e.x + 12, e.y, 1, true));
          }
        }

        // 精英怪分裂词缀 splitter：死亡生成 2~3 个弱化子体 (子体非精英，不重复发放精英奖励，严格遵守同屏上限与血量一致性)
        if (e.isElite && e.affix === 'splitter') {
          const splitCount = 2 + Math.floor(Math.random() * 2); // 2~3 个
          for (let s = 0; s < splitCount; s++) {
            if (!this.canSpawnEnemies(1)) break;
            const angle = (s / splitCount) * Math.PI * 2;
            const sub = new EnemyTypes.RelicGolem(e.x + Math.cos(angle) * 24, e.y + Math.sin(angle) * 24, 0.45);
            const subHp = Math.max(20, Math.round(e.maxHp * 0.22));
            sub.isElite = false;
            sub.affix = null;
            sub.radius = 16;
            sub.maxHp = subHp;
            sub.hp = subHp;
            sub.speed = e.speed * 1.25;
            sub.damage = Math.round(e.damage * 0.6);
            sub.expValue = 3;
            sub.color = '#d066ff';
            this.enemies.push(sub);
          }
          this.spawnShockwave(e.x, e.y, 60, '#b026ff');
        }

        // 精英怪阵亡掉落高额经验 (仅本体掉落)
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

      // 命中玩家 (应用统一敌方伤害倍率)
      const d = Math.hypot(this.player.x - b.x, this.player.y - b.y);
      if (d < this.player.radius + b.radius) {
        const dmgMult = (this.diffConfig && this.diffConfig.enemyDamageMult !== undefined) ? this.diffConfig.enemyDamageMult : 1.0;
        this.player.takeDamage(b.damage * dmgMult);
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
    const isBossActive = this.activeBoss && !this.activeBoss.isDead;

    // 8 分钟 Boss 登场判定与战场边缘杂兵清理
    if (this.elapsedTime >= this.bossTime && !this.bossSpawned) {
      this.bossSpawned = true;
      if (window.soundSystem) window.soundSystem.playBossAlert();

      // A08: 计算 Boss 阶段容量硬上限 (休闲 72 / 标准 105 / 极境 135)
      const max = this.diffConfig && this.diffConfig.maxEnemies !== undefined
        ? this.diffConfig.maxEnemies
        : (this.maxEnemies || 90);
      const bossCap = Math.round(max * 0.75);
      const targetLivingNonBoss = bossCap - 1; // 为 Boss 预留 1 个槽位

      // 1. 存活与死亡实体隔离：保留所有未结算死亡实体 (isDead: true)，仅对存活实体进行裁减
      const deadEnemies = this.enemies.filter(e => e.isDead);
      let livingEnemies = this.enemies.filter(e => !e.isDead);

      // 2. 优先清理距离玩家 > 350px 的存活非精英杂兵 (移除不计击杀、不掉经验)
      if (livingEnemies.length > targetLivingNonBoss) {
        livingEnemies = livingEnemies.filter(e => {
          if (e.isElite) return true;
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          return d <= 350;
        });
      }

      // 3. 若存活非 Boss 实体仍超出容量目标：按距玩家距离由远及近裁减非精英杂兵
      if (livingEnemies.length > targetLivingNonBoss) {
        const elites = livingEnemies.filter(e => e.isElite);
        const nonElites = livingEnemies.filter(e => !e.isElite);
        nonElites.sort((a, b) => {
          const da = Math.hypot(a.x - this.player.x, a.y - this.player.y);
          const db = Math.hypot(b.x - this.player.x, b.y - this.player.y);
          return db - da; // 降序：距离远的排在前面
        });
        const canKeepNonElites = Math.max(0, targetLivingNonBoss - elites.length);
        const keptNonElites = nonElites.slice(nonElites.length - canKeepNonElites);
        livingEnemies = [...elites, ...keptNonElites];
      }

      // 4. 兜底策略：若非精英全部清理后仍超标（极端精英同屏），按距离裁减最远精英以确保硬上限
      if (livingEnemies.length > targetLivingNonBoss) {
        livingEnemies.sort((a, b) => {
          const da = Math.hypot(a.x - this.player.x, a.y - this.player.y);
          const db = Math.hypot(b.x - this.player.x, b.y - this.player.y);
          return db - da;
        });
        livingEnemies = livingEnemies.slice(livingEnemies.length - targetLivingNonBoss);
      }

      const { x: bx, y: by } = this.getOffscreenSpawnPosition(140, 180);
      this.activeBoss = new EnemyTypes.BossTitan(
        bx,
        by,
        1,
        this.diffConfig
      );

      // 合并保留实体与 Boss
      this.enemies = [...deadEnemies, ...livingEnemies, this.activeBoss];

      const bossHud = document.getElementById('boss-hud');
      if (bossHud) bossHud.style.display = 'flex';

      this.spawnShockwave(this.player.x, this.player.y, 350, '#ff007f', true);
      this.spawnTimer = 2.5; // Boss 登场震撼期延迟后续小怪波次刷新
    }

    // 精英怪定时生成 (Boss 存活期间或登场前 25 秒暂停新增 Elite，避免双重高压同台)
    const bossNear = this.elapsedTime >= (this.bossTime - 25);
    if (!isBossActive && !bossNear) {
      this.eliteTimer -= dt;
      if (this.eliteTimer <= 0) {
        this.eliteTimer = this.diffConfig.eliteInterval;
        if (this.canSpawnEnemies(1)) {
          this.spawnElite();
        }
      }
    }

    // 常规怪刷新 (Boss 存活期间刷新速率降低约 38%，杂兵上限临时降低 25%；Boss 登场前 25 秒降速 25%)
    this.spawnTimer -= dt;
    const progress = Math.min(1, this.elapsedTime / 480);
    let interval = Math.max(
      this.diffConfig.spawnIntervalMin,
      this.diffConfig.spawnIntervalBase - progress * (this.diffConfig.spawnIntervalBase - this.diffConfig.spawnIntervalMin)
    );
    if (isBossActive) {
      interval *= 1.62;
    } else if (bossNear) {
      interval *= 1.25;
    }

    const currentMaxEnemies = isBossActive
      ? Math.round(this.diffConfig.maxEnemies * 0.75)
      : this.diffConfig.maxEnemies;

    if (this.spawnTimer <= 0 && this.canSpawnEnemies(1)) {
      this.spawnTimer = interval;
      this.spawnWave();
    }
  }

  // 真正的加权随机敌人池 (Weighted Random Pool)
  spawnWave() {
    const minutes = this.elapsedTime / 60;
    const hpMult = 1 + minutes * this.diffConfig.hpScalePerMin;
    const unlocks = this.diffConfig.unlockTimes;
    const t = this.elapsedTime;

    // 依据当前相机视口矩形边界统一计算离屏生成位置 (外扩 65~95 世界单位，自然进入屏幕)
    const { x: sx, y: sy } = this.getOffscreenSpawnPosition(65, 95);

    // 根据已解锁敌人群系动态构建加权池并归一化抽取
    const activePool = [];
    let totalWeight = 0;
    const weights = this.diffConfig.enemyWeights || { drone: 30, scout: 18, golem: 14, fission: 14, sniper: 12, striker: 12 };
    for (const [type, weight] of Object.entries(weights)) {
      if (t >= (unlocks[type] ?? 0)) {
        activePool.push({ type, weight });
        totalWeight += weight;
      }
    }
    if (activePool.length === 0) {
      activePool.push({ type: 'drone', weight: 1 });
      totalWeight = 1;
    }

    let r = Math.random() * totalWeight;
    let chosenType = activePool[0].type;
    for (const item of activePool) {
      if (r < item.weight) {
        chosenType = item.type;
        break;
      }
      r -= item.weight;
    }

    let enemy = null;
    switch (chosenType) {
      case 'striker':
        enemy = new EnemyTypes.ChargeStriker(sx, sy, hpMult, this.diffConfig);
        break;
      case 'sniper':
        enemy = new EnemyTypes.PrismSniper(sx, sy, hpMult, this.diffConfig);
        break;
      case 'fission':
        enemy = new EnemyTypes.FissionCore(sx, sy, hpMult);
        break;
      case 'golem':
        enemy = new EnemyTypes.RelicGolem(sx, sy, hpMult);
        break;
      case 'scout':
        enemy = new EnemyTypes.NeonScout(sx, sy, hpMult, this.diffConfig);
        break;
      case 'drone':
      default:
        enemy = new EnemyTypes.SwarmDrone(sx, sy, hpMult);
        break;
    }

    this.enemies.push(enemy);
  }

  spawnElite() {
    // 依据当前相机视口矩形边界计算离屏生成位置 (外扩 100~140 世界单位)
    const { x: sx, y: sy } = this.getOffscreenSpawnPosition(100, 140);

    const affixes = ['berserk', 'shield', 'splitter'];
    const affix = affixes[Math.floor(Math.random() * affixes.length)];

    // 精英 HP 随时间增长：base HP × time HP scale × elite HP multiplier
    const minutes = this.elapsedTime / 60;
    const hpTimeScale = 1 + minutes * (this.diffConfig.hpScalePerMin || 0.16);
    const eliteMult = hpTimeScale * this.diffConfig.eliteHpMult;

    const elite = new EnemyTypes.RelicGolem(sx, sy, eliteMult);
    elite.isElite = true;
    elite.affix = affix;
    elite.radius = 32;
    elite.expValue = 40;

    if (affix === 'berserk') {
      elite.speed *= 1.35;
      elite.color = '#ff0033';
    } else if (affix === 'shield') {
      elite.shieldHp = Math.round(this.diffConfig.eliteShieldHp * hpTimeScale);
      elite.maxShield = elite.shieldHp;
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

  // 浮动伤害数字 (仅负责视觉渲染，统计数据已由 takeDamage 统一完成)
  spawnDamageText(x, y, amount, isCrit, color) {
    if (this.damageTexts.length >= 25) {
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

  // 粒子火花 (手机端预算 120，桌面端预算 250)
  spawnSparks(x, y, color, count = 6) {
    const isMobile = this.isMobileDevice || (this.camera && this.camera.width < 768);
    const maxParticles = isMobile ? 120 : 250;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= maxParticles) this.particles.shift();
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

  // 冲击波光圈 (分级淘汰预算：保护 Boss 入场/践踏与超新星等重要事件)
  spawnShockwave(x, y, maxRadius, color, priority = false) {
    const isMobile = this.isMobileDevice || (this.camera && this.camera.width < 768);
    const maxShockwaves = isMobile ? 20 : 35;

    if (this.shockwaves.length >= maxShockwaves) {
      // 优先淘汰非高优先级的次级冲击波
      const nonPriorityIdx = this.shockwaves.findIndex(sw => !sw.priority);
      if (nonPriorityIdx !== -1) {
        this.shockwaves.splice(nonPriorityIdx, 1);
      } else if (priority) {
        this.shockwaves.shift();
      } else {
        return;
      }
    }

    this.shockwaves.push({
      x: x,
      y: y,
      radius: 5,
      maxRadius: maxRadius,
      color: color,
      priority: priority,
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
    this.pauseReasons.add('upgrade');
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
      }, { once: true });
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
      // 真正实现全屏冲击波清退敌人 (对周身 260px 范围内的存活敌人施加小幅击退，遵照击退抗性)
      const valid = this.enemies.filter(e => e && !e.isDead);
      for (const e of valid) {
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d < 260 && d > 1) {
          const ang = Math.atan2(e.y - this.player.y, e.x - this.player.x);
          const force = 180 * (1 - d / 260);
          if (typeof e.applyKnockback === 'function') {
            e.applyKnockback(Math.cos(ang) * force, Math.sin(ang) * force);
          } else {
            e.vx += Math.cos(ang) * force;
            e.vy += Math.sin(ang) * force;
          }
        }
      }
    }

    // 触发品质专属附加加成 (如史诗/稀有赠送的生命恢复与按等级动态挂钩的即时经验)
    if (card.bonus) {
      if (card.bonus.healPercent > 0) {
        this.player.heal(this.player.maxHp * card.bonus.healPercent);
        this.spawnShockwave(this.player.x, this.player.y, 140, '#00f0ff');
      }
      if (card.bonus.expPercent > 0) {
        const bonusExp = Math.max(1, Math.round(this.player.nextLevelExp * card.bonus.expPercent));
        this.player.addExp(bonusExp, () => this.openUpgradeModal());
      } else if (card.bonus.exp > 0) {
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
      this.pauseReasons.delete('upgrade');
      if (document.hidden) this.pauseReasons.add('system_blur');
      this.state = this.pauseReasons.size > 0 ? 'paused' : 'playing';
      if (this.state === 'paused') document.getElementById('modal-pause')?.classList.add('active');
      this.lastTime = performance.now();
      // 赋予升级弹窗关闭后的防秒杀安全缓冲时间 (默认休闲模式0.85s)
      this.player.grantInvulnerability(this.diffConfig.upgradeGracePeriod);
    }
  }

  // 游戏结束与战报
  gameOver(isVictory) {
    this.pauseReasons.clear();
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
    const totalBossKills = parseInt(localStorage.getItem('nr_boss_kills') || '0', 10) + (isVictory ? 1 : 0);
    localStorage.setItem('nr_boss_kills', totalBossKills.toString());

    const prevBestLevel = parseInt(localStorage.getItem('nr_best_level') || '1', 10);
    const bestLevel = Math.max(prevBestLevel, this.player.level);
    localStorage.setItem('nr_best_level', bestLevel.toString());

    const prevTotalKills = parseInt(localStorage.getItem('nr_total_kills') || '0', 10);
    const newTotalKills = prevTotalKills + (this.stats.kills || 0);
    localStorage.setItem('nr_total_kills', newTotalKills.toString());

    const titleEl = document.getElementById('gameover-title');
    if (titleEl) {
      titleEl.textContent = isVictory ? '遗迹征服！VICTORY' : '核心过载 DEFEAT';
      titleEl.style.color = isVictory ? '#00f0ff' : '#ff0055';
    }
    const statTimeEl = document.getElementById('stat-time');
    if (statTimeEl) statTimeEl.textContent = this.formatTime(this.elapsedTime);
    const statLevelEl = document.getElementById('stat-level');
    if (statLevelEl) statLevelEl.textContent = `Lv.${this.player.level}`;
    const statKillsEl = document.getElementById('stat-kills');
    if (statKillsEl) statKillsEl.textContent = this.stats.kills;
    const statDamageEl = document.getElementById('stat-damage');
    if (statDamageEl) statDamageEl.textContent = Math.round(this.stats.totalDamage);
    const statHitEl = document.getElementById('stat-highest-hit');
    if (statHitEl) statHitEl.textContent = this.stats.highestHit;
    const statMvpEl = document.getElementById('stat-mvp');
    if (statMvpEl) statMvpEl.textContent = mvpWeapon;
    const statDiffEl = document.getElementById('stat-difficulty');
    if (statDiffEl) statDiffEl.textContent = this.diffConfig ? this.diffConfig.name : this.difficulty.toUpperCase();
    const statBestLevelEl = document.getElementById('stat-best-level');
    if (statBestLevelEl) statBestLevelEl.textContent = `Lv.${bestLevel}`;
    const statTotalKillsEl = document.getElementById('stat-total-kills');
    if (statTotalKillsEl) statTotalKillsEl.textContent = newTotalKills;

    const seedEl = document.getElementById('gameover-seed');
    if (seedEl) seedEl.style.display = 'none';

    // 战术武器伤害分布占比
    const wStatsEl = document.getElementById('gameover-weapon-stats');
    if (wStatsEl) {
      wStatsEl.innerHTML = '';
      const totalDmg = Math.max(1, this.stats.totalDamage || 1);
      const activeWeapons = Object.values(this.weapons).filter(w => w.level > 0);
      activeWeapons.sort((a, b) => b.damageDealt - a.damageDealt);
      for (const w of activeWeapons) {
        const pct = Math.min(100, Math.round((w.damageDealt / totalDmg) * 100));
        const row = document.createElement('div');
        row.className = 'ws-row';
        row.innerHTML = `
          <span class="ws-name">${w.icon} ${w.name}</span>
          <div class="ws-bar-bg"><div class="ws-bar-fill" style="width:${pct}%"></div></div>
          <span class="ws-val">${Math.round(w.damageDealt)} (${pct}%)</span>
        `;
        wStatsEl.appendChild(row);
      }
    }

    // 最终协议构筑
    const buildWrap = document.getElementById('final-build-items');
    if (buildWrap) {
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

  // 底部装备栏更新 (同时展示已装备的武器与已获取的被动)
  updateHUDBuild() {
    const buildView = document.getElementById('build-quick-view');
    if (!buildView) return;
    buildView.innerHTML = '';

    let hasWeapons = false;
    for (const w of Object.values(this.weapons)) {
      if (w.level > 0) {
        hasWeapons = true;
        const chip = document.createElement('div');
        chip.className = `weapon-chip ${w.isEvolved ? 'evolved' : ''}`;
        chip.title = `${w.name} Lv.${w.level}`;
        chip.innerHTML = `${w.icon}<span class="chip-level">${w.isEvolved ? '★' : w.level}</span>`;
        buildView.appendChild(chip);
      }
    }

    let hasPassives = false;
    const passiveEntries = Object.entries(this.passives).filter(([_, p]) => p && p.level > 0);
    if (hasWeapons && passiveEntries.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'dock-divider';
      buildView.appendChild(divider);
    }

    for (const [id, p] of passiveEntries) {
      const def = this.upgradeSystem.passiveDefs[id];
      if (def) {
        hasPassives = true;
        const chip = document.createElement('div');
        chip.className = 'weapon-chip passive';
        chip.title = `${def.name} Lv.${p.level}`;
        chip.innerHTML = `${def.icon}<span class="chip-level">${p.level}</span>`;
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

window.Game = Game;

window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
  window.game = window.gameInstance;
});
