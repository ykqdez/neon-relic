/**
 * 《霓虹遗迹 Neon Relic》- 原创武器与超级进化系统
 * 6 大基础武器 (Lv1-5) + 3 大超级进化形态 (附带独立音效、粒子与弹道机制)
 */

// 统一获取有效存活敌人 (严格排除已死亡敌人)
function getValidEnemies(enemies) {
  if (!enemies || enemies.length === 0) return [];
  return enemies.filter(e => e && !e.isDead);
}

class BaseWeapon {
  constructor(id, name, icon) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.level = 0; // 0 未解锁，1-5 等级，6 为进化形态
    this.isEvolved = false;
    this.timer = 0;
    this.baseCd = 1.0;
    this.damageDealt = 0;
    this.kills = 0;
  }

  getEffectiveCd(player) {
    const cdr = player.cooldownReduction || 0;
    return Math.max(0.15, this.baseCd * (1 - cdr));
  }

  calcDamage(baseVal, player) {
    const isCrit = Math.random() < player.critChance;
    let dmg = baseVal * player.attackDamage;
    if (isCrit) {
      dmg *= player.critDamage;
    }
    return { damage: Math.max(1, Math.round(dmg)), isCrit };
  }
}

// 1. 脉冲刃 (Pulse Blade) -> 进化: 光子幻刃 (Phantom Voidblade)
class PulseBlade extends BaseWeapon {
  constructor() {
    super('pulse_blade', '脉冲刃', '⚡');
    this.baseCd = 0.9;
    this.slashes = []; // 视觉挥砍队列
  }

  update(dt, player, enemies, pool) {
    if (this.level <= 0) return;

    // 更新挥击视觉
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.life -= dt;
      if (s.life <= 0) this.slashes.splice(i, 1);
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      const cd = this.getEffectiveCd(player);
      this.timer = Math.max(this.timer + cd, -cd);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    const valid = getValidEnemies(enemies);
    if (valid.length === 0) return;

    const count = this.isEvolved ? 5 : (this.level >= 5 ? 3 : (this.level >= 3 ? 2 : 1));
    const range = (this.isEvolved ? 180 : 130) * player.areaBonus;
    const baseDamage = this.isEvolved ? 68 : (22 + (this.level - 1) * 9);

    // 寻找最近的若干有效存活敌人 (严格排除已死亡敌人)
    const targets = valid
      .map(e => ({ enemy: e, dist: Math.hypot(e.x - player.x, e.y - player.y) }))
      .filter(item => item.dist <= range)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count);

    if (targets.length === 0) {
      this.timer = 0.1; // 暂无目标时快速重试检测
      return;
    }

    if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);

    targets.forEach((t, idx) => {
      const e = t.enemy;
      if (e.isDead) return;
      const angle = Math.atan2(e.y - player.y, e.x - player.x);
      const hitResult = this.calcDamage(baseDamage, player);

      // 生成斩击特效
      this.slashes.push({
        fromX: player.x,
        fromY: player.y,
        x: e.x,
        y: e.y,
        angle: angle + (Math.random() - 0.5) * 0.5,
        radius: (this.isEvolved ? 42 : 28) * player.areaBonus,
        life: 0.26,
        maxLife: 0.26,
        isEvolved: this.isEvolved
      });

      // 施加伤害
      const isDead = e.takeDamage(hitResult.damage, hitResult.isCrit, pool);
      this.damageDealt += hitResult.damage;
      if (isDead) this.kills++;

      // 统一击退计算 (遵照敌人击退抗性)
      const kb = this.isEvolved ? 80 : 40;
      e.applyKnockback(Math.cos(angle) * kb, Math.sin(angle) * kb);
    });
  }

  render(ctx) {
    window.PixelArt.weapon(ctx, this);
  }

  evolve() {
    this.isEvolved = true;
    this.name = '光子幻刃';
    this.icon = '🗡️';
    this.baseCd = 0.55;
  }
}

// 2. 电弧核心 (Arc Core) -> 进化: 天罚风暴 (Tempest Protocol)
class ArcCore extends BaseWeapon {
  constructor() {
    super('arc_core', '电弧核心', '⚡');
    this.baseCd = 1.35;
    this.chains = []; // 电弧视觉段
  }

