/**
 * 《霓虹遗迹 Neon Relic》- 玩家机体与属性系统
 * 属性上限控制、收益递减、经验吸收与光环渲染
 */

class Player {
  constructor(x, y, diffConfig = null) {
    this.x = x;
    this.y = y;
    this.radius = 20; // 放大至 20px，保证在更广视野下依然清晰显眼
    this.facingAngle = 0;

    // 基础属性 (根据难度配置动态初始化)
    this.baseMaxHp = 100;
    this.maxHp = 100;
    this.hp = 100;
    this.baseSpeed = diffConfig ? diffConfig.playerBaseSpeed : 188;
    this.moveSpeed = this.baseSpeed;
    this.attackDamage = 1.0;
    this.attackSpeed = 1.0;
    this.critChance = 0.05;
    this.critDamage = 1.6;
    this.basePickupRange = diffConfig ? diffConfig.playerPickupRange : 105;
    this.pickupRange = this.basePickupRange;
    this.armor = 0;
    this.expBonus = 1.0;
    this.areaBonus = 1.0;
    this.cooldownReduction = 0;
    this.baseHpRegen = diffConfig ? diffConfig.playerHpRegen : 0.45;
    this.hpRegen = this.baseHpRegen;

    // 等级与经验 (升级队列支持多级连续升级)
    this.level = 1;
    this.currentExp = 0;
    this.nextLevelExp = 12;
    this.pendingUpgrades = 0;

    // 状态机制与安全缓冲期
    this.invulnerableTimer = 0;
    this.invulnerableDuration = diffConfig ? diffConfig.playerInvulDuration : 0.52;
    this.graceShieldTimer = 0; // 选卡/恢复后的安全护盾时间
    this.isDead = false;

    // 视觉动画参数
    this.rotationAngle = 0;
    this.hurtFlashTimer = 0;
    this.trailHistory = [];
  }

  // 获得安全无敌缓冲期 (如关闭升级弹窗、暂停恢复)
  grantInvulnerability(duration) {
    this.invulnerableTimer = Math.max(this.invulnerableTimer, duration);
    this.graceShieldTimer = Math.max(this.graceShieldTimer, duration);
  }

  // 经验升级需求公式 (平滑指数阶梯)
  calculateNextExp() {
    return Math.floor(12 * Math.pow(1.28, this.level - 1) + (this.level * 4));
  }

  // 接收经验晶体 (支持多级连续升级队列)
  addExp(amount, onLevelUp) {
    if (this.isDead) return;
    const finalExp = amount * this.expBonus;
    this.currentExp += finalExp;

    let levelsGained = 0;
    while (this.currentExp >= this.nextLevelExp) {
      this.currentExp -= this.nextLevelExp;
      this.level++;
      this.nextLevelExp = this.calculateNextExp();
      // 升级回复 15% 生命
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15);
      levelsGained++;
      this.pendingUpgrades++;
    }

