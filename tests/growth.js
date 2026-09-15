// The same movement policy is used for all four card strategies to isolate build choices.
window.growthRun = (difficulty, strategy, seed) => {
  const g = resetAudit(difficulty); seedRng(seed);
  const originalGenerate = g.upgradeSystem.generateChoices;
  let offered = [], choices = 0, firstEvolution = null, firstWeapon5 = null, bossArrivalLevel = null, nonfinite = false;
  const milestones = {}, evolutions = [];
  g.upgradeSystem.generateChoices = function(...args) {
    offered = originalGenerate.apply(this, args);
    return offered;
  };
  const damage = {prism_ray:90,plasma_cannon:85,pulse_blade:70,arc_core:65,black_hole:60,haste:55,crit:50,orbital_satellites:45,hp:40,armor:35,area:30,speed:25,exp:20,pickup:15};
  function score(card) {
    if (card.type === 'evolution') return 200;
    let value = damage[card.targetId] || 0;
    if (strategy === 'survival') value += ({hp:100,armor:95,speed:80,pickup:30}[card.targetId] || 0);
    if (strategy === 'balanced') value = card.type === 'weapon' ? 50+g.weapons[card.targetId].level*10 :
      ({hp:65,armor:60,haste:65,crit:55,exp:60,pickup:50,speed:45,area:40}[card.targetId] || 0)-(g.passives[card.targetId]?.level || 0)*6;
    if (strategy === 'evolution') {
      if (card.type === 'weapon') value += g.weapons[card.targetId].level * 30;
      if (card.type === 'passive') for (const [id, passive] of Object.entries(g.upgradeSystem.evolutionRecipes)) {
        if (passive === card.targetId && g.passives[passive].level === 0) value += g.weapons[id].level * 35;
      }
    }
    return value;
  }
  try {
    for (let frame = 0; frame < 900*60 && g.state !== 'gameover'; frame++) {
      if (g.state === 'upgrade') {
        if (!offered.length || ++choices >= 500) throw Error('Growth upgrade queue stalled');
        let best=0; for(let i=1;i<offered.length;i++) if(score(offered[i])>score(offered[best]))best=i;
        const selected=offered[best];
        document.querySelectorAll('#upgrade-cards-list .upgrade-card')[best].click();
        if(selected.type==='evolution') {firstEvolution ??=g.elapsedTime;evolutions.push({time:g.elapsedTime,id:selected.targetId});}
        if(Object.values(g.weapons).some(w=>w.level===5)) firstWeapon5 ??=g.elapsedTime;
        frame--; continue;
      }
      if (g.state !== 'playing') throw Error('Unexpected growth state: ' + g.state);
      const p=g.player;
      let tx=Math.cos(g.elapsedTime*.055)*550,ty=Math.sin(g.elapsedTime*.055)*550;
      let nearest=null,dist=Infinity;
      for(const c of g.crystals){const d=Math.hypot(c.x-p.x,c.y-p.y);if(d<dist){nearest=c;dist=d;}}
      if(nearest){tx=nearest.x;ty=nearest.y;}
      let dx=tx-p.x,dy=ty-p.y,len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
      for(const e of g.enemies){const ex=p.x-e.x,ey=p.y-e.y,d=Math.hypot(ex,ey);if(d<150&&d>0){const f=(150-d)/150*2.4;dx+=ex/d*f;dy+=ey/d*f;}}
      for(const b of g.enemyBullets){const bx=p.x-b.x,by=p.y-b.y,d=Math.hypot(bx,by);if(d<75&&d>0){dx+=bx/d*(75-d)/75*2;dy+=by/d*(75-d)/75*2;}}
      if(Math.abs(p.x)>1100)dx-=Math.sign(p.x)*2;if(Math.abs(p.y)>1100)dy-=Math.sign(p.y)*2;
      len=Math.hypot(dx,dy)||1;g.input.vector={x:dx/len,y:dy/len,magnitude:1};auditClock+=1000/60;g.update(1/60);
      if(g.activeBoss)bossArrivalLevel ??=p.level;
      for(const level of [5,10,15,20,25,30])if(p.level>=level && milestones[level]===undefined)milestones[level]=g.elapsedTime;
      if(![p.x,p.y,p.hp,...g.enemies.flatMap(e=>[e.x,e.y,e.hp]),...g.enemyBullets.flatMap(b=>[b.x,b.y,b.vx,b.vy])].every(Number.isFinite)){nonfinite=true;break;}
    }
    return {difficulty,strategy,seed,state:g.state,time:g.elapsedTime,level:g.player.level,
      outcome:g.stats.bossKills>0?'victory':g.state==='gameover'?'death':'timeout', choices,firstEvolution,firstWeapon5,bossArrivalLevel,milestones,evolutions,nonfinite,
      weapons:Object.fromEntries(Object.entries(g.weapons).map(([id,w])=>[id,{level:w.level,evolved:w.isEvolved}])),
      passives:g.passives};
  } finally {g.upgradeSystem.generateChoices=originalGenerate;}
};