  update(dt, player, enemies, pool) {
    if (this.level <= 0) return;

    for (let i = this.chains.length - 1; i >= 0; i--) {
      this.chains[i].life -= dt;
      if (this.chains[i].life <= 0) this.chains.splice(i, 1);
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      const cd = this.getEffectiveCd(player);
      this.timer = Math.max(this.timer + cd, -cd);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    const valid = getValidEnemies(enemies);
    if (valid.length === 0) return;

    if (this.isEvolved) {
      this.fireTempest(player, valid, pool);
      return;
    }

    const maxJumps = 3 + (this.level - 1);
    const jumpDist = (140 + this.level * 15) * player.areaBonus;
    const baseDamage = 18 + (this.level - 1) * 7;

    // 寻找起始目标 (从存活敌人中寻找)
    let currentPos = { x: player.x, y: player.y };
    const hitEnemies = new Set();
    const chainPoints = [{ x: player.x, y: player.y }];

    for (let jump = 0; jump < maxJumps; jump++) {
      let nearest = null;
      let minDist = jump === 0 ? 220 * player.areaBonus : jumpDist;

      for (const e of valid) {
        if (hitEnemies.has(e) || e.isDead) continue;
        const d = Math.hypot(e.x - currentPos.x, e.y - currentPos.y);
        if (d < minDist) {
          minDist = d;
          nearest = e;
        }
      }

      if (!nearest) break;

      hitEnemies.add(nearest);
      chainPoints.push({ x: nearest.x, y: nearest.y });
      currentPos = { x: nearest.x, y: nearest.y };

      const hit = this.calcDamage(baseDamage, player);
      const isDead = nearest.takeDamage(hit.damage, hit.isCrit, pool);
      this.damageDealt += hit.damage;
      if (isDead) this.kills++;
    }

    if (chainPoints.length > 1) {
      if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);
      this.chains.push({
        points: chainPoints,
        life: 0.14,
        maxLife: 0.14,
        color: '#00f0ff'
      });
    } else {
      this.timer = 0.1;
    }
  }

  // 进化形态：全屏天罚落雷 (严格排除已死亡敌人，使用 Fisher-Yates 无偏选择)
  fireTempest(player, enemies, pool) {
    const valid = getValidEnemies(enemies);
    if (valid.length === 0) return;

    if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);

    const strikes = Math.min(valid.length, 6);
    const shuffled = [...valid];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const targets = shuffled.slice(0, strikes);

    for (const e of targets) {
      if (e.isDead) continue;
      const hit = this.calcDamage(65, player);
      const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
      this.damageDealt += hit.damage;
      if (isDead) this.kills++;

      // 落雷闪电视觉
      this.chains.push({
        points: [
          { x: e.x + (Math.random() - 0.5) * 60, y: e.y - 350 },
          { x: e.x + (Math.random() - 0.5) * 30, y: e.y - 180 },
          { x: e.x, y: e.y }
        ],
        life: 0.22,
        maxLife: 0.22,
        color: '#b026ff',
        isBolt: true
      });

      // 扩散冲击波
      pool.spawnShockwave(e.x, e.y, 60, '#b026ff');
    }
  }

  render(ctx) {
    window.PixelArt.weapon(ctx, this);
  }

  evolve() {
    this.isEvolved = true;
    this.name = '天罚风暴';
    this.icon = '⛈️';
    this.baseCd = 0.95;
  }
}

// 3. 轨道卫星 (Orbital Satellites)
class OrbitalSatellites extends BaseWeapon {
  constructor() {
    super('orbital_satellites', '轨道卫星', '🪐');
    this.angle = 0;
    this.hitCooldowns = new Map(); // 防止对同一个怪每一帧都算伤害 (基于逻辑帧 dt 统一递减)
    this.barrierCooldowns = new Map(); // 进化形态力场连线伤害冷却 (基于逻辑帧 dt 统一递减)
    this.coreContacts = new Set();
    this.barrierContacts = new Set();
  }

