/* Local CC0 sprites + code-drawn pixel effects. Rendering never consumes gameplay RNG. */
(() => {
  const images = {}, failed = [];
  const sources = { dungeon: 'assets/sprites/dungeon.png' };
  for (let i = 1; i <= 5; i++) sources['blast' + i] = `assets/sprites/explosion-0${i}.png`;
  const ready = Promise.all(Object.entries(sources).map(([key, src]) => new Promise(resolve => {
    const img = new Image(); images[key] = img;
    img.onload = resolve; img.onerror = () => { failed.push(src); resolve(); }; img.src = src;
  })));
  const icons = { pulse_blade:[8,8], arc_core:[8,9], orbital_satellites:[6,8], plasma_cannon:[9,10],
    black_hole:[8,4], prism_ray:[11,10], armor:[6,8], pickup:[6,5], haste:[5,10], crit:[7,8],
    hp:[7,9], speed:[6,10], exp:[5,5], area:[8,4], heal:[7,9], joystick:[8,8], target:[8,4], upgrade:[5,5] };
  const enemyTiles = { SwarmDrone:[0,10], NeonScout:[1,10], RelicGolem:[2,9], PrismSniper:[0,7],
    FissionCore:[0,9], ChargeStriker:[2,10], RepairPriest:[1,7], BurstSentry:[3,9], BossTitan:[2,9] };
  const snap = n => Math.round(n / 2) * 2;
  function tile(ctx, col, row, x, y, size = 32, flip = false) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(snap(x), snap(y)); if (flip) ctx.scale(-1, 1);
    if (images.dungeon.complete && images.dungeon.naturalWidth) {
      ctx.drawImage(images.dungeon, col*16, row*16, 16, 16, -size/2, -size/2, size, size);
    } else { ctx.fillStyle='#91d9ce';ctx.fillRect(-size/4,-size/4,size/2,size/2); }
    ctx.restore();
  }
  function icon(id, extra = '') {
    const [x,y] = icons[id] || icons.exp;
    return `<span class="pixel-icon ${extra}" aria-hidden="true" style="--sprite-x:${x};--sprite-y:${y}"></span>`;
  }
  function line(ctx, x1, y1, x2, y2, color, size = 2, dash = 0) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2-x1,y2-y1)/size));
    ctx.fillStyle=color;
    for(let i=0;i<=steps;i++) {
      if(dash && Math.floor(i/dash)%2)continue;
      const t=i/steps;ctx.fillRect(snap(x1+(x2-x1)*t),snap(y1+(y2-y1)*t),size,size);
    }
  }
  function ring(ctx, x, y, radius, color, size=3, progress=1) {
    const count=Math.max(12,Math.ceil(radius*1.8));ctx.fillStyle=color;
    for(let i=0;i<count*progress;i++) {
      const a=i/count*Math.PI*2;ctx.fillRect(snap(x+Math.cos(a)*radius)-size/2,snap(y+Math.sin(a)*radius)-size/2,size,size);
    }
  }
  function shadow(ctx,x,y,r) {ctx.fillStyle='#090e1dcc';ctx.fillRect(snap(x-r*.7),snap(y+r*.65),snap(r*1.4),6);}
  function player(ctx,p) {
    if(p.isDead)return;
    shadow(ctx,p.x,p.y,p.radius);
    const moving=p.trailHistory.length>0,bob=moving?Math.floor(p.rotationAngle*5)%2*2:0;
    ctx.save();
    if(p.invulnerableTimer>0 && Math.floor(p.rotationAngle*12)%2)ctx.globalAlpha=.5;
    tile(ctx,1,8,p.x,p.y-4-bob,40,Math.cos(p.facingAngle)<0);
    tile(ctx,8,8,p.x+Math.cos(p.facingAngle)*17,p.y+Math.sin(p.facingAngle)*12,22,Math.cos(p.facingAngle)<0);
    if(p.hurtFlashTimer>0){ctx.globalAlpha=.6;ring(ctx,p.x,p.y,p.radius+3,'#fff3c7',3);}
    ctx.restore();
    // Four small mint corners make the player easy to locate in a crowd.
    for(const dx of [-1,1])for(const dy of [-1,1]) {
      const x=p.x+dx*23,y=p.y+dy*22;line(ctx,x,y,x-dx*6,y,'#7fe3c1',2);line(ctx,x,y,x,y-dy*5,'#7fe3c1',2);
    }
    if(p.graceShieldTimer>0)ring(ctx,p.x,p.y,p.radius+10,'#90f1d5',3);
  }
  function enemy(ctx,e) {
    if(e.isDead)return;
    if(e.hazardZones)for(const hz of e.hazardZones) {
      const progress=Math.max(0,Math.min(1,1-hz.timer/hz.maxTimer));
      ctx.save();ctx.globalAlpha=.16+progress*.22;
      for(let y=-hz.radius;y<hz.radius;y+=8)for(let x=-hz.radius;x<hz.radius;x+=8)if(x*x+y*y<hz.radius*hz.radius) {
        ctx.fillStyle='#ed665b';ctx.fillRect(snap(hz.x+x),snap(hz.y+y),4,4);
      }
      ctx.restore();ring(ctx,hz.x,hz.y,hz.radius,'#ff816b',3);
      ring(ctx,hz.x,hz.y,hz.radius*progress,'#ffcb83',3);
    }
    if(e.constructor.name==='PrismSniper' && ['track','locked'].includes(e.attackState)) {
      const o=e.aimOrigin||e;
      line(ctx,o.x,o.y,o.x+Math.cos(e.aimAngle)*450,o.y+Math.sin(e.aimAngle)*450,e.isAimLocked?'#ffd58f':'#df6570',e.isAimLocked?3:2,e.isAimLocked?0:4);
      ring(ctx,e.x,e.y,e.radius+7,e.isAimLocked?'#ffd58f':'#df6570',2,Math.min(1,e.aimTimer/e.aimDuration));
    }
    if(e.constructor.name==='BurstSentry' && e.attackState==='windup') {
      const o=e.aimOrigin||e;
      for(const offset of [-.32,0,.32]){const a=e.aimAngle+offset;line(ctx,o.x,o.y,o.x+Math.cos(a)*130,o.y+Math.sin(a)*130,'#e9ac62',2,4);}
      ring(ctx,e.x,e.y,e.radius+8,'#ffd58f',3,1-e.attackTimer/.95);
    }
    if(e.constructor.name==='RepairPriest') {
      if(e.healTimer<.8){ctx.save();ctx.globalAlpha=.25;ring(ctx,e.x,e.y,130,'#8ae1ad',2);ctx.restore();}
      if(e.healFlash>0)for(const target of e.healTargets)if(!target.isDead){
        ctx.save();ctx.globalAlpha=e.healFlash/.35;line(ctx,e.x,e.y,target.x,target.y,'#8ae1ad',2,3);ctx.restore();
      }
      line(ctx,e.x-5,e.y-e.radius-10,e.x+5,e.y-e.radius-10,'#8ae1ad',3);
      line(ctx,e.x,e.y-e.radius-15,e.x,e.y-e.radius-5,'#8ae1ad',3);
    }
    if(e.state==='charge_aim')line(ctx,e.x,e.y,e.x+Math.cos(e.dashAngle)*260,e.y+Math.sin(e.dashAngle)*260,'#ffb56b',3,4);
    const r=e.radius,size=e.isBoss?112:Math.max(28,Math.round(r*2.4/2)*2);
    shadow(ctx,e.x,e.y,r);
    if(e.isBoss){ring(ctx,e.x,e.y,r+10,e.phase===3?'#ec6976':'#e6ad64',4);tile(ctx,6,8,e.x-42,e.y,32);tile(ctx,6,8,e.x+42,e.y,32,true);}
    const [col,row]=enemyTiles[e.constructor.name]||[0,9];
    const bob=Math.floor(e.animTime*7)%2*2;
    tile(ctx,col,row,e.x,e.y-bob,size,Math.floor(e.animTime*.4)%2===1);
    if(e.hurtTimer>0){ctx.save();ctx.globalAlpha=.55;ring(ctx,e.x,e.y,r,'#fff5d9',3);ctx.restore();}
    if(e.isElite){ring(ctx,e.x,e.y,r+5,'#f0c477',3);ctx.fillStyle='#f0c477';ctx.fillRect(snap(e.x-5),snap(e.y-r-13),10,4);}
    if(e.shieldHp>0)ring(ctx,e.x,e.y,r+8,'#9fc7ed',2);
    if(!e.isBoss && e.hp<e.maxHp){ctx.fillStyle='#171b2e';ctx.fillRect(snap(e.x-16),snap(e.y-r-8),32,4);ctx.fillStyle='#e69b7c';ctx.fillRect(snap(e.x-16),snap(e.y-r-8),Math.ceil(32*e.hp/e.maxHp),2);}
  }
  function bladePoint(s,t) {
    const x=s.fromX,y=s.fromY,dx=s.x-x,dy=s.y-y;
    const bend=4*t*(1-t)*.18;
    return {x:x+dx*t-dy*bend,y:y+dy*t+dx*bend};
  }
  function weapon(ctx, w, p) {
    if (w.level <= 0) return;
    const lvl = Math.max(1, Math.min(5, w.level || 1));
    const isEvo = !!w.isEvolved;

    // 1. 脉冲刃 (Pulse Blade) / 光子幻刃 (Phantom Voidblade)
    if (w.id === 'pulse_blade') for (const s of w.slashes) {
      const progress = 1 - s.life / s.maxLife;
      const head = Math.min(1, progress / 0.62);
      const sLvl = s.level || lvl;
      const evo = s.isEvolved !== undefined ? s.isEvolved : isEvo;
      const alpha = Math.min(1, (s.life / s.maxLife) * 2);
      const primaryColor = evo ? '#d9adff' : (sLvl >= 4 ? '#5eead4' : (sLvl >= 2 ? '#7fe3c1' : '#acf5e3'));
      const coreColor = evo ? '#ffffff' : (sLvl >= 3 ? '#ffffff' : '#f0fdfa');
      const accentColor = evo ? '#f472b6' : (s.isCrit ? '#ffaa00' : '#fff3d6');

      ctx.save();
      // Level 3+: Lingering luminous incision path etched into spacetime
      ctx.globalAlpha = alpha * (evo ? 0.35 : 0.22);
      for (let i = 1; i <= 20; i++) {
        const a = bladePoint(s, (i - 1) / 20), b = bladePoint(s, i / 20);
        line(ctx, a.x, a.y, b.x, b.y, primaryColor, evo ? 3 : 2);
      }

      // Main blade cutting arc traveling along the trajectory
      ctx.globalAlpha = alpha;
      const start = Math.max(0, head - 0.45);
      const segs = 16;
      for (let i = 1; i <= segs; i++) {
        const t0 = start + (head - start) * (i - 1) / segs;
        const t1 = start + (head - start) * i / segs;
        const a = bladePoint(s, t0), b = bladePoint(s, t1);
        const isTip = i > 11;
        const isBody = i > 7;
        const col = isTip ? coreColor : (isBody ? accentColor : primaryColor);
        const sz = evo ? (isTip ? 5 : 3) : (sLvl >= 4 ? (isTip ? 4 : 3) : (isTip ? 4 : 2));
        line(ctx, a.x, a.y, b.x, b.y, col, sz);

        // Evolution: Staggered void fracture offset
        if (evo && i % 4 === 0) {
          const offsetDist = Math.sin(i * 1.7) * 6;
          line(ctx, a.x + offsetDist, a.y - offsetDist, b.x + offsetDist, b.y - offsetDist, '#a855f7', 2);
        }
      }

      // Blade tip energy fan / shards
      const tip = bladePoint(s, head);
      const shardCount = evo ? 22 : (sLvl >= 4 ? 18 : (sLvl >= 2 ? 14 : 10));
      for (let i = 0; i < shardCount; i++) {
        const a = s.angle - 1.1 + (i / (shardCount - 1)) * 2.2;
        const r = (s.radius || 28) * (0.45 + (i % 3) * 0.15);
        ctx.fillStyle = (i > 3 && i < shardCount - 4) ? coreColor : (evo ? '#c084fc' : primaryColor);
        const dotSz = evo ? (i % 2 === 0 ? 4 : 2) : (sLvl >= 4 ? 4 : (i % 2 === 0 ? 4 : 2));
        ctx.fillRect(snap(tip.x + Math.cos(a) * r), snap(tip.y + Math.sin(a) * r), dotSz, dotSz);
      }

      // Target impact burst flash
      if (head === 1) {
        const crossSz = evo ? 14 : (sLvl >= 4 ? 10 : 8);
        const crossColor = s.isCrit ? '#ffaa00' : (evo ? '#ffffff' : '#fff5d9');
        line(ctx, s.x - crossSz, s.y, s.x + crossSz, s.y, crossColor, evo ? 4 : 3);
        line(ctx, s.x, s.y - crossSz, s.x, s.y + crossSz, crossColor, evo ? 4 : 3);
        if (evo || sLvl >= 4) {
          const diag = crossSz * 0.7;
          line(ctx, s.x - diag, s.y - diag, s.x + diag, s.y + diag, accentColor, 2);
          line(ctx, s.x - diag, s.y + diag, s.x + diag, s.y - diag, accentColor, 2);
        }
      }
      ctx.restore();
    }

    // 2. 电弧核心 (Arc Core) / 天罚风暴 (Tempest Protocol)
    if (w.id === 'arc_core') for (const c of w.chains) {
      const cLvl = c.level || lvl;
      const isBolt = !!c.isBolt;
      const alpha = Math.min(1, (c.life / c.maxLife) * 2);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (isBolt) {
        // Celestial Tempest: Skyward thunder pillar & ground shock rings
        const targetPt = c.points[c.points.length - 1];
        ring(ctx, targetPt.x, targetPt.y, 28 * (1 - c.life / c.maxLife), '#c084fc', 3);
        ring(ctx, targetPt.x, targetPt.y, 48 * (1 - c.life / c.maxLife), '#7c3aed', 2);

        // Multi-layered vertical lightning pillar
        for (let i = 1; i < c.points.length; i++) {
          const a = c.points[i - 1], b = c.points[i];
          const mx = (a.x + b.x) / 2 + (i % 2 ? 14 : -14);
          const my = (a.y + b.y) / 2;
          line(ctx, a.x, a.y, mx, my, '#7c3aed', 8);
          line(ctx, mx, my, b.x, b.y, '#7c3aed', 8);
          line(ctx, a.x, a.y, mx, my, '#c6a9f0', 5);
          line(ctx, mx, my, b.x, b.y, '#c6a9f0', 5);
          line(ctx, a.x, a.y, mx, my, '#ffffff', 2);
          line(ctx, mx, my, b.x, b.y, '#ffffff', 2);
          const spkX = mx + ((i * 7) % 13 - 6);
          const spkY = my + ((i * 11) % 15 - 7);
          ctx.fillStyle = '#f5d0fe';
          ctx.fillRect(snap(spkX), snap(spkY), 4, 4);
        }
      } else {
        // Normal Arc Core chain lightning
        const boltCol = cLvl >= 4 ? '#38bdf8' : '#86d7ed';
        const coreCol = cLvl >= 3 ? '#ffffff' : '#eafaff';
        const thickness = cLvl >= 4 ? 6 : (cLvl >= 2 ? 4 : 3);

        for (let i = 1; i < c.points.length; i++) {
          const a = c.points[i - 1], b = c.points[i];
          const offset = (i % 2 ? 1 : -1) * (cLvl >= 3 ? 12 : 8);
          const mx = (a.x + b.x) / 2 + offset;
          const my = (a.y + b.y) / 2 - (i % 3 ? 5 : -4);

          line(ctx, a.x, a.y, mx, my, boltCol, thickness);
          line(ctx, mx, my, b.x, b.y, boltCol, thickness);
          line(ctx, a.x, a.y, mx, my, coreCol, Math.max(2, thickness - 2));
          line(ctx, mx, my, b.x, b.y, coreCol, Math.max(2, thickness - 2));

          if (cLvl >= 3) {
            const bx = mx + offset * 0.8;
            const by = my - 10;
            line(ctx, mx, my, bx, by, '#bae6fd', 2);
          }
          ring(ctx, b.x, b.y, cLvl >= 4 ? 6 : 4, '#e0f2fe', 2);
        }
      }
      ctx.restore();
    }

    // 3. 轨道卫星 (Orbital Satellites) / 极光环垒 (Aurora Bastion)
    if (w.id === 'orbital_satellites' && p) {
      const { radius, count, orbSize, barrierWidth } = w.geometry(p);
      const satLvl = w.level;
      const isBastion = !!w.isEvolved;

      ctx.save();
      if (isBastion) {
        ctx.globalAlpha = 0.55;
        ring(ctx, p.x, p.y, radius, '#b6a3e8', 3);
        ctx.globalAlpha = 0.25;
        ring(ctx, p.x, p.y, radius - (barrierWidth || 14), '#7c3aed', 2);
        ring(ctx, p.x, p.y, radius + (barrierWidth || 14), '#c084fc', 2);
      } else if (satLvl >= 2) {
        ctx.globalAlpha = satLvl >= 4 ? 0.35 : 0.18;
        ring(ctx, p.x, p.y, radius, satLvl >= 4 ? '#38bdf8' : '#83e9ff', satLvl >= 4 ? 3 : 2);
        if (satLvl >= 4) {
          ctx.globalAlpha = 0.15;
          ring(ctx, p.x, p.y, radius * 0.82, '#0284c7', 2);
        }
      }

      if (w.interceptFlash > 0) {
        ctx.globalAlpha = Math.min(1, (w.interceptFlash / 0.16) * 1.2);
        ring(ctx, p.x, p.y, radius, '#e1fbff', isBastion ? 6 : 4);
        ring(ctx, p.x, p.y, radius + 10, '#38bdf8', 2);
      }
      if (w.contactFlash > 0) {
        ctx.globalAlpha = Math.min(1, (w.contactFlash / 0.14) * 0.8);
        ring(ctx, p.x, p.y, radius, isBastion ? '#f472b6' : '#fef08a', 3);
      }

      const satCoords = [];
      for (let i = 0; i < count; i++) {
        const a = w.angle + (i * Math.PI * 2) / count;
        satCoords.push({ x: p.x + Math.cos(a) * radius, y: p.y + Math.sin(a) * radius, angle: a });
      }

      if (isBastion) {
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < count; i++) {
          const curr = satCoords[i];
          const next = satCoords[(i + 1) % count];
          line(ctx, curr.x, curr.y, next.x, next.y, '#c084fc', 3);
          line(ctx, curr.x, curr.y, next.x, next.y, '#ffffff', 1);
        }
      } else if (satLvl >= 4) {
        ctx.globalAlpha = 0.22;
        for (let i = 0; i < count; i++) {
          const curr = satCoords[i];
          const next = satCoords[(i + 1) % count];
          line(ctx, curr.x, curr.y, next.x, next.y, '#7dd3fc', 1);
        }
      }

      for (let i = 0; i < count; i++) {
        const { x, y, angle: a } = satCoords[i];
        const trailSteps = isBastion ? 6 : (satLvl >= 4 ? 5 : (satLvl >= 2 ? 4 : 2));
        for (let j = trailSteps; j > 0; j--) {
          const t = a - j * 0.08;
          ctx.globalAlpha = (trailSteps + 1 - j) * (isBastion ? 0.09 : 0.07);
          ring(ctx, p.x + Math.cos(t) * radius, p.y + Math.sin(t) * radius, orbSize * 0.6, isBastion ? '#b6a3e8' : '#83e9ff', 2);
        }

        ctx.globalAlpha = isBastion ? 0.6 : (satLvl >= 3 ? 0.45 : 0.3);
        ring(ctx, x, y, orbSize, isBastion ? '#c084fc' : (satLvl >= 4 ? '#38bdf8' : '#83e9ff'), 2);

        ctx.globalAlpha = 1;
        tile(ctx, 6, 8, x, y, isBastion ? 26 : 22);

        if (satLvl >= 3 || isBastion) {
          ctx.fillStyle = isBastion ? '#f5d0fe' : '#ffffff';
          ctx.fillRect(snap(x) - 2, snap(y) - 2, 4, 4);
        }
      }
      ctx.restore();
    }

    // 4. 等离子炮 (Plasma Cannon) / 湮灭重炮 (Annihilation Cannon)
    if (w.id === 'plasma_cannon') {
      for (const flash of w.muzzleFlashes) {
        const progress = 1 - flash.life / flash.maxLife;
        ctx.save();
        ctx.globalAlpha = (1 - progress);
        const dist = 18 + progress * 8;
        const x = flash.x + Math.cos(flash.angle) * dist;
        const y = flash.y + Math.sin(flash.angle) * dist;
        const fCol = flash.isEvolved ? '#c084fc' : '#b6f1ff';
        ring(ctx, x, y, 8 + progress * 14, fCol, flash.isEvolved ? 4 : 3);
        line(ctx, x - 6, y, x + 6, y, '#ffffff', 3);
        line(ctx, x, y - 6, x, y + 6, '#ffffff', 3);
        ctx.restore();
      }

      for (const b of w.projectiles) {
        const r = Math.max(6, b.radius);
        const speed = Math.hypot(b.vx, b.vy) || 360;
        const pLvl = b.level || lvl;
        const evo = !!b.isEvolved;
        const length = Math.min(evo ? 72 : (pLvl >= 4 ? 54 : 42), (b.age || 0) * speed);
        const shell = evo ? '#b899ed' : (pLvl >= 4 ? '#38bdf8' : '#69cce8');
        const rim = evo ? '#745da9' : (pLvl >= 4 ? '#0284c7' : '#35798e');
        const core = evo ? '#0f051d' : '#ffffff';

        ctx.save();
        const trailSegments = evo ? 7 : (pLvl >= 4 ? 6 : 4);
        for (let i = trailSegments; i >= 1; i--) {
          const t = i / trailSegments;
          const tx = b.x - Math.cos(b.angle) * length * t;
          const ty = b.y - Math.sin(b.angle) * length * t;
          ctx.globalAlpha = 0.7 * (1 - t * 0.7);
          const sz = Math.max(2, Math.round(r * (1 - t * 0.65)));
          ctx.fillStyle = shell;
          ctx.fillRect(snap(tx) - sz / 2, snap(ty) - sz / 2, sz, sz);
          if (evo && i % 2 === 0) {
            ctx.fillStyle = '#f472b6';
            ctx.fillRect(snap(tx) - 1, snap(ty) - 1, 2, 2);
          }
        }

        ctx.globalAlpha = 1;
        ring(ctx, b.x, b.y, r, rim, evo ? 4 : 3);
        ctx.fillStyle = shell;
        ctx.fillRect(snap(b.x - r * 0.65), snap(b.y - r * 0.65), r * 1.3, r * 1.3);

        if (evo) {
          ctx.fillStyle = core;
          ctx.fillRect(snap(b.x - r * 0.4), snap(b.y - r * 0.4), r * 0.8, r * 0.8);
          ctx.fillStyle = '#f5d0fe';
          ctx.fillRect(snap(b.x - 2), snap(b.y - 2), 4, 4);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(snap(b.x - r * 0.35), snap(b.y - r * 0.35), r * 0.7, r * 0.7);
        }

        const spin = (b.age || 0) * (evo ? 16 : 12);
        const moteCount = evo ? 4 : (pLvl >= 4 ? 4 : 3);
        for (let i = 0; i < moteCount; i++) {
          const a = spin + (i * Math.PI * 2) / moteCount;
          ctx.fillStyle = evo ? (i % 2 === 0 ? '#f472b6' : '#e0e7ff') : '#c6f8ff';
          const mDist = r + (evo ? 3 : 2);
          ctx.fillRect(snap(b.x + Math.cos(a) * mDist), snap(b.y + Math.sin(a) * mDist), evo ? 4 : 3, evo ? 4 : 3);
        }
        ctx.restore();
      }

      for (const hit of w.impacts) {
        const t = 1 - hit.life / hit.maxLife;
        const evo = !!hit.isEvolved;
        const hLvl = hit.level || lvl;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        const r = (evo ? 32 : (hLvl >= 4 ? 24 : 20)) * t;
        const impCol = hit.isCrit ? '#ffaa00' : (evo ? '#c5a5ff' : (hLvl >= 4 ? '#38bdf8' : '#83e9ff'));

        ring(ctx, hit.x, hit.y, r, impCol, evo ? 4 : 3);
        const spikeCount = evo ? 6 : 4;
        for (let i = 0; i < spikeCount; i++) {
          const a = (i * Math.PI * 2) / spikeCount + 0.78;
          line(ctx, hit.x + Math.cos(a) * r, hit.y + Math.sin(a) * r, hit.x + Math.cos(a) * (r + 8), hit.y + Math.sin(a) * (r + 8), '#ffffff', 2);
        }
        ctx.restore();
      }
    }

    // 5. 黑洞发生器 (Black Hole Generator) / 坍缩超新星 (Collapsing Supernova)
    if (w.id === 'black_hole') for (const h of w.holes) {
      const hLvl = h.level || lvl;
      const evo = !!h.isEvolved;
      const isCollapsing = evo && (h.life <= 0.35);
      const collapseScale = isCollapsing ? Math.max(0.08, h.life / 0.35) : 1.0;
      const curRadius = h.radius * collapseScale;

      ctx.save();

      // 1. 引力边界圈
      ctx.globalAlpha = 0.45 + Math.sin(h.rotation * 2) * 0.15;
      ring(ctx, h.x, h.y, h.radius, evo ? '#c084fc' : '#818cf8', 2);
      const chevronCount = 8;
      for (let i = 0; i < chevronCount; i++) {
        const ca = h.rotation * 0.5 + (i * Math.PI * 2) / chevronCount;
        const cx0 = h.x + Math.cos(ca) * h.radius;
        const cy0 = h.y + Math.sin(ca) * h.radius;
        const cx1 = h.x + Math.cos(ca) * (h.radius - 8);
        const cy1 = h.y + Math.sin(ca) * (h.radius - 8);
        line(ctx, cx0, cy0, cx1, cy1, evo ? '#f472b6' : '#a5b4fc', 2);
      }

      // 2. 被牵引敌人的引力丝线与位移反馈
      if (h.pulledEnemies && h.pulledEnemies.length > 0) {
        for (const pe of h.pulledEnemies) {
          const pullIntensity = Math.pow(1 - pe.distRatio, 0.6);
          ctx.globalAlpha = Math.min(0.85, pullIntensity * 0.9);
          line(ctx, pe.x, pe.y, h.x, h.y, evo ? '#e879f9' : '#818cf8', pe.distRatio < 0.35 ? 3 : 2, 4);
          const awayAngle = Math.atan2(pe.y - h.y, pe.x - h.x);
          const wakeLen = 14 * pullIntensity;
          line(ctx, pe.x, pe.y, pe.x + Math.cos(awayAngle) * wakeLen, pe.y + Math.sin(awayAngle) * wakeLen, evo ? '#f43f5e' : '#60a5fa', 2);
        }
      }

      // 3. 向内塌缩的螺旋粒子流 (确定性计算，绝不使用 Math.random)
      ctx.globalAlpha = 0.85;
      const vortexCount = evo ? 24 : (hLvl >= 4 ? 20 : 16);
      for (let k = 0; k < vortexCount; k++) {
        const cycle = ((h.rotation * 1.6 + k * 0.38) % 1.0);
        const pr = curRadius * (1 - cycle);
        const pa = k * ((Math.PI * 2) / vortexCount) + (1 - cycle) * 3.2 + h.rotation;
        const px = h.x + Math.cos(pa) * pr;
        const py = h.y + Math.sin(pa) * pr;
        const pSize = cycle > 0.8 ? 4 : (cycle > 0.4 ? 3 : 2);
        ctx.fillStyle = cycle > 0.75 ? '#ffffff' : (evo ? (k % 2 === 0 ? '#f472b6' : '#c084fc') : (k % 2 === 0 ? '#818cf8' : '#c7d2fe'));
        ctx.fillRect(snap(px) - pSize / 2, snap(py) - pSize / 2, pSize, pSize);
      }

      // 4. 旋转吸积盘
      const diskRadius = curRadius * 0.65;
      ctx.globalAlpha = isCollapsing ? 0.95 : 0.75;
      ring(ctx, h.x, h.y, diskRadius, evo ? '#d946ef' : '#8b70b5', isCollapsing ? 5 : 3);
      for (let n = 0; n < 3; n++) {
        for (let i = 0; i < 18; i++) {
          const a = h.rotation + n * 2.094 + i * 0.16;
          const r = curRadius * (0.12 + (i / 22) * 0.65);
          ctx.fillStyle = i % 3 === 0 ? (evo ? '#ffffff' : '#c3b4ed') : (evo ? '#a855f7' : '#615481');
          ctx.fillRect(snap(h.x + Math.cos(a) * r), snap(h.y + Math.sin(a) * r), 4, 4);
        }
      }

      // 5. 事件视界纯黑奇点核心
      const coreR = Math.max(4, curRadius * (isCollapsing ? 0.12 : 0.24));
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#020108';
      ctx.fillRect(snap(h.x - coreR), snap(h.y - coreR), snap(coreR * 2), snap(coreR * 2));
      ring(ctx, h.x, h.y, coreR, isCollapsing ? '#ffffff' : (evo ? '#f43f5e' : '#a78bfa'), 2);

      tile(ctx, 8, 4, h.x, h.y, Math.round(34 * collapseScale));
      ctx.restore();
    }

    // 6. 棱镜射线 (Prism Ray) / 超维裂隙 (Dimensional Rift)
    if (w.id === 'prism_ray') for (const b of w.beams) {
      const bLvl = b.level || lvl;
      const evo = !!b.isEvolved;
      const dx = Math.cos(b.angle) * b.length;
      const dy = Math.sin(b.angle) * b.length;
      const alpha = Math.min(0.9, (b.life / b.maxLife) * 1.6);
      const beamW = Math.max(4, Math.round((b.width || 16) * 0.65));

      ctx.save();
      ctx.globalAlpha = alpha;

      if (evo) {
        // Dimensional Rift: 空间撕裂锯齿死光
        line(ctx, b.x, b.y, b.x + dx, b.y + dy, '#7c3aed', beamW + 4);
        const steps = 24;
        for (let i = 1; i <= steps; i++) {
          const t0 = (i - 1) / steps;
          const t1 = i / steps;
          const p0x = b.x + dx * t0, p0y = b.y + dy * t0;
          const p1x = b.x + dx * t1, p1y = b.y + dy * t1;
          const tearOffset = (i % 3 - 1) * 3;
          line(ctx, p0x + tearOffset, p0y - tearOffset, p1x + tearOffset, p1y - tearOffset, '#d946ef', Math.max(3, beamW - 2));
        }
        line(ctx, b.x, b.y, b.x + dx, b.y + dy, '#ffffff', 3);

        const moteCount = 8;
        for (let m = 0; m < moteCount; m++) {
          const mt = ((m * 0.13 + (b.life * 4)) % 1.0);
          const mx = b.x + dx * mt + ((m * 5) % 9 - 4);
          const my = b.y + dy * mt + ((m * 7) % 9 - 4);
          ctx.fillStyle = '#f5d0fe';
          ctx.fillRect(snap(mx) - 1, snap(my) - 1, 3, 3);
        }
      } else {
        const outerCol = bLvl >= 4 ? '#0891b2' : '#79baca';
        const midCol = bLvl >= 4 ? '#38bdf8' : '#a5f3fc';
        const coreCol = '#fef9c3';

        line(ctx, b.x, b.y, b.x + dx, b.y + dy, outerCol, beamW);
        if (bLvl >= 3) line(ctx, b.x, b.y, b.x + dx, b.y + dy, midCol, Math.max(2, beamW - 3));
        line(ctx, b.x, b.y, b.x + dx, b.y + dy, coreCol, Math.max(2, Math.round(beamW * 0.35)));

        if (bLvl >= 4) {
          for (let k = 0; k < 4; k++) {
            const pt = ((k * 0.25 + (b.life * 3)) % 1.0);
            const px = b.x + dx * pt;
            const py = b.y + dy * pt;
            ring(ctx, px, py, 4, '#ffffff', 2);
          }
        }
      }

      const flareCol = evo ? '#f472b6' : '#ffffff';
      ring(ctx, b.x, b.y, evo ? 8 : 5, flareCol, 3);
      line(ctx, b.x - 6, b.y, b.x + 6, b.y, '#ffffff', 2);
      line(ctx, b.x, b.y - 6, b.x, b.y + 6, '#ffffff', 2);

      ctx.restore();
    }
  }
  function arena(ctx,g) {
    const {width,height,zoom,x,y}=g.camera,step=48;
    const left=Math.floor((x-width/2/zoom)/step)*step,top=Math.floor((y-height/2/zoom)/step)*step;
    ctx.fillStyle='#151c2a';ctx.fillRect(left,top,width/zoom+step*2,height/zoom+step*2);
    for(let yy=top;yy<top+height/zoom+step*2;yy+=step)for(let xx=left;xx<left+width/zoom+step*2;xx+=step) {
      const hash=Math.abs(Math.imul(xx/step,73856093)^Math.imul(yy/step,19349663));
      ctx.fillStyle=hash%3===0?'#1c2534':'#192130';ctx.fillRect(xx+2,yy+2,44,44);
      ctx.fillStyle='#242d3d';ctx.fillRect(xx+4,yy+4,38,2);
      if(hash%11===0){ctx.fillStyle='#354044';ctx.fillRect(xx+8,yy+34,6,2);ctx.fillRect(xx+32,yy+12,2,4);}
      if(hash%43===0){ctx.save();ctx.globalAlpha=.3;tile(ctx,4,3,xx+24,yy+24,32);ctx.restore();}
    }
    // Relic mosaics are decorations, never obstacles or fake collision walls.
    for(const rune of g.arenaRunes) {
      if(Math.abs(rune.x-x)>width/zoom/2+100||Math.abs(rune.y-y)>height/zoom/2+100)continue;
      ctx.save();ctx.globalAlpha=.35;ring(ctx,rune.x,rune.y,40,'#548d89',4);tile(ctx,8,4,rune.x,rune.y,48);ctx.restore();
    }
    ctx.save();ctx.globalAlpha=.45;ring(ctx,0,0,110,'#547475',4);ring(ctx,0,0,220,'#444d66',4);ctx.restore();
    const b=g.arenaBound;ctx.strokeStyle='#a47b63';ctx.lineWidth=6;ctx.strokeRect(-b.halfWidth,-b.halfHeight,b.halfWidth*2,b.halfHeight*2);
  }
  function crystals(ctx,g) {
    for(const c of g.crystals) {
      const s=c.value>=25?6:4;ctx.fillStyle=c.value>=25?'#f4cd7f':c.value>=5?'#baaae8':'#80d4bb';
      ctx.fillRect(snap(c.x)-s/2,snap(c.y)-s,s,s*2);ctx.fillRect(snap(c.x)-s,snap(c.y)-s/2,s*2,s);
      ctx.fillStyle='#edffdf';ctx.fillRect(snap(c.x)-2,snap(c.y)-s,2,2);
    }
  }
  function effects(ctx,g) {
    for(const sw of g.shockwaves) {
      ctx.save();ctx.globalAlpha=Math.min(.85,sw.life/sw.maxLife*1.4);
      ring(ctx,sw.x,sw.y,sw.radius,sw.priority?'#ffc080':'#b0d2c1',sw.priority?4:2);
      if(sw.priority){const frame=Math.min(5,1+Math.floor((1-sw.life/sw.maxLife)*5)),img=images['blast'+frame];
        if(img?.naturalWidth)ctx.drawImage(img,snap(sw.x-32),snap(sw.y-32),64,64);}
      ctx.restore();
    }
    for(const p of g.particles){ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.fillStyle=p.color;ctx.fillRect(snap(p.x),snap(p.y),p.radius>2?4:2,p.radius>2?4:2);}ctx.globalAlpha=1;
  }
  function renderGame(g) {
    const {width:w,height:h,zoom}=g.camera;
    if(!g.pixelCanvas){g.pixelCanvas=document.createElement('canvas');g.pixelContext=g.pixelCanvas.getContext('2d');}
    const canvas=g.pixelCanvas,ctx=g.pixelContext;
    if(canvas.width!==Math.ceil(w/2)||canvas.height!==Math.ceil(h/2)){canvas.width=Math.ceil(w/2);canvas.height=Math.ceil(h/2);}
    ctx.setTransform(.5,0,0,.5,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);
    ctx.save();ctx.translate(w/2,h/2);ctx.scale(zoom,zoom);ctx.translate(-g.camera.x,-g.camera.y);
    arena(ctx,g);crystals(ctx,g);
    for(const e of g.enemies)e.render(ctx);
    for(const b of g.enemyBullets){ctx.fillStyle='#612f43';ctx.fillRect(snap(b.x-b.radius-2),snap(b.y-b.radius-2),b.radius*2+4,b.radius*2+4);ctx.fillStyle='#ffb080';ctx.fillRect(snap(b.x-b.radius),snap(b.y-b.radius),b.radius*2,b.radius*2);ctx.fillStyle='#fff1be';ctx.fillRect(snap(b.x)-2,snap(b.y)-2,4,4);}
    g.player.render(ctx);for(const w of Object.values(g.weapons))w.render(ctx,g.player);effects(ctx,g);
    for(const text of g.damageTexts){ctx.globalAlpha=Math.max(0,text.life/text.maxLife);ctx.font=`${text.isCrit?24:12}px "Relic Pixel",monospace`;ctx.textAlign='center';ctx.fillStyle='#101522';ctx.fillText(text.text,snap(text.x)+2,snap(text.y)+2);ctx.fillStyle=text.isCrit?'#ffe0a0':'#e6e9c9';ctx.fillText(text.text,snap(text.x),snap(text.y));}ctx.globalAlpha=1;
    ctx.restore();
    g.renderOffscreenIndicators(ctx,w,h);
    g.ctx.imageSmoothingEnabled=false;g.ctx.clearRect(0,0,w,h);g.ctx.drawImage(canvas,0,0,canvas.width,canvas.height,0,0,w,h);
  }
  window.PixelArt={ready,images,sources,failed,icons,icon,tile,line,ring,player,enemy,weapon,bladePoint,arena,crystals,renderGame};
})();
