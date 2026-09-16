/* Controlled audition page; reuses the production SoundSystem, not a second mixer. */
(() => {
  const sound=window.soundSystem,status=document.getElementById('status'),progress=document.getElementById('progress');
  window.game={player:{x:0,y:0},camera:{x:0,y:0,width:800,height:600,zoom:1},pauseReasons:new Set()};
  let generation=0,frame=0,allowMusic=false;
  const musicWanted=sound.musicWanted.bind(sound);
  sound.musicWanted=()=>allowMusic&&document.getElementById('music').checked&&musicWanted();
  function stop(message='已停止。') {
    generation++;allowMusic=false;cancelAnimationFrame(frame);sound.stopAll();sound.hasUnlocked=false;sound.setGameState('ready');
    sound.music.pause();status.textContent=message;progress.value=0;
  }
  async function audition(id) {
    stop('正在准备声音…');const token=generation;
    try {
      await sound.ctx.resume();await sound.ready;if(token!==generation)return;
      if(sound.failed.length)throw Error('部分声音加载失败，请刷新后重试。');
      sound.isMuted=false;sound.lastSoundTimes={};sound.setGameState('playing');
      allowMusic=id==='mixed';
      if(allowMusic){sound.hasUnlocked=true;sound.syncMusic();}
      const weapons={},events=[];let duration=1.5;
      const add=(time,label,fn)=>events.push({time,label,fn});
      const attack=(name,evolved=false)=>sound.playWeaponAttack(name,evolved);
      function sustain(name,life){weapons[name]={level:5,[name==='prism_ray'?'beams':'holes']:[{x:0,y:0,life}]};}
      if(id==='mixed') {
        duration=4;add(0,'六种武器释放',()=>{for(const name of Object.keys(WEAPON_ATTACK_SOUNDS))attack(name,true);sustain('prism_ray',1);sustain('black_hole',3.4);});
        add(.6,'危险提示优先，战斗声降低',()=>sound.playEnemyCue('sniper',{x:80,y:0}));
        add(1.5,'玩家受伤',()=>sound.playHurt());add(2.3,'晶体拾取',()=>sound.playGem(25));
        add(3.4,'黑洞坍缩',()=>sound.playExplosion(true,{x:0,y:0}));
      } else if(id==='black_hole'||id==='supernova') {
        duration=3.9;add(0,'黑洞生成，牵引持续 3.4 秒',()=>{attack('black_hole',id==='supernova');sustain('black_hole',3.4);});
        add(3.4,id==='supernova'?'超新星爆发':'牵引结束，声音淡出',()=>{if(id==='supernova')sound.playExplosion(true,{x:0,y:0});});
      } else if(id==='prism_ray') {
        add(0,'进化射线开始灼烧',()=>{attack(id,true);sustain(id,1);});add(1,'射线结束，持续声淡出',()=>{});
      } else if(id==='plasma_cannon') {
        add(0,'能量弹发射',()=>attack(id));add(.45,'弹体命中右侧敌人',()=>sound.playImpact({x:120,y:0}));
      } else if(id==='orbital_satellites') {
        for(let i=0;i<4;i++)add(i*.3,'卫星实际接触 '+(i+1),()=>attack(id));
      } else if(id==='death') {
        duration=2.8;for(const [i,label] of ['普通怪死亡','精英死亡','Boss 死亡'].entries())add(i*.8,label,()=>sound.playEnemyDeath(i===1,i===2));
      } else if(id==='enemy') {
        add(0,'敌人开始蓄力，预警响一次',()=>sound.playEnemyCue('sniper',{x:-100,y:0}));add(.65,'方向锁定，进入闪避窗口',()=>{});add(1,'开火，进入休整',()=>{});
      } else if(id==='hurt')add(0,'玩家确实受到伤害',()=>sound.playHurt());
      else if(id==='gem'){add(0,'小晶体拾取',()=>sound.playGem(1));add(.6,'大晶体拾取',()=>sound.playGem(25));}
      else if(id==='victory'||id==='defeat'){duration=2;add(0,id==='victory'?'胜利结算':'失败结算',()=>{sound.setGameState('gameover');sound.playResult(id==='victory');});}
      else add(0,id==='arc_core'?'电弧释放，雷击自然衰减':'脉冲刃挥切',()=>attack(id));
      const started=performance.now();let previous=started;
      const update=now=>{
        if(token!==generation)return;
        const elapsed=(now-started)/1000,dt=(now-previous)/1000;previous=now;
        for(const w of Object.values(weapons))for(const effect of (w.beams||w.holes))effect.life=Math.max(0,effect.life-dt);
        for(const event of events)if(!event.done&&elapsed>=event.time){event.done=true;status.textContent=event.label;event.fn();}
        sound.syncWeaponSustains(weapons);progress.value=Math.min(1,elapsed/duration);
        if(elapsed<duration)frame=requestAnimationFrame(update);else stop('本段结束，可以选择下一项。');
      };
      frame=requestAnimationFrame(update);
    }catch(error){if(token===generation)stop('未能播放：'+error.message);}
  }
  for(const button of document.querySelectorAll('[data-cue]'))button.addEventListener('click',()=>audition(button.dataset.cue));
  document.getElementById('stop').addEventListener('click',()=>stop());
  document.getElementById('music').addEventListener('change',()=>sound.syncMusic());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
})();