  update(dt, player, enemies, pool) {
    if (this.level <= 0) return;

    // 统一战斗时钟：每个逻辑步在顶层推进一次命中与力场冷却，不随卫星数量或碰撞重复扣减
    const valid = getValidEnemies(enemies);
    const living = new Set(valid);
    for (const cooldowns of [this.hitCooldowns, this.barrierCooldowns]) {
      for (const [e, cd] of cooldowns) {
        if (!living.has(e)) cooldowns.delete(e);
        else cooldowns.set(e, Math.max(-dt, cd - dt));
      }
    }
    const previousCoreContacts = this.coreContacts;
    const previousBarrierContacts = this.barrierContacts;
    this.coreContacts = new Set();
    this.barrierContacts = new Set();
    if (valid.length === 0) return;

    const rotSpeed = (2.2 + (this.level >= 3 ? 0.8 : 0)) * (this.isEvolved ? 1.4 : 1.0);
    this.angle += dt * rotSpeed;

    const orbCount = this.isEvolved ? 6 : (2 + (this.level - 1));
    const radius = (70 + (this.level - 1) * 8) * player.areaBonus;
    const orbSize = this.isEvolved ? 10 : 7;
    const baseDamage = this.isEvolved ? 32 : (14 + (this.level - 1) * 4);

    const cdr = player.cooldownReduction || 0;
    const hitInterval = Math.max(0.12, 0.28 * (1 - cdr));
    const barrierInterval = Math.max(0.14, 0.32 * (1 - cdr));

    for (let i = 0; i < orbCount; i++) {
      const a = this.angle + (i * Math.PI * 2) / orbCount;
      const ox = player.x + Math.cos(a) * radius;
      const oy = player.y + Math.sin(a) * radius;

      // 卫星核心碰撞检测
      for (const e of valid) {
        if (e.isDead) continue;
        const d = Math.hypot(e.x - ox, e.y - oy);
        if (d < e.radius + orbSize) {
          this.coreContacts.add(e);
          const remaining = this.hitCooldowns.get(e) || 0;
          if (remaining <= 1e-9) {
            // 连续接触保留跨帧余量；离开后重入不补算空档伤害。
            this.hitCooldowns.set(e, hitInterval + (previousCoreContacts.has(e) ? remaining : 0));
            const hit = this.calcDamage(baseDamage, player);
            const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
            this.damageDealt += hit.damage;
            if (isDead) this.kills++;

            if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);
            if (pool && pool.spawnSparks) pool.spawnSparks(ox, oy, hit.isCrit ? '#ffaa00' : '#00f0ff', 4);
          }
        }
      }
    }

    // 进化形态：极光环垒 - 卫星之间的高能等离子护盾力场网 (Resonant Barrier)
    if (this.isEvolved) {
      for (const e of valid) {
        if (e.isDead) continue;
        const dToCenter = Math.hypot(e.x - player.x, e.y - player.y);
        if (Math.abs(dToCenter - radius) < e.radius + 12) {
          this.barrierContacts.add(e);
          const remaining = this.barrierCooldowns.get(e) || 0;
          if (remaining <= 1e-9) {
            this.barrierCooldowns.set(e, barrierInterval + (previousBarrierContacts.has(e) ? remaining : 0));
            if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);
            const hit = this.calcDamage(22, player);
            const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
            this.damageDealt += hit.damage;
            if (isDead) this.kills++;
            if (pool && pool.spawnSparks) pool.spawnSparks(e.x, e.y, '#ff007f', 3);

            // 小幅阻退力场侵入者 (应用敌人击退抗性)
            const ang = Math.atan2(e.y - player.y, e.x - player.x);
            e.applyKnockback(Math.cos(ang) * 75, Math.sin(ang) * 75);
          }
        }
      }
    }
  }

  render(ctx, player) {
    window.PixelArt.weapon(ctx, this, player);
  }

  evolve() {
    this.isEvolved = true;
    this.name = '极光环垒';
    this.icon = '⚛️';
  }
}

// 4. 等离子炮 (Plasma Cannon)
class PlasmaCannon extends BaseWeapon {
  constructor() {
    super('plasma_cannon', '等离子炮', '💥');
    this.baseCd = 1.7;
    this.projectiles = [];
  }

