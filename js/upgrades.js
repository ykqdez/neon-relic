/**
 * 《霓虹遗迹 Neon Relic》- 升级、被动芯片与肉鸽三选一抽卡系统
 * 8 大被动能力、6 大武器、3 大终极武器进化判定与品质权重
 */

class UpgradeSystem {
  constructor() {
    // 8 种被动能力定义
    this.passiveDefs = {
      armor: {
        id: 'armor',
        name: '纳米装甲',
        icon: '🛡️',
        desc: '每级提高 5 点护甲，按收益递减公式减免所受伤害',
        maxLevel: 5
      },
      pickup: {
        id: 'pickup',
        name: '磁能发生器',
        icon: '🧲',
        desc: '每级扩大 25% 能量晶体自动吸附范围',
        maxLevel: 5
      },
      haste: {
        id: 'haste',
        name: '超频芯片',
        icon: '⚡',
        desc: '每级降低 8% 全武器技能冷却时间 (最高 40%，与电弧核心形成共鸣)',
        maxLevel: 5
      },
      crit: {
        id: 'crit',
        name: '聚焦透镜',
        icon: '🎯',
        desc: '每级提升 6% 暴击几率与 15% 暴击伤害 (与脉冲刃形成共鸣)',
        maxLevel: 5
      },
      hp: {
        id: 'hp',
        name: '量子核心',
        icon: '❤️',
        desc: '每级提升 20% 生命上限，并获得 +0.35 HP/s 自愈微流',
        maxLevel: 5
      },
      speed: {
        id: 'speed',
        name: '光子喷流',
        icon: '👟',
        desc: '每级提升 8% 移动速度，走位更加敏捷',
        maxLevel: 5
      },
      exp: {
        id: 'exp',
        name: '数据解析器',
        icon: '💾',
        desc: '每级提升 15% 经验晶体获取效率',
        maxLevel: 5
      },
      area: {
        id: 'area',
        name: '能量扩增器',
        icon: '🔮',
        desc: '每级提升 16% 技能特效范围与打击半径 (与黑洞形成共鸣)',
        maxLevel: 5
      }
    };

    // 进化组合映射 (武器ID -> 所需被动ID)
    this.evolutionRecipes = {
      arc_core: 'haste',          // 电弧核心 + 超频芯片 -> 天罚风暴
      pulse_blade: 'crit',        // 脉冲刃 + 聚焦透镜 -> 光子幻刃
      black_hole: 'area',         // 黑洞发生器 + 能量扩增器 -> 坍缩超新星
      orbital_satellites: 'armor',// 轨道卫星 + 纳米装甲 -> 极光环垒
      plasma_cannon: 'speed',     // 等离子炮 + 光子喷流 -> 湮灭重炮
      prism_ray: 'exp'            // 棱镜射线 + 数据解析器 -> 超维裂隙
    };
  }

