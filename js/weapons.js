/**
 * 《霓虹遗迹 Neon Relic》- 原创武器与超级进化系统
 * 6 大基础武器 (Lv1-5) + 3 大超级进化形态 (附带独立音效、粒子与弹道机制)
 */

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
    return Math.max(0.15, this.baseCd / player.attackSpeed);
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
      this.timer = this.getEffectiveCd(player);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    if (enemies.length === 0) return;

    const count = this.isEvolved ? 5 : (this.level >= 5 ? 3 : (this.level >= 3 ? 2 : 1));
    const range = (this.isEvolved ? 180 : 130) * player.areaBonus;
    const baseDamage = this.isEvolved ? 68 : (22 + (this.level - 1) * 9);

    // 寻找最近的若干敌人
    const targets = enemies
      .map(e => ({ enemy: e, dist: Math.hypot(e.x - player.x, e.y - player.y) }))
      .filter(item => item.dist <= range)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count);

    if (targets.length === 0) {
      this.timer = 0.1; // 暂无目标时快速重试检测
      return;
    }

    if (window.soundSystem) window.soundSystem.playSlash();

    targets.forEach((t, idx) => {
      const e = t.enemy;
      const angle = Math.atan2(e.y - player.y, e.x - player.x);
      const hitResult = this.calcDamage(baseDamage, player);

      // 生成斩击特效
      this.slashes.push({
        x: e.x,
        y: e.y,
        angle: angle + (Math.random() - 0.5) * 0.5,
        radius: (this.isEvolved ? 42 : 28) * player.areaBonus,
        life: 0.18,
        maxLife: 0.18,
        isEvolved: this.isEvolved
      });

      // 施加伤害
      const isDead = e.takeDamage(hitResult.damage, hitResult.isCrit, pool);
      this.damageDealt += hitResult.damage;
      if (isDead) this.kills++;

      // 击退微动
      e.vx += Math.cos(angle) * (this.isEvolved ? 80 : 40);
      e.vy += Math.sin(angle) * (this.isEvolved ? 80 : 40);
    });
  }

  render(ctx) {
    for (const s of this.slashes) {
      const progress = 1 - (s.life / s.maxLife);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      ctx.beginPath();
      ctx.arc(0, 0, s.radius, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.strokeStyle = s.isEvolved ? `rgba(255, 0, 127, ${1 - progress})` : `rgba(0, 240, 255, ${1 - progress})`;
      ctx.lineWidth = s.isEvolved ? 4 : 2.5;
      ctx.shadowColor = s.isEvolved ? '#ff007f' : '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.stroke();

      // 刃光十字
      ctx.beginPath();
      ctx.moveTo(-s.radius * 0.6, 0);
      ctx.lineTo(s.radius * 0.8, 0);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
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
      this.timer = this.getEffectiveCd(player);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    if (enemies.length === 0) return;

    if (this.isEvolved) {
      this.fireTempest(player, enemies, pool);
      return;
    }

    const maxJumps = 3 + (this.level - 1);
    const jumpDist = (140 + this.level * 15) * player.areaBonus;
    const baseDamage = 18 + (this.level - 1) * 7;

    // 寻找起始目标
    let currentPos = { x: player.x, y: player.y };
    const hitEnemies = new Set();
    const chainPoints = [{ x: player.x, y: player.y }];

    for (let jump = 0; jump < maxJumps; jump++) {
      let nearest = null;
      let minDist = jump === 0 ? 220 * player.areaBonus : jumpDist;

      for (const e of enemies) {
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
      if (window.soundSystem) window.soundSystem.playArc();
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

  // 进化形态：全屏天罚落雷
  fireTempest(player, enemies, pool) {
    if (window.soundSystem) window.soundSystem.playExplosion(true);

    const strikes = Math.min(enemies.length, 6);
    const shuffled = [...enemies].sort(() => 0.5 - Math.random()).slice(0, strikes);

    for (const e of shuffled) {
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
    for (const c of this.chains) {
      const alpha = c.life / c.maxLife;
      ctx.save();
      ctx.strokeStyle = c.color;
      ctx.lineWidth = c.isBolt ? 3.5 : 2;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      for (let i = 0; i < c.points.length; i++) {
        const pt = c.points[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else {
          // 随机闪电折线抖动
          const midX = (c.points[i - 1].x + pt.x) / 2 + (Math.random() - 0.5) * 12;
          const midY = (c.points[i - 1].y + pt.y) / 2 + (Math.random() - 0.5) * 12;
          ctx.lineTo(midX, midY);
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
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
    this.hitCooldowns = new WeakMap(); // 防止对同一个怪每一帧都算伤害
  }

  update(dt, player, enemies, pool) {
    if (this.level <= 0) return;

    const rotSpeed = (2.2 + (this.level >= 3 ? 0.8 : 0)) * (this.isEvolved ? 1.4 : 1.0);
    this.angle += dt * rotSpeed;

    const orbCount = this.isEvolved ? 6 : (2 + (this.level - 1));
    const radius = (70 + (this.level - 1) * 8) * player.areaBonus;
    const orbSize = this.isEvolved ? 10 : 7;
    const baseDamage = this.isEvolved ? 32 : (14 + (this.level - 1) * 4);

    const now = Date.now();

    for (let i = 0; i < orbCount; i++) {
      const a = this.angle + (i * Math.PI * 2) / orbCount;
      const ox = player.x + Math.cos(a) * radius;
      const oy = player.y + Math.sin(a) * radius;

      // 碰撞检测
      for (const e of enemies) {
        if (e.isDead) continue;
        const d = Math.hypot(e.x - ox, e.y - oy);
        if (d < e.radius + orbSize) {
          const lastHit = this.hitCooldowns.get(e) || 0;
          if (now - lastHit > 280) { // 0.28 秒攻击间隔
            this.hitCooldowns.set(e, now);
            const hit = this.calcDamage(baseDamage, player);
            const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
            this.damageDealt += hit.damage;
            if (isDead) this.kills++;

            if (window.soundSystem) window.soundSystem.playHit(hit.isCrit);
            pool.spawnSparks(ox, oy, hit.isCrit ? '#ffaa00' : '#00f0ff', 4);
          }
        }
      }
    }
  }

  render(ctx, player) {
    if (this.level <= 0) return;

    const orbCount = this.isEvolved ? 6 : (2 + (this.level - 1));
    const radius = (70 + (this.level - 1) * 8) * player.areaBonus;
    const orbSize = this.isEvolved ? 10 : 7;

    // 轨道环微光
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.isEvolved ? 'rgba(255, 0, 127, 0.18)' : 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (let i = 0; i < orbCount; i++) {
      const a = this.angle + (i * Math.PI * 2) / orbCount;
      const ox = player.x + Math.cos(a) * radius;
      const oy = player.y + Math.sin(a) * radius;

      ctx.beginPath();
      ctx.arc(ox, oy, orbSize, 0, Math.PI * 2);
      ctx.fillStyle = this.isEvolved ? '#ff007f' : '#00f0ff';
      ctx.shadowColor = this.isEvolved ? '#ff007f' : '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.fill();

      // 白色中心
      ctx.beginPath();
      ctx.arc(ox, oy, orbSize * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
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

          // 击退
          e.vx += Math.cos(p.angle) * 110;
          e.vy += Math.sin(p.angle) * 110;

          pool.spawnSparks(p.x, p.y, '#39ff14', 6);

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
      this.timer = this.getEffectiveCd(player);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    let targetAngle = player.facingAngle;
    // 若附近有敌人，瞄准最近敌人
    if (enemies.length > 0) {
      let nearest = null;
      let minD = 350;
      for (const e of enemies) {
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

    const shotCount = this.level >= 5 ? 3 : (this.level >= 3 ? 2 : 1);
    const spread = 0.18;
    const baseDamage = 35 + (this.level - 1) * 12;
    const pierce = 2 + (this.level - 1) * 2;
    const speed = 360;

    if (window.soundSystem) window.soundSystem.playShoot('plasma');

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
        life: 2.2,
        hitList: new Set()
      });
    }
  }

  render(ctx) {
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 1.8, p.radius, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 12;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 0.9, p.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }
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
      h.life -= dt;
      h.rotation += dt * 5;
      h.tickTimer -= dt;

      // 牵引范围内的敌人
      for (const e of enemies) {
        if (e.isDead) continue;
        const dx = h.x - e.x;
        const dy = h.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < h.radius && dist > 5) {
          const pullForce = (h.pullStrength * (1 - dist / h.radius)) * dt;
          e.x += (dx / dist) * pullForce;
          e.y += (dy / dist) * pullForce;
        }
      }

      // 周期性 DoT 伤害
      if (h.tickTimer <= 0) {
        h.tickTimer = 0.25;
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
      this.timer = this.getEffectiveCd(player);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    let spawnX = player.x + (Math.random() - 0.5) * 160;
    let spawnY = player.y + (Math.random() - 0.5) * 160;

    // 尽量投放到敌人聚集处
    if (enemies.length > 0) {
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      spawnX = target.x;
      spawnY = target.y;
    }

    const duration = 2.2 + (this.level - 1) * 0.3;
    const radius = (65 + (this.level - 1) * 12) * player.areaBonus * (this.isEvolved ? 1.4 : 1.0);
    const damage = this.isEvolved ? 18 : (8 + (this.level - 1) * 3);
    const pull = this.isEvolved ? 160 : 90;

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
    pool.spawnShockwave(h.x, h.y, h.radius * 1.6, '#ff007f');

    for (const e of enemies) {
      if (e.isDead) continue;
      const d = Math.hypot(e.x - h.x, e.y - h.y);
      if (d < h.radius * 1.5) {
        const hit = this.calcDamage(110, player);
        const isDead = e.takeDamage(hit.damage, hit.isCrit, pool);
        this.damageDealt += hit.damage;
        if (isDead) this.kills++;

        // 强击退
        const ang = Math.atan2(e.y - h.y, e.x - h.x);
        e.vx += Math.cos(ang) * 220;
        e.vy += Math.sin(ang) * 220;
      }
    }
  }

  render(ctx) {
    for (const h of this.holes) {
      ctx.save();
      ctx.translate(h.x, h.y);

      // 引力吸入光圈
      ctx.beginPath();
      ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
      ctx.strokeStyle = h.isEvolved ? 'rgba(255, 0, 127, 0.25)' : 'rgba(176, 38, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.stroke();

      // 旋转漩涡线
      ctx.rotate(h.rotation);
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        ctx.arc(0, 0, h.radius * 0.7, arm * (Math.PI * 2 / 3), arm * (Math.PI * 2 / 3) + Math.PI * 0.5);
        ctx.strokeStyle = h.isEvolved ? '#ff007f' : '#b026ff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // 黑色核心球
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#050711';
      ctx.shadowColor = h.isEvolved ? '#ff007f' : '#b026ff';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }
  }

  evolve() {
    this.isEvolved = true;
    this.name = '坍缩超新星';
    this.icon = '🌌';
    this.baseCd = 2.6;
  }
}

// 6. 棱镜射线 (Prism Ray)
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
      b.life -= dt;

      // 激光持续判定 (tick)
      b.tickTimer -= dt;
      if (b.tickTimer <= 0) {
        b.tickTimer = 0.08;
        const cos = Math.cos(b.angle);
        const sin = Math.sin(b.angle);

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
              pool.spawnSparks(e.x, e.y, '#00f0ff', 2);
            }
          }
        }
      }

      if (b.life <= 0) {
        this.beams.splice(i, 1);
      }
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.getEffectiveCd(player);
      this.fire(player, enemies, pool);
    }
  }

  fire(player, enemies, pool) {
    let targetAngle = player.facingAngle;
    if (enemies.length > 0) {
      let nearest = null;
      let minD = 400;
      for (const e of enemies) {
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

    const duration = 0.45 + (this.level >= 5 ? 0.2 : 0);
    const width = (16 + (this.level - 1) * 3) * player.areaBonus;
    const baseDamage = 14 + (this.level - 1) * 5; // 每 tick 伤害

    if (window.soundSystem) window.soundSystem.playShoot('laser');

    const beamCount = this.level >= 4 ? 2 : 1;
    for (let i = 0; i < beamCount; i++) {
      const offsetAngle = (i - (beamCount - 1) / 2) * 0.15;
      this.beams.push({
        x: player.x,
        y: player.y,
        angle: targetAngle + offsetAngle,
        width: width,
        length: 700,
        damage: baseDamage,
        life: duration,
        maxLife: duration,
        tickTimer: 0
      });
    }
  }

  render(ctx) {
    for (const b of this.beams) {
      const alpha = b.life / b.maxLife;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      // 外围激光光晕
      ctx.beginPath();
      ctx.rect(0, -b.width / 2, b.length, b.width);
      ctx.fillStyle = `rgba(0, 240, 255, ${alpha * 0.35})`;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 18;
      ctx.fill();

      // 核心高能白线
      ctx.beginPath();
      ctx.rect(0, -b.width * 0.2, b.length, b.width * 0.4);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.fill();

      ctx.restore();
    }
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