  update(dt, player, enemies, pool) {
    if (this.level <= 0) return;

    // 更新飞行弹道
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      // 碰撞检测
      for (const e of enemies) {
        if (e.isDead || p.hitList.has(e)) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < e.radius + p.radius) {
          p.hitList.add(e);
          p.pierce--;

          const hit = this.calcDamage(p.damage, player);
          const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
          this.damageDealt += hit.damage;
          if (isDead) this.kills++;

          // 统一击退计算 (遵照敌人击退抗性)
          const kb = p.knockback || 110;
          e.applyKnockback(Math.cos(p.angle) * kb, Math.sin(p.angle) * kb);

          if (p.isEvolved) {
            if (pool && pool.spawnShockwave) pool.spawnShockwave(e.x, e.y, 45, '#39ff14');
            if (pool && pool.spawnSparks) pool.spawnSparks(p.x, p.y, '#39ff14', 8);
          } else {
            if (pool && pool.spawnSparks) pool.spawnSparks(p.x, p.y, '#39ff14', 6);
          }

          if (p.pierce <= 0) {
            p.life = 0;
            break;
          }
        }
      }

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      const cd = this.getEffectiveCd(player);
      this.timer = Math.max(this.timer + cd, -cd);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    let targetAngle = player.facingAngle;
    const valid = getValidEnemies(enemies);

    // 若附近有有效存活敌人，瞄准最近敌人
    if (valid.length > 0) {
      let nearest = null;
      let minD = 350;
      for (const e of valid) {
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < minD) {
          minD = d;
          nearest = e;
        }
      }
      if (nearest) {
        targetAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      }
    }

    if (this.isEvolved) {
      if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);
      // 湮灭重炮：3 枚高密反物质能量弹，无限穿透，强击退 320，触敌生成冲击波
      // 散角收束至 0.11，保证远距离 (300) 侧弹全量命中半径 46 的首领靶标
      const shotCount = 3;
      const spread = 0.11;
      const baseDamage = 92;
      const speed = 400;

      for (let i = 0; i < shotCount; i++) {
        const angle = targetAngle + (i - (shotCount - 1) / 2) * spread;
        this.projectiles.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          angle: angle,
          radius: 18 * player.areaBonus,
          damage: baseDamage,
          pierce: 9999,
          knockback: 320,
          life: 2.5,
          hitList: new Set(),
          isEvolved: true
        });
      }
      return;
    }

    const shotCount = this.level >= 5 ? 3 : (this.level >= 3 ? 2 : 1);
    const spread = 0.18;
    const baseDamage = 35 + (this.level - 1) * 12;
    const pierce = 2 + (this.level - 1) * 2;
    const speed = 360;

    if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);

    for (let i = 0; i < shotCount; i++) {
      const angle = targetAngle + (i - (shotCount - 1) / 2) * spread;
      this.projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle: angle,
        radius: 8 * player.areaBonus,
        damage: baseDamage,
        pierce: pierce,
        knockback: 110,
        life: 2.2,
        hitList: new Set(),
        isEvolved: false
      });
    }
  }

  render(ctx) {
    window.PixelArt.weapon(ctx, this);
  }

  evolve() {
    this.isEvolved = true;
    this.name = '湮灭重炮';
    this.icon = '🚀';
    this.baseCd = 1.0;
  }
}

// 5. 黑洞发生器 (Black Hole Generator) -> 进化: 坍缩超新星 (Collapsing Supernova)
class BlackHoleGenerator extends BaseWeapon {
  constructor() {
    super('black_hole', '黑洞发生器', '🕳️');
    this.baseCd = 3.8;
    this.holes = [];
  }

