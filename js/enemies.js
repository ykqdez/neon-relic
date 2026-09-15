/**
 * 《霓虹遗迹 Neon Relic》- 敌人、精英怪与多阶段 Boss 体系
 * 6 种差异化普通怪 + 3 种精英词缀 + 多阶段机制 Boss「遗迹泰坦」
 */

class BaseEnemy {
  constructor(x, y, stats) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = stats.radius || 12;
    this.maxHp = stats.hp || 30;
    this.hp = this.maxHp;
    this.speed = stats.speed || 80;
    this.damage = stats.damage || 10;
    this.expValue = stats.exp || 1;
    this.color = stats.color || '#ff3366';
    this.isDead = false;
    this.knockbackResistance = stats.knockbackResistance || 0;

    this.hurtTimer = 0;
    this.animTime = Math.random() * 10;

    // 精英与词缀属性
    this.isElite = stats.isElite || false;
    this.affix = stats.affix || null; // 'berserk', 'shield', 'splitter'
    this.shieldHp = stats.shieldHp || 0;
    this.maxShield = this.shieldHp;

    // Boss 标记
    this.isBoss = false;
  }

  takeDamage(amount, isCrit, pool) {
    if (this.isDead) return true;

    let remaining = amount;
    // 护盾词缀优先吸收伤害 (支持溢出伤害 overflow damage)
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, remaining);
      this.shieldHp -= absorbed;
      remaining -= absorbed;
      if (pool && pool.spawnDamageText) {
        pool.spawnDamageText(this.x, this.y - this.radius, absorbed, false, '#00f0ff');
      }
      if (this.shieldHp <= 0) {
        this.shieldHp = 0;
        if (pool && pool.spawnShockwave) {
          pool.spawnShockwave(this.x, this.y, 40, '#00f0ff');
        }
      }
      if (remaining <= 0) {
        return false;
      }
    }

    this.hp -= remaining;
    this.hurtTimer = 0.12;

    // 弹出浮动伤害数字
    if (pool && pool.spawnDamageText) {
      pool.spawnDamageText(this.x, this.y - this.radius, remaining, isCrit, isCrit ? '#ffaa00' : '#ffffff');
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      if (window.soundSystem) window.soundSystem.playExplosion(this.isElite || this.isBoss);
      pool.spawnSparks(this.x, this.y, this.color, this.isElite ? 18 : 8);
      return true;
    }
    return false;
  }

  // 统一击退计算：effectiveKnockback = baseKnockback * (1 - clamp(knockbackResistance, 0, 1))
  applyKnockback(vx, vy) {
    if (this.isDead) return;
    const res = Math.max(0, Math.min(1, this.knockbackResistance || 0));
    const factor = 1 - res;
    if (factor <= 0) return;
    this.vx += vx * factor;
    this.vy += vy * factor;
  }

  // 统一位置牵引位移 (如黑洞吸力)
  applyDisplacement(dx, dy) {
    if (this.isDead) return;
    const res = Math.max(0, Math.min(1, this.knockbackResistance || 0));
    const factor = 1 - res;
    if (factor <= 0) return;
    this.x += dx * factor;
    this.y += dy * factor;
  }

  updateCommon(dt) {
    this.animTime += dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    // 击退速度阻尼衰减
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(0.05, dt);
    this.vy *= Math.pow(0.05, dt);
  }
}

// 1. 蜂群工蜂 (Swarm Drone): 基础直线跟踪，鲜明锐角三角体
class SwarmDrone extends BaseEnemy {
  constructor(x, y, multiplier = 1) {
    super(x, y, {
      radius: 13,
      hp: Math.round(35 * multiplier),
      speed: 85,
      damage: 10,
      exp: 1,
      color: '#ff2a55'
    });
  }

  update(dt, player, enemies, bullets) {
    this.updateCommon(dt);
    if (this.isDead) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const angle = this.animTime * 2.5;
    ctx.rotate(angle);

    // 锐利三角形轮廓
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.2, 0);
    ctx.lineTo(-this.radius * 0.8, -this.radius * 0.8);
    ctx.lineTo(-this.radius * 0.4, 0);
    ctx.lineTo(-this.radius * 0.8, this.radius * 0.8);
    ctx.closePath();

    ctx.fillStyle = this.hurtTimer > 0 ? '#ffffff' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fill();

    // 核心亮斑
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}