    if (levelsGained > 0 && onLevelUp) {
      if (window.soundSystem) window.soundSystem.playLevelUp();
      onLevelUp();
    }
  }

  // 受到伤害 (护甲收益递减公式)
  takeDamage(amount) {
    if (this.isDead || this.invulnerableTimer > 0) return 0;

    // 减伤比例：DR = Armor / (Armor + 40)，上限 75%
    const effectiveArmor = Math.max(0, this.armor);
    const dr = Math.min(0.75, effectiveArmor / (effectiveArmor + 40));
    const finalDamage = Math.max(1, Math.round(amount * (1 - dr)));

    this.hp -= finalDamage;
    this.invulnerableTimer = this.invulnerableDuration;
    this.hurtFlashTimer = 0.2;

    if (window.soundSystem) window.soundSystem.playHurt();

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }

    return finalDamage;
  }

  // 生命恢复
  heal(amount) {
    if (this.isDead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // 重新结算被动属性 (严格保持文案与实际公式一致)
  recalculateStats(passives) {
    let hpMod = 0;
    let speedMod = 0;
    let cdMod = 0;
    let critChanceMod = 0;
    let critDmgMod = 0;
    let armorMod = 0;
    let pickupMod = 0;
    let expMod = 0;
    let areaMod = 0;
    let regenMod = 0;

    for (const [id, p] of Object.entries(passives)) {
      if (!p || p.level <= 0) continue;
      const lv = p.level;
      if (id === 'hp') {
        hpMod += lv * 0.20; // 每级 +20% 最大生命
        regenMod += lv * 0.35; // 量子核心真正生效：每级 +0.35 HP/s 自愈微流
      }
      if (id === 'speed') speedMod += lv * 0.08; // 每级 +8% 移速
      if (id === 'haste') cdMod += lv * 0.08; // 每级降低 8% 技能冷却时间 (最多 40%)
      if (id === 'crit') {
        critChanceMod += lv * 0.06; // 每级 +6% 暴击率
        critDmgMod += lv * 0.15; // 每级严格 +15% 暴击伤害
      }
      if (id === 'armor') armorMod += lv * 5; // 每级 +5 点护甲
      if (id === 'pickup') pickupMod += lv * 0.25; // 每级 +25% 拾取范围
      if (id === 'exp') expMod += lv * 0.15; // 每级 +15% 经验
      if (id === 'area') areaMod += lv * 0.16; // 每级 +16% 技能范围
    }

    const prevMax = this.maxHp;
    this.maxHp = Math.round(this.baseMaxHp * (1 + hpMod));
    // 生命上限提升时等比追加当前血量
    if (this.maxHp > prevMax) {
      this.hp += (this.maxHp - prevMax);
    }

    this.moveSpeed = (this.baseSpeed || 188) * (1 + speedMod);
    this.cooldownReduction = Math.min(0.40, cdMod);
    this.attackSpeed = Math.min(2.5, 1 / Math.max(0.60, 1 - this.cooldownReduction));
    this.critChance = Math.min(1.0, 0.05 + critChanceMod);
    this.critDamage = 1.6 + critDmgMod;
    this.pickupRange = (this.basePickupRange || 105) * (1 + pickupMod);
    this.armor = armorMod;
    this.expBonus = 1.0 + expMod;
    this.areaBonus = 1.0 + areaMod;
    this.hpRegen = (this.baseHpRegen !== undefined ? this.baseHpRegen : 0.45) + regenMod;
  }

  update(dt, inputVector, arenaBound) {
    if (this.isDead) return;

    // 无敌时间、受击红闪与安全护盾递减
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.hurtFlashTimer > 0) this.hurtFlashTimer -= dt;
    if (this.graceShieldTimer > 0) this.graceShieldTimer -= dt;

    // 自愈
    if (this.hpRegen > 0 && this.hp < this.maxHp) {
      this.heal(this.hpRegen * dt);
    }

    // 旋转视觉
    this.rotationAngle += dt * 2.5;

    // 移动计算
    if (inputVector.magnitude > 0) {
      const vx = inputVector.x * this.moveSpeed * inputVector.magnitude;
      const vy = inputVector.y * this.moveSpeed * inputVector.magnitude;

      this.x += vx * dt;
      this.y += vy * dt;

      // 设定面朝角度
      this.facingAngle = Math.atan2(inputVector.y, inputVector.x);

      // 记录残影
      this.trailHistory.push({ x: this.x, y: this.y, alpha: 0.6 });
      if (this.trailHistory.length > 6) {
        this.trailHistory.shift();
      }
    }

    // 衰减残影
    for (let i = 0; i < this.trailHistory.length; i++) {
      this.trailHistory[i].alpha -= dt * 3.5;
    }
    this.trailHistory = this.trailHistory.filter(t => t.alpha > 0);

    // 竞技场边界限制
    if (arenaBound) {
      this.x = Math.max(-arenaBound.halfWidth + this.radius, Math.min(arenaBound.halfWidth - this.radius, this.x));
      this.y = Math.max(-arenaBound.halfHeight + this.radius, Math.min(arenaBound.halfHeight - this.radius, this.y));
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. 绘制移动残影
    for (const trail of this.trailHistory) {
      ctx.save();
      ctx.translate(trail.x - this.x, trail.y - this.y);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 240, 255, ${trail.alpha * 0.25})`;
      ctx.fill();
      ctx.restore();
    }

    // 2. 拾取范围微光圈 (半透明呼吸效果)
    ctx.beginPath();
    ctx.arc(0, 0, this.pickupRange, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. 受伤闪白/闪红状态
    const isHurt = this.hurtFlashTimer > 0;
    const isInvul = this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0;

    if (!isInvul) {
      // 4. 外层旋转霓虹遗迹符文环 (外八边形/三芒星)
      ctx.save();
      ctx.rotate(this.rotationAngle);
      ctx.beginPath();
      const points = 6;
      for (let i = 0; i < points; i++) {
        const rad = (i / points) * Math.PI * 2;
        const px = Math.cos(rad) * (this.radius + 5);
        const py = Math.sin(rad) * (this.radius + 5);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = isHurt ? '#ff3366' : '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = isHurt ? '#ff0055' : '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      // 5. 内核能量球
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius);
      if (isHurt) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.6, '#ff0055');
        grad.addColorStop(1, '#880022');
      } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#00f0ff');
        grad.addColorStop(1, '#004488');
      }
      ctx.fillStyle = grad;
      ctx.shadowColor = isHurt ? '#ff0055' : '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.fill();

      // 6. 朝向指示箭头
      ctx.save();
      ctx.rotate(this.facingAngle);
      ctx.beginPath();
      ctx.moveTo(this.radius + 8, 0);
      ctx.lineTo(this.radius + 2, -4);
      ctx.lineTo(this.radius + 4, 0);
      ctx.lineTo(this.radius + 2, 4);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();

      // 7. 选卡/恢复安全无敌光环 (青蓝力场护盾)
      if (this.graceShieldTimer > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 240, 255, ${Math.min(0.9, this.graceShieldTimer * 1.5)})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

window.Player = Player;