  update(dt, player, enemies, pool) {
    if (this.level <= 0) return;

    for (let i = this.holes.length - 1; i >= 0; i--) {
      const h = this.holes[i];
      const activeDt = Math.min(dt, Math.max(0, h.life));
      h.life = Math.max(0, h.life - dt);
      h.rotation += activeDt * 5;

      // 牵引范围内的敌人 (遵照敌人击退/位移抗性)
      for (const e of enemies) {
        if (e.isDead) continue;
        const dx = h.x - e.x;
        const dy = h.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < h.radius && dist > 5) {
          const pullForce = (h.pullStrength * (1 - dist / h.radius)) * activeDt;
          e.applyDisplacement((dx / dist) * pullForce, (dy / dist) * pullForce);
        }
      }

      // 周期性 DoT 伤害 (累加器，单帧最多补偿 4 次)
      h.tickTimer -= activeDt;
      let ticks = 0;
      while (activeDt > 0 && h.tickTimer <= 1e-9 && ticks < 4) {
        h.tickTimer += 0.25;
        ticks++;
        for (const e of enemies) {
          if (e.isDead) continue;
          const dist = Math.hypot(e.x - h.x, e.y - h.y);
          if (dist < h.radius * 0.75) {
            const hit = this.calcDamage(h.damage, player);
            const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
            this.damageDealt += hit.damage;
            if (isDead) this.kills++;
          }
        }
      }
      if (h.tickTimer <= 0) h.tickTimer = 0.25;

      // 消失时若是进化形态，释放超新星大爆炸
      if (h.life <= 0) {
        if (h.isEvolved) {
          this.triggerSupernova(h, player, enemies, pool);
        }
        this.holes.splice(i, 1);
      }
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      const cd = this.getEffectiveCd(player);
      this.timer = Math.max(this.timer + cd, -cd);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    let spawnX = player.x + (Math.random() - 0.5) * 160;
    let spawnY = player.y + (Math.random() - 0.5) * 160;

    // 尽量投放到存活敌人聚集处
    const valid = getValidEnemies(enemies);
    if (valid.length > 0) {
      const target = valid[Math.floor(Math.random() * valid.length)];
      spawnX = target.x;
      spawnY = target.y;
    }

    const duration = 2.2 + (this.level - 1) * 0.3;
    const radius = (65 + (this.level - 1) * 12) * player.areaBonus * (this.isEvolved ? 1.4 : 1.0);
    const damage = this.isEvolved ? 18 : (8 + (this.level - 1) * 3);
    const pull = this.isEvolved ? 160 : 90;

    if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);
    this.holes.push({
      x: spawnX,
      y: spawnY,
      radius: radius,
      pullStrength: pull,
      damage: damage,
      life: duration,
      maxLife: duration,
      rotation: 0,
      tickTimer: 0.2,
      isEvolved: this.isEvolved
    });
  }

  triggerSupernova(h, player, enemies, pool) {
    if (window.soundSystem) window.soundSystem.playExplosion(true);
    if (pool && pool.spawnShockwave) pool.spawnShockwave(h.x, h.y, h.radius * 1.6, '#ff007f', true);

    for (const e of enemies) {
      if (e.isDead) continue;
      const d = Math.hypot(e.x - h.x, e.y - h.y);
      if (d < h.radius * 1.5) {
        const hit = this.calcDamage(110, player);
        const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
        this.damageDealt += hit.damage;
        if (isDead) this.kills++;

        // 强击退 (应用抗性)
        const ang = Math.atan2(e.y - h.y, e.x - h.x);
        e.applyKnockback(Math.cos(ang) * 220, Math.sin(ang) * 220);
      }
    }
  }

  render(ctx) {
    window.PixelArt.weapon(ctx, this);
  }

  evolve() {
    this.isEvolved = true;
    this.name = '坍缩超新星';
    this.icon = '🌌';
    this.baseCd = 2.6;
  }
}

// 6. 棱镜射线 (Prism Ray) -> 进化: 超维裂隙 (Dimensional Rift)
class PrismRay extends BaseWeapon {
  constructor() {
    super('prism_ray', '棱镜射线', '🔦');
    this.baseCd = 2.6;
    this.beams = [];
  }