// 2. 霓虹侦察兵 (Neon Scout): 极速S形波浪包抄，双翼箭头飞梭
class NeonScout extends BaseEnemy {
  constructor(x, y, multiplier = 1, diffConfig = null) {
    const scoutSpeed = (diffConfig && diffConfig.scoutSpeed) ? diffConfig.scoutSpeed : 160;
    super(x, y, {
      radius: 12,
      hp: Math.round(20 * multiplier),
      speed: scoutSpeed,
      damage: 7,
      exp: 1,
      color: '#00ffff'
    });
    this.waveSeed = Math.random() * 100;
    this.facing = 0;
  }

  update(dt, player, enemies, bullets) {
    this.updateCommon(dt);
    if (this.isDead) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;
      const px = -ny;
      const py = nx;
      const wave = Math.sin(this.animTime * 7 + this.waveSeed) * 0.65;

      const finalVx = nx + px * wave;
      const finalVy = ny + py * wave;
      const len = Math.hypot(finalVx, finalVy);

      this.x += (finalVx / len) * this.speed * dt;
      this.y += (finalVy / len) * this.speed * dt;
      this.facing = Math.atan2(finalVy, finalVx);
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facing);

    // 飞梭双翼箭头轮廓
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.3, 0);
    ctx.lineTo(-this.radius * 0.9, -this.radius * 0.9);
    ctx.lineTo(-this.radius * 0.3, 0);
    ctx.lineTo(-this.radius * 0.9, this.radius * 0.9);
    ctx.closePath();

    ctx.fillStyle = this.hurtTimer > 0 ? '#ffffff' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fill();

    // 能量尾迹线
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.3, 0);
    ctx.lineTo(-this.radius * 1.4, 0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

// 3. 遗迹巨灵 (Relic Golem): 高生命、慢速、抗击退，重装六边形堡垒
class RelicGolem extends BaseEnemy {
  constructor(x, y, multiplier = 1) {
    super(x, y, {
      radius: 24,
      hp: Math.round(190 * multiplier),
      speed: 45,
      damage: 22,
      exp: 3,
      color: '#ff8800',
      knockbackResistance: 0.75
    });
  }

  update(dt, player, enemies, bullets) {
    this.updateCommon(dt);
    if (this.isDead) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 六边形重装外甲
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * this.radius;
      const py = Math.sin(a) * this.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = this.hurtTimer > 0 ? '#ffffff' : '#221406';
    ctx.fill();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.stroke();

    // 内层装甲缝隙
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + (Math.PI / 6);
      const px = Math.cos(a) * (this.radius * 0.65);
      const py = Math.sin(a) * (this.radius * 0.65);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 内部高能反应核
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  }
}

// 4. 棱镜射手 (Prism Sniper): 保持安全距离、带有长炮口的菱形聚能狙击
class PrismSniper extends BaseEnemy {
  constructor(x, y, multiplier = 1, diffConfig = null) {
    super(x, y, {
      radius: 16,
      hp: Math.round(55 * multiplier),
      speed: 68,
      damage: 12,
      exp: 2,
      color: '#b026ff'
    });
    this.diffConfig = diffConfig;
    this.aimDuration = (diffConfig && diffConfig.sniperAimTime !== undefined) ? diffConfig.sniperAimTime : 1.0;
    this.bulletSpeed = (diffConfig && diffConfig.sniperBulletSpeed !== undefined) ? diffConfig.sniperBulletSpeed : 270;
    this.shootTimer = 2.5;
    this.aimTimer = 0;
    this.aimAngle = 0;
  }

  update(dt, player, enemies, bullets) {
    this.updateCommon(dt);
    if (this.isDead) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // 维持安全交火距离 (添加 dist > 1e-4 严格守卫，防止重合时产生 NaN)
    if (dist > 1e-4) {
      if (dist < 190) {
        this.x -= (dx / dist) * this.speed * dt;
        this.y -= (dy / dist) * this.speed * dt;
      } else if (dist > 280) {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
      }
    }

    this.shootTimer -= dt;
    if (this.shootTimer <= this.aimDuration) {
      // 瞄准锁定时间 (Dodge Window)：开火前固定时间停止跟踪，给予玩家走位闪避的窗口
      const lockWindow = (this.diffConfig && this.diffConfig.sniperLockTime !== undefined)
        ? this.diffConfig.sniperLockTime
        : 0.35;

      if (this.shootTimer > lockWindow) {
        this.aimAngle = Math.atan2(dy, dx);
        this.isAimLocked = false;
      } else {
        // 进入锁定倒计时，冻结瞄准角，不再随玩家位移旋转
        this.isAimLocked = true;
      }
      this.aimTimer += dt;

      if (this.shootTimer <= 0) {
        this.shootTimer = 3.2;
        this.aimTimer = 0;
        this.isAimLocked = false;
        if (bullets) {
          bullets.push({
            x: this.x + Math.cos(this.aimAngle) * (this.radius * 1.5),
            y: this.y + Math.sin(this.aimAngle) * (this.radius * 1.5),
            vx: Math.cos(this.aimAngle) * this.bulletSpeed,
            vy: Math.sin(this.aimAngle) * this.bulletSpeed,
            radius: 6,
            damage: 16,
            life: 3.5,
            color: '#b026ff'
          });
        }
      }
    }
  }

  render(ctx) {
    // 瞄准激光瞄准线 (锁定阶段变为高亮刺目实线，提示玩家走位闪避)
    if (this.shootTimer <= this.aimDuration && !this.isDead) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.aimAngle) * 450, this.y + Math.sin(this.aimAngle) * 450);
      if (this.isAimLocked) {
        ctx.strokeStyle = 'rgba(255, 0, 100, 0.95)';
        ctx.lineWidth = 2.4;
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 10;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = 'rgba(255, 0, 80, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 5]);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aimAngle || 0);

    // 前端延伸炮口
    ctx.beginPath();
    ctx.rect(this.radius * 0.5, -3, this.radius * 0.9, 6);
    ctx.fillStyle = '#1c0828';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // 菱形机体身躯
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.1, 0);
    ctx.lineTo(0, -this.radius * 0.9);
    ctx.lineTo(-this.radius * 1.1, 0);
    ctx.lineTo(0, this.radius * 0.9);
    ctx.closePath();

    ctx.fillStyle = this.hurtTimer > 0 ? '#ffffff' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fill();

    // 瞄准镜高亮核心
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}

