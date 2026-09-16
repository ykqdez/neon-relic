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
    FissionCore:[0,9], ChargeStriker:[2,10], BossTitan:[2,9] };
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
    if(e.constructor.name==='PrismSniper' && e.shootTimer<=e.aimDuration)
      line(ctx,e.x,e.y,e.x+Math.cos(e.aimAngle)*450,e.y+Math.sin(e.aimAngle)*450,e.isAimLocked?'#ffd58f':'#df6570',e.isAimLocked?3:2,e.isAimLocked?0:4);
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
  function weapon(ctx,w,p) {
    if(w.level<=0)return;
    if(w.id==='pulse_blade')for(const s of w.slashes) {
      const progress=1-s.life/s.maxLife,head=Math.min(1,progress/.62);
      const color=s.isEvolved?'#d9adff':'#acf5e3';
      ctx.save();ctx.globalAlpha=Math.min(1,s.life/s.maxLife*2);
      // A faint complete path communicates the instant hit; the bright blade travels along it.
      ctx.globalAlpha*=.22;
      for(let i=1;i<=20;i++){
        const a=bladePoint(s,(i-1)/20),b=bladePoint(s,i/20);line(ctx,a.x,a.y,b.x,b.y,color,2);
      }
      ctx.globalAlpha=Math.min(1,s.life/s.maxLife*2);
      for(let i=1;i<=16;i++){
        const start=Math.max(0,head-.45),a=bladePoint(s,start+(head-start)*(i-1)/16),b=bladePoint(s,start+(head-start)*i/16);
        line(ctx,a.x,a.y,b.x,b.y,i>11?'#fff3d6':color,i>10?4:2);
      }
      const tip=bladePoint(s,head);
      for(let i=0;i<16;i++) {
        const a=s.angle-1.1+i/15*2.2,r=s.radius*.6;
        ctx.fillStyle=i>3&&i<12?'#fff3d6':color;
        ctx.fillRect(snap(tip.x+Math.cos(a)*r),snap(tip.y+Math.sin(a)*r),4,4);
      }
      if(head===1){line(ctx,s.x-8,s.y,s.x+8,s.y,'#fff5d9',3);line(ctx,s.x,s.y-8,s.x,s.y+8,'#fff5d9',3);}
      ctx.restore();
    }
    if(w.id==='arc_core')for(const c of w.chains) {
      ctx.save();ctx.globalAlpha=Math.min(1,c.life/c.maxLife*2);
      for(let i=1;i<c.points.length;i++) {
        const a=c.points[i-1],b=c.points[i],mx=(a.x+b.x)/2+(i%2?10:-10),my=(a.y+b.y)/2-6;
        line(ctx,a.x,a.y,mx,my,c.isBolt?'#c6a9f0':'#86d7ed',5);line(ctx,mx,my,b.x,b.y,'#eafaff',3);
      }ctx.restore();
    }
    if(w.id==='orbital_satellites' && p) {
      const radius=(70+(w.level-1)*8)*p.areaBonus,count=w.isEvolved?6:2+w.level-1;
      if(w.isEvolved){ctx.save();ctx.globalAlpha=.45;ring(ctx,p.x,p.y,radius,'#b6a3e8',3);ctx.restore();}
      for(let i=0;i<count;i++){const a=w.angle+i*Math.PI*2/count;tile(ctx,6,8,p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius,w.isEvolved?26:20);}
    }
    if(w.id==='plasma_cannon')for(const b of w.projectiles) {
      const r=Math.max(6,b.radius),speed=Math.hypot(b.vx,b.vy);
      const length=Math.min(b.isEvolved?64:42,(b.age||0)*speed);
      const shell=b.isEvolved?'#b899ed':'#69cce8',rim=b.isEvolved?'#745da9':'#35798e';
      ctx.save();
      for(let i=5;i>=1;i--){
        const t=i/5,x=b.x-Math.cos(b.angle)*length*t,y=b.y-Math.sin(b.angle)*length*t;
        ctx.globalAlpha=.65*(1-t*.7);const size=Math.max(2,Math.round(r*(1-t*.65)));
        ctx.fillStyle=shell;ctx.fillRect(snap(x)-size/2,snap(y)-size/2,size,size);
      }
      ctx.globalAlpha=1;
      ring(ctx,b.x,b.y,r,rim,3);
      ctx.fillStyle=shell;ctx.fillRect(snap(b.x-r*.65),snap(b.y-r*.65),r*1.3,r*1.3);
      ctx.fillStyle='#e1fbff';ctx.fillRect(snap(b.x-r*.35),snap(b.y-r*.35),r*.7,r*.7);
      const spin=(b.age||0)*12;
      for(let i=0;i<3;i++){const a=spin+i*Math.PI*2/3;ctx.fillStyle='#c6f8ff';ctx.fillRect(snap(b.x+Math.cos(a)*r),snap(b.y+Math.sin(a)*r),3,3);}
      ctx.restore();
    }
    if(w.id==='plasma_cannon'){
      for(const flash of w.muzzleFlashes){
        ctx.save();ctx.globalAlpha=flash.life/flash.maxLife;
        const x=flash.x+Math.cos(flash.angle)*20,y=flash.y+Math.sin(flash.angle)*20;
        ring(ctx,x,y,8+(1-flash.life/flash.maxLife)*12,'#b6f1ff',3);
        line(ctx,x-5,y,x+5,y,'#ffffff',3);ctx.restore();
      }
      for(const hit of w.impacts){
        const t=1-hit.life/hit.maxLife;ctx.save();ctx.globalAlpha=1-t;
        const r=(hit.isEvolved?30:20)*t;
        ring(ctx,hit.x,hit.y,r,hit.isEvolved?'#c5a5ff':'#83e9ff',3);
        for(let i=0;i<4;i++){const a=i*Math.PI/2+.78;line(ctx,hit.x+Math.cos(a)*r,hit.y+Math.sin(a)*r,hit.x+Math.cos(a)*(r+7),hit.y+Math.sin(a)*(r+7),'#e1fbff',2);}
        ctx.restore();
      }
    }
    if(w.id==='black_hole')for(const h of w.holes) {
      ctx.save();ctx.globalAlpha=.9;ring(ctx,h.x,h.y,h.radius*.72,'#8b70b5',3);
      for(let n=0;n<3;n++)for(let i=0;i<18;i++) {
        const a=h.rotation+n*2.094+i*.16,r=h.radius*(.1+i/25);
        ctx.fillStyle=i%3?'#615481':'#c3b4ed';ctx.fillRect(snap(h.x+Math.cos(a)*r),snap(h.y+Math.sin(a)*r),4,4);
      }
      tile(ctx,8,4,h.x,h.y,34);ctx.restore();
    }
    if(w.id==='prism_ray')for(const b of w.beams) {
      const dx=Math.cos(b.angle)*b.length,dy=Math.sin(b.angle)*b.length;
      ctx.save();ctx.globalAlpha=Math.min(.75,b.life/b.maxLife*1.5);
      line(ctx,b.x,b.y,b.x+dx,b.y+dy,b.isEvolved?'#b59ad9':'#79baca',Math.max(4,Math.round(b.width*.6)));
      line(ctx,b.x,b.y,b.x+dx,b.y+dy,'#f3f1d1',3);ctx.restore();
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