  update(dt, player, enemies, pool) {
    if (this.level <= 0) return;

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      const activeDt = Math.min(dt, Math.max(0, b.life));
      b.life = Math.max(0, b.life - dt);

      // 进化形态动态扫掠旋转
      if (b.rotSpeed) {
        b.angle += b.rotSpeed * activeDt;
      }

      // 激光持续判定 (tick 累加器，单帧最多补偿 4 次)
      b.tickTimer -= activeDt;
      let ticks = 0;
      while (activeDt > 0 && b.tickTimer <= 1e-9 && ticks < 4) {
        // 按 tick 的实际角度判断扫掠命中，避免使用帧末角度。
        const tickAngle = b.angle + (b.rotSpeed || 0) * b.tickTimer;
        b.tickTimer += 0.08;
        ticks++;
        const cos = Math.cos(tickAngle);
        const sin = Math.sin(tickAngle);

        for (const e of enemies) {
          if (e.isDead) continue;
          // 计算点到射线的投影距离
          const ex = e.x - b.x;
          const ey = e.y - b.y;
          const proj = ex * cos + ey * sin;
          if (proj > 0 && proj < b.length) {
            const perpDist = Math.abs(-sin * ex + cos * ey);
            if (perpDist < (b.width / 2) + e.radius) {
              const hit = this.calcDamage(b.damage, player);
              const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
              this.damageDealt += hit.damage;
              if (isDead) this.kills++;

              if (b.isEvolved) {
                if (pool && pool.spawnShockwave) pool.spawnShockwave(e.x, e.y, 24, '#ff007f');
                if (pool && pool.spawnSparks) pool.spawnSparks(e.x, e.y, '#ff007f', 3);
              } else {
                if (pool && pool.spawnSparks) pool.spawnSparks(e.x, e.y, '#00f0ff', 2);
              }
            }
          }
        }
      }
      if (b.tickTimer <= 0) b.tickTimer = 0.08;

      if (b.life <= 0) {
        this.beams.splice(i, 1);
      }
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      const cd = this.getEffectiveCd(player);
      this.timer = Math.max(this.timer + cd, -cd);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    let targetAngle = player.facingAngle;
    const valid = getValidEnemies(enemies);

    if (valid.length > 0) {
      let nearest = null;
      let minD = 400;
      for (const e of valid) {
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < minD) {
          minD = d;
          nearest = e;
        }
      }
      if (nearest) {
        targetAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      }
    }

    if (this.isEvolved) {
      if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);
      // 超维裂隙：3 道高能裂隙死光，持续 1.0s
      // 中央主光束锁定目标 (rotSpeed = 0)，左右两翼光束负责扇形扫场 (rotSpeed = ±1.3)
      const duration = 1.0;
      const width = 36 * player.areaBonus;
      const beamCount = 3;

      for (let i = 0; i < beamCount; i++) {
        let baseOffset = 0;
        let rotSpeed = 0;
        let damage = 50; // 中央锁定主光束：单体高能输出，确保 100/200/300 距离中心光束自身 DPS 达 260+，彻底根除负进化

        if (i === 0) {
          // 左翼扫掠死光
          baseOffset = -0.28;
          rotSpeed = -1.0;
          damage = 28;
        } else if (i === 2) {
          // 右翼扫掠死光
          baseOffset = +0.28;
          rotSpeed = +1.0;
          damage = 28;
        }

        this.beams.push({
          x: player.x,
          y: player.y,
          angle: targetAngle + baseOffset,
          rotSpeed: rotSpeed,
          width: i === 1 ? width : width * 0.85,
          length: 850,
          damage: damage,
          life: duration,
          maxLife: duration,
          tickTimer: 0,
          isEvolved: true
        });
      }
      return;
    }

    const duration = 0.45 + (this.level >= 5 ? 0.2 : 0);
    const width = (16 + (this.level - 1) * 3) * player.areaBonus;
    const baseDamage = 14 + (this.level - 1) * 5; // 每 tick 伤害

    if (window.soundSystem) window.soundSystem.playWeaponAttack(this.id, this.isEvolved);

    const beamCount = this.level >= 4 ? 2 : 1;
    for (let i = 0; i < beamCount; i++) {
      const offsetAngle = (i - (beamCount - 1) / 2) * 0.15;
      this.beams.push({
        x: player.x,
        y: player.y,
        angle: targetAngle + offsetAngle,
        rotSpeed: 0,
        width: width,
        length: 700,
        damage: baseDamage,
        life: duration,
        maxLife: duration,
        tickTimer: 0,
        isEvolved: false
      });
    }
  }

  render(ctx) {
    window.PixelArt.weapon(ctx, this);
  }

  evolve() {
    this.isEvolved = true;
    this.name = '超维裂隙';
    this.icon = '🔦';
    this.baseCd = 1.6;
  }
}

window.WeaponRegistry = {
  pulse_blade: PulseBlade,
  arc_core: ArcCore,
  orbital_satellites: OrbitalSatellites,
  plasma_cannon: PlasmaCannon,
  black_hole: BlackHoleGenerator,
  prism_ray: PrismRay
};
window.PulseBlade = PulseBlade;
window.ArcCore = ArcCore;
window.OrbitalSatellites = OrbitalSatellites;
window.PlasmaCannon = PlasmaCannon;
window.BlackHoleGenerator = BlackHoleGenerator;
window.PrismRay = PrismRay;
window.getValidEnemies = getValidEnemies;