// 5. 裂变原体 (Fission Core): 旋转双核原体，阵亡分裂为两个子核
class FissionCore extends BaseEnemy {
  constructor(x, y, multiplier = 1, isChild = false) {
    super(x, y, {
      radius: isChild ? 10 : 17,
      hp: Math.round((isChild ? 18 : 75) * multiplier),
      speed: isChild ? 125 : 68,
      damage: isChild ? 6 : 14,
      exp: isChild ? 1 : 2,
      color: isChild ? '#39ff14' : '#00ffaa'
    });
    this.isChild = isChild;
  }

  update(dt, player, enemies, bullets) {
    this.updateCommon(dt);
    if (this.isDead) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.isChild) {
      // 微型子核
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.hurtTimer > 0 ? '#ffffff' : this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.fill();
    } else {
      // 旋转双核结构 (两个互旋的原生质球)
      const rot = this.animTime * 3.5;
      const orbOffset = this.radius * 0.55;

      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * 1.2, this.radius * 0.7, rot, 0, Math.PI * 2);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 双核 A & B
      const x1 = Math.cos(rot) * orbOffset;
      const y1 = Math.sin(rot) * orbOffset;
      ctx.beginPath();
      ctx.arc(x1, y1, this.radius * 0.55, 0, Math.PI * 2);
      ctx.arc(-x1, -y1, this.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = this.hurtTimer > 0 ? '#ffffff' : this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fill();

      // 连接能量索
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(-x1, -y1);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// 6. 突刺冲锋者 (Charge Striker): 尖锥长矛轮廓，极速突刺穿透
class ChargeStriker extends BaseEnemy {
  constructor(x, y, multiplier = 1, diffConfig = null) {
    super(x, y, {
      radius: 15,
      hp: Math.round(60 * multiplier),
      speed: 70,
      damage: 18,
      exp: 2,
      color: '#ff007f'
    });
    this.diffConfig = diffConfig;
    this.aimDuration = (diffConfig && diffConfig.strikerAimTime !== undefined) ? diffConfig.strikerAimTime : 0.8;
    this.dashSpeed = (diffConfig && diffConfig.strikerDashSpeed !== undefined) ? diffConfig.strikerDashSpeed : 390;
    this.state = 'walk';
    this.stateTimer = 2.0;
    this.dashAngle = 0;
  }

  update(dt, player, enemies, bullets) {
    this.updateCommon(dt);
    if (this.isDead) return;

    this.stateTimer -= dt;

    if (this.state === 'walk') {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
      }
      if (this.stateTimer <= 0 && dist < 290) {
        this.state = 'charge_aim';
        this.stateTimer = this.aimDuration;
        this.dashAngle = Math.atan2(dy, dx);
      }
    } else if (this.state === 'charge_aim') {
      if (this.stateTimer <= 0) {
        this.state = 'dashing';
        this.stateTimer = 0.52;
      }
    } else if (this.state === 'dashing') {
      const dashSpeed = this.dashSpeed;
      this.x += Math.cos(this.dashAngle) * dashSpeed * dt;
      this.y += Math.sin(this.dashAngle) * dashSpeed * dt;

      if (this.stateTimer <= 0) {
        this.state = 'cooldown';
        this.stateTimer = 1.8;
      }
    } else if (this.state === 'cooldown') {
      if (this.stateTimer <= 0) {
        this.state = 'walk';
        this.stateTimer = 2.2;
      }
    }
  }

  render(ctx) {
    // 蓄力红线预警
    if (this.state === 'charge_aim' && !this.isDead) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.dashAngle) * 260, this.y + Math.sin(this.dashAngle) * 260);
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    const angle = this.state === 'dashing' || this.state === 'charge_aim' ? this.dashAngle : this.animTime * 3;
    ctx.rotate(angle);

