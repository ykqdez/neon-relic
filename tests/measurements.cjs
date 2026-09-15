exports.verifyMeasurements = ({focused, logic, extra, bench}, check) => {
  const f = name => focused.find(t => t.name === name)?.result;
  const l = name => logic.find(t => t.name === name)?.result;
  check(f('single_blackhole_lifetime_hit_times')?.hits === 13, 'black hole exact lifetime hits');
  check(f('prism_damage_after_expiration')?.damage === 0, 'no beam damage after expiration');
  for (const name of ['supernova_priority_flag','boss_hazard_priority_flag']) check(f(name)?.shockwaves.length > 0 && f(name).shockwaves.every(s=>s.priority), name);
  const damage = f('damage_stats_without_text');
  check(damage?.highest===83 && damage.total===83 && damage.kills===1, 'damage accounting without text', damage);
  const caps = {casual:72,normal:105,hard:135};
  for(const row of f('boss_caps_elites_and_pending_deaths') || []) check(row.atSpawn.living<=caps[row.diff] && row.atSpawn.deadRetained && row.afterUpdate.kills===1 && row.afterUpdate.hasBoss,'boss cap and death accounting '+row.diff,row);
  const targets=f('tempest_target_sampling');
  check(targets?.duplicates===0 && targets.dead===0 && targets.counts.slice(0,24).every(n=>n>=2250&&n<=2750),'tempest distinct uniform living targets');
  const evolutions=f('all_evolution_choices_guarantee_and_uniqueness');
  check(evolutions?.failures===0 && Object.values(evolutions.first).length===6 && Object.values(evolutions.first).every(n=>n>=1400&&n<=1950),'six evolution priority candidates uniform');
  for(const row of f('sustained_60s_fps') || []) {
    const values=[30,60,120,144].map(fps=>row[fps]);
    check(values.every(Number.isFinite) && (Math.max(...values)-Math.min(...values))/Math.max(...values)<=.05,'60-second cross-FPS '+row.id,values);
  }
  check(bench.all.length===6,'six weapon benchmarks');
  for(const row of bench.all) {
    check(row.levelsAt100.length===5 && row.levelsAt100.every(n=>Number.isFinite(n)&&n>=0) && row.evolvedAt100>0,'weapon levels finite '+row.id);
    for(const kind of ['lv5','evo']) {
      const values=row.fps.filter(r=>[30,60,120,144].includes(r.fps)).map(r=>r[kind]);
      check((Math.max(...values)-Math.min(...values))/Math.max(...values)<=.05,'10-second cross-FPS '+row.id+'/'+kind,values);
    }
  }
  check(l('start_pause_resume')?.states.join(',')==='playing,paused,playing','start/pause/resume');
  check(l('drawer_escape')?.drawerActive===false && l('drawer_escape').state==='playing','drawer Escape');
  const blur=l('blur_stuck_movement');check(blur?.resumeX===0 && blur.vector.x===0 && !blur.keys.right,'blur input reset');
  check(l('pause_key_repeat')?.repeat==='paused','key repeat ignored');
  check(l('restart_camera')?.cameraX===0,'restart camera');
  const queue=l('continuous_upgrade_queue');check(queue?.picked===queue.before.pending && queue.after.pending===0 && queue.after.state==='playing','upgrade queue drained');
  check(l('all_six_evolution_recipes')?.length===6 && l('all_six_evolution_recipes').every(r=>r.evolved && r.level===5),'six evolution recipes retain level');
  const shield=l('shield_overflow_and_highest_hit');check(shield?.hp===57 && shield.shield===0 && shield.total===83 && shield.highest===83,'shield overflow single accounting');
  const orbit=l('orbital_haste_and_clock');check(orbit?.base===orbit.frozenClock && orbit.haste5>orbit.base,'satellite sim clock and CDR benefit');
  check(l('sniper_zero_distance')?.finite,'sniper finite at zero distance');
  check(l('boss_phases_resistance')?.phases.join(',')==='1,2,3' && l('boss_phases_resistance').resists,'boss phases and resistance');
  check(l('fission_spawn_cap')?.living<=96,'fission cap');
  check(l('crystal_merge_and_conservation')?.total===200,'crystal conservation');
  check(l('crystal_exact_overlap')?.remaining===0,'exact overlap pickup');
  const win=l('victory_and_restart');check(win?.won.bossKills===1 && win.won.state==='gameover' && win.after.state==='playing' && win.after.time===0,'victory and restart');
  check(l('death_flow')?.state==='gameover','death flow');
  const choiceValues=Object.values(extra.nativeRandomChoices);
  check(choiceValues.length===14 && choiceValues.every(n=>n>=19.5&&n<=23.5),'50k native card samples uniform',extra.nativeRandomChoices);
  check(extra.audioThrottle?.critNodes<=1 && extra.audioThrottle?.normalNodes<=1,'synchronous sound throttling');
  for(const row of extra.stress) check(row.maxShock<=(row.mobile?20:35) && row.damageTexts<=25,'stress effect bounds mobile='+row.mobile,row);
  check(extra.restartInput.vector.magnitude===0,'restart clears keyboard vector');
};