  // 生成 3 张升级卡
  generateChoices(weapons, passives) {
    const candidates = [];

    // 1. 检查是否有满足条件的“超级武器进化”
    for (const [wId, reqPassive] of Object.entries(this.evolutionRecipes)) {
      const weapon = weapons[wId];
      const passive = passives[reqPassive];
      if (weapon && weapon.level >= 5 && !weapon.isEvolved && passive && passive.level >= 1) {
        let evoName = '超级进化';
        let evoDesc = '机体核心突破！形态彻底蜕变！';
        if (wId === 'arc_core') {
          evoName = '天罚风暴 (进化)';
          evoDesc = '电弧升华为全屏天罚落雷，击中伴随毁灭冲击波！';
        } else if (wId === 'pulse_blade') {
          evoName = '光子幻刃 (进化)';
          evoDesc = '斩击撕裂虚空形成残影，暴风骤雨般多重高暴击切割！';
        } else if (wId === 'black_hole') {
          evoName = '坍缩超新星 (进化)';
          evoDesc = '引力奇点牵引范围暴增，消失时引发毁灭性超新星大爆炸！';
        } else if (wId === 'orbital_satellites') {
          evoName = '极光环垒 (进化)';
          evoDesc = '轨道卫星增加至 6 颗，极速环绕并形成近身绞杀力场！';
        } else if (wId === 'plasma_cannon') {
          evoName = '湮灭重炮 (进化)';
          evoDesc = '多联装高速贯穿等离子光柱，极致击退毁灭敌群！';
        } else if (wId === 'prism_ray') {
          evoName = '超维裂隙 (进化)';
          evoDesc = '并联高能直射死光，持续灼烧全图直线路径！';
        }

        candidates.push({
          type: 'evolution',
          targetId: wId,
          name: evoName,
          icon: weapon.icon,
          levelTag: 'EVOLUTION',
          desc: evoDesc,
          rarity: 'evolution'
        });
      }
    }

    // 2. 武器候选池
    for (const [wId, weapon] of Object.entries(weapons)) {
      if (weapon.level < 5 && !weapon.isEvolved) {
        const nextLv = weapon.level + 1;
        const isNew = weapon.level === 0;
        const rarity = this.rollRarity(isNew);
        let bonus = null;
        let desc = isNew ? `装配新武器：${weapon.name}` : `提升武器等级，强化对应攻击能力`;
        if (rarity === 'rare') {
          bonus = { healPercent: 0.08, expPercent: 0 };
          desc += ' ❖ [稀有特权: 紧急维修 8% 生命]';
        } else if (rarity === 'epic') {
          bonus = { healPercent: 0.15, expPercent: 0.20 };
          desc += ' ★ [史诗特权: 核心过载 15% 生命 + 20% 升级能量]';
        }
        candidates.push({
          type: 'weapon',
          targetId: wId,
          name: weapon.name,
          icon: weapon.icon,
          levelTag: isNew ? 'NEW!' : `Lv.${weapon.level} ➔ Lv.${nextLv}`,
          desc: desc,
          rarity: rarity,
          bonus: bonus
        });
      }
    }

    // 3. 被动芯片候选池
    for (const [pId, def] of Object.entries(this.passiveDefs)) {
      const curLv = passives[pId] ? passives[pId].level : 0;
      if (curLv < def.maxLevel) {
        const nextLv = curLv + 1;
        const isNew = curLv === 0;
        const rarity = this.rollRarity(isNew);
        let bonus = null;
        let desc = def.desc;
        if (rarity === 'rare') {
          bonus = { healPercent: 0.08, expPercent: 0 };
          desc += ' ❖ [稀有特权: 紧急维修 8% 生命]';
        } else if (rarity === 'epic') {
          bonus = { healPercent: 0.15, expPercent: 0.20 };
          desc += ' ★ [史诗特权: 核心过载 15% 生命 + 20% 升级能量]';
        }
        candidates.push({
          type: 'passive',
          targetId: pId,
          name: def.name,
          icon: def.icon,
          levelTag: isNew ? 'NEW!' : `Lv.${curLv} ➔ Lv.${nextLv}`,
          desc: desc,
          rarity: rarity,
          bonus: bonus
        });
      }
    }

    // 如果所有武器和被动全满，提供应急维生
    if (candidates.length === 0) {
      return [
        {
          type: 'heal',
          targetId: 'heal',
          name: '能量过载矩阵',
          icon: '✨',
          levelTag: 'OVERDRIVE',
          desc: '立即恢复 40% 最大生命值，释放周身脉冲冲击波 (半径260) 强力击退敌群，并立即获得 +20% 当前升级所需经验值',
          rarity: 'epic',
          bonus: { healPercent: 0, expPercent: 0.20 }
        }
      ];
    }

    // Fisher-Yates 无偏抽样：优先保证 1 个进化项（若有，多个进化项间公平等权），其余槽位无偏洗牌
    const evolutions = candidates.filter(c => c.type === 'evolution');
    const result = [];

    if (evolutions.length > 0) {
      // 进化项之间公平随机选 1 个
      const evoShuffled = [...evolutions];
      for (let i = evoShuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [evoShuffled[i], evoShuffled[j]] = [evoShuffled[j], evoShuffled[i]];
      }
      const guaranteedEvo = evoShuffled[0];
      result.push(guaranteedEvo);

      // 其余候选（包含未选中的其他进化项）进入后续抽选池
      const remainingCandidates = candidates.filter(c => c !== guaranteedEvo);
      const otherShuffled = [...remainingCandidates];
      for (let i = otherShuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherShuffled[i], otherShuffled[j]] = [otherShuffled[j], otherShuffled[i]];
      }

      while (result.length < 3 && otherShuffled.length > 0) {
        result.push(otherShuffled.shift());
      }
    } else {
      const allShuffled = [...candidates];
      for (let i = allShuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allShuffled[i], allShuffled[j]] = [allShuffled[j], allShuffled[i]];
      }
      while (result.length < 3 && allShuffled.length > 0) {
        result.push(allShuffled.shift());
      }
    }

    return result;
  }

  rollRarity(isNew = false) {
    const r = Math.random() * 100;
    if (isNew) {
      // 首次抽取新物品：58% 普通 / 30% 稀有 / 12% 史诗
      if (r < 12) return 'epic';
      if (r < 42) return 'rare';
      return 'common';
    } else {
      // 后续升级常规抽取：68% 普通 / 25% 稀有 / 7% 史诗
      if (r < 7) return 'epic';
      if (r < 32) return 'rare';
      return 'common';
    }
  }
}

window.UpgradeSystem = UpgradeSystem;