    // 尖长矛 / 尖锥轮廓
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.8, 0);
    ctx.lineTo(-this.radius * 0.8, -this.radius * 0.8);
    ctx.lineTo(-this.radius * 0.3, 0);
    ctx.lineTo(-this.radius * 0.8, this.radius * 0.8);
    ctx.closePath();

    ctx.fillStyle = this.hurtTimer > 0 ? '#ffffff' : (this.state === 'dashing' ? '#ffea00' : this.color);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fill();

    // 矛尖高能亮线
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.radius * 1.7, 0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

// 7. Boss:「遗迹泰坦 AETHEL-TITAN」
class BossTitan extends BaseEnemy {
  constructor(x, y, multiplier = 1, diffConfig = null) {
    const baseHp = (diffConfig && diffConfig.bossHp !== undefined) ? diffConfig.bossHp : 2800;
    super(x, y, {
      radius: 46,
      hp: Math.round(baseHp * multiplier),
      speed: 55,
      damage: 28,
      exp: 100,
      color: '#ff0055',
      knockbackResistance: 1.0,
      isBoss: true
    });
    this.diffConfig = diffConfig;
    this.hazardTimerDuration = (diffConfig && diffConfig.bossHazardTimer !== undefined) ? diffConfig.bossHazardTimer : 1.2;
    this.bulletSpeedMult = (diffConfig && diffConfig.bossBulletSpeedMult !== undefined) ? diffConfig.bossBulletSpeedMult : 1.0;
    this.isBoss = true;
    this.phase = 1; // 1, 2, 3
    this.attackTimer = 2.0;
    this.ringAngle = 0;
    this.hazardZones = []; // 地面危险红圈
  }

  update(dt, player, enemies, bullets, pool) {
    this.updateCommon(dt);
    if (this.isDead) return;

    const hpPercent = this.hp / this.maxHp;
    if (hpPercent <= 0.33) {
      this.phase = 3;
      this.speed = 85;
    } else if (hpPercent <= 0.66) {
      this.phase = 2;
      this.speed = 65;
    } else {
      this.phase = 1;
      this.speed = 52;
    }

    // 更新地面危险区
    for (let i = this.hazardZones.length - 1; i >= 0; i--) {
      const hz = this.hazardZones[i];
      hz.timer -= dt;
      if (hz.timer <= 0) {
        // 危险区引爆 (应用统一敌方伤害倍率)
        pool.spawnShockwave(hz.x, hz.y, hz.radius, '#ff0055');
        const pDist = Math.hypot(player.x - hz.x, player.y - hz.y);
        if (pDist < hz.radius + player.radius) {
          const dmgMult = (this.diffConfig && this.diffConfig.enemyDamageMult !== undefined) ? this.diffConfig.enemyDamageMult : 1.0;
          player.takeDamage(Math.round(32 * dmgMult));
        }
        this.hazardZones.splice(i, 1);
      }
    }

    // 移动逼近玩家
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }

    // 技能循环
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.executeAttack(player, enemies, bullets, pool);
    }
  }

  executeAttack(player, enemies, bullets, pool) {
    if (this.phase === 1) {
      // 阶段一：几何环形弹幕 (8~12发，留有安全缺口)
      this.attackTimer = 3.0;
      const count = 10;
      this.ringAngle += 0.3;
      for (let i = 0; i < count; i++) {
        // 故意漏掉一个缺口供玩家穿梭躲避
        if (i === 4) continue;
        const a = this.ringAngle + (i / count) * Math.PI * 2;
        bullets.push({
          x: this.x,
          y: this.y,
          vx: Math.cos(a) * 160 * this.bulletSpeedMult,
          vy: Math.sin(a) * 160 * this.bulletSpeedMult,
          radius: 7,
          damage: 16,
          life: 4.5,
          color: '#ffaa00'
        });
      }
    } else if (this.phase === 2) {
      // 阶段二：召唤突袭工蜂 + 交叉弹幕 (按 Boss 时间动态缩放 HP，且严格受总怪数上限约束)
      this.attackTimer = 3.8;
      const minutes = (pool && pool.elapsedTime) ? (pool.elapsedTime / 60) : 8;
      const hpScale = (this.diffConfig && this.diffConfig.hpScalePerMin !== undefined) ? this.diffConfig.hpScalePerMin : 0.16;
      const timeScale = 1 + minutes * hpScale;
      const summonMult = Math.max(1.0, timeScale * 0.60); // 约为同时间常规工蜂的 60% HP
      const maxEnemies = (this.diffConfig && this.diffConfig.maxEnemies) ? Math.round(this.diffConfig.maxEnemies * 0.75) : 75;

      for (let i = 0; i < 3; i++) {
        if (pool && typeof pool.canSpawnEnemies === 'function') {
          if (!pool.canSpawnEnemies(1)) break;
        } else if (enemies.length >= maxEnemies) {
          break;
        }
        const sx = this.x + (Math.random() - 0.5) * 80;
        const sy = this.y + (Math.random() - 0.5) * 80;
        enemies.push(new SwarmDrone(sx, sy, summonMult));
      }
      // 瞄准玩家扇形 5 连发
      const baseAng = Math.atan2(player.y - this.y, player.x - this.x);
      for (let i = -2; i <= 2; i++) {
        const a = baseAng + i * 0.22;
        bullets.push({
          x: this.x,
          y: this.y,
          vx: Math.cos(a) * 210 * this.bulletSpeedMult,
          vy: Math.sin(a) * 210 * this.bulletSpeedMult,
          radius: 8,
          damage: 18,
          life: 4.0,
          color: '#ff007f'
        });
      }
    } else if (this.phase === 3) {
      // 阶段三：在玩家周围放置 2 个地面预警圈 + 狂暴环形弹
      this.attackTimer = 2.4;
      // 地面预警圈 (留足手机端反应走位时间)
      this.hazardZones.push({
        x: player.x + (Math.random() - 0.5) * 80,
        y: player.y + (Math.random() - 0.5) * 80,
        radius: 65,
        timer: this.hazardTimerDuration,
        maxTimer: this.hazardTimerDuration
      });
      // 8 向高速弹
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.2;
        bullets.push({
          x: this.x,
          y: this.y,
          vx: Math.cos(a) * 240 * this.bulletSpeedMult,
          vy: Math.sin(a) * 240 * this.bulletSpeedMult,
          radius: 9,
          damage: 22,
          life: 3.8,
          color: '#ff0055'
        });
      }
    }
  }

  render(ctx) {
    // 渲染地面危险预警圈
    for (const hz of this.hazardZones) {
      const p = 1 - (hz.timer / hz.maxTimer);
      ctx.save();
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 0, 85, ${0.15 + p * 0.35})`;
      ctx.fill();
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // 旋转外装甲齿轮
    ctx.rotate(this.animTime * 0.8);
    ctx.beginPath();
    const teeth = 12;
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 === 0 ? this.radius : this.radius - 8;
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = this.hurtTimer > 0 ? '#ffffff' : '#140510';
    ctx.fill();
    ctx.strokeStyle = this.phase === 3 ? '#ff0055' : (this.phase === 2 ? '#ff5500' : '#00f0ff');
    ctx.lineWidth = 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 18;
    ctx.stroke();

    // 泰坦巨核
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = this.phase === 3 ? '#ff0033' : '#ff00a0';
    ctx.fill();

    ctx.restore();
  }
}

window.EnemyTypes = {
  BaseEnemy,
  SwarmDrone,
  NeonScout,
  RelicGolem,
  PrismSniper,
  FissionCore,
  ChargeStriker,
  BossTitan
};
window.BaseEnemy = BaseEnemy;
window.BossTitan = BossTitan;
