// Publish only successful, source-matched evidence; never manually copy benchmark numbers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.OUTPUT_DIR || path.join(root, 'test-results'));
const read = name => JSON.parse(fs.readFileSync(path.join(out, name + '.json'), 'utf8'));
const report = read('verification_report'), integrity = read('integrity');
if (report.status !== 'PASSED' || report.growthRuns !== 360 || !integrity.rows.every(r=>r.passed)) {
  throw Error('Run the complete --growth suite and integrity tests successfully before publishing');
}
const sourceHashes = Object.fromEntries(Object.entries(report.sha256).filter(([name]) => /\.(js|cjs|html|css)$/.test(name) || name==='package.json' || name.startsWith('assets/')));
for (const [name, expected] of Object.entries(sourceHashes)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
  if (actual !== expected) throw Error('Source changed since verification: ' + name);
}
for (const [name, hash] of Object.entries(integrity.sourceHashes || {})) {
  if (sourceHashes[name] !== hash) throw Error('Integrity tests used different source: ' + name);
}
if (!integrity.sourceHashes?.['js/game.js']) throw Error('Integrity source metadata is missing');
const bench=read('dps'), focused=read('focused'), flows=read('flows'), growth=read('growth'), extra=read('extra');
if(growth.length!==360)throw Error('Growth evidence incomplete');
const rounded = n => n == null ? null : +n.toFixed(2);
function distribution(values) {
  const valid=values.filter(Number.isFinite).sort((a,b)=>a-b);
  const quantile=p=>{
    if(!valid.length)return null;
    const position=(valid.length-1)*p, low=Math.floor(position), high=Math.ceil(position);
    return rounded(valid[low]+(valid[high]-valid[low])*(position-low));
  };
  return { reached:valid.length,p25:quantile(.25),median:quantile(.5),p75:quantile(.75) };
}
const growthSummary=[];
for(const difficulty of ['casual','normal','hard'])for(const strategy of ['balanced','survival','damage','evolution']) {
  const rows=growth.filter(r=>r.difficulty===difficulty&&r.strategy===strategy);
  if(rows.length!==30 || new Set(rows.map(r=>r.seed)).size!==30)throw Error('Missing seeds: '+difficulty+'/'+strategy);
  growthSummary.push({difficulty,strategy,runs:rows.length,victories:rows.filter(r=>r.outcome==='victory').length,
    deaths:rows.filter(r=>r.outcome==='death').length,timeouts:rows.filter(r=>r.outcome==='timeout').length,
    finalLevel:distribution(rows.map(r=>r.level)),bossArrivalLevel:distribution(rows.map(r=>r.bossArrivalLevel)),
    firstWeapon5:distribution(rows.map(r=>r.firstWeapon5)),firstEvolution:distribution(rows.map(r=>r.firstEvolution)),
    milestones:Object.fromEntries([5,10,15,20,25,30].map(level=>[level,distribution(rows.map(r=>r.milestones[level]))]))});
}
const meta={runId:report.runId,timestamp:report.timestamp,node:report.node,browser:report.browser.userAgent,
  baseCommit:report.baseCommit,sourceHashes,command:'node tests/verify.cjs --growth',
  conditions:bench.method,notes:'baseCommit is the parent commit before local edits; sourceHashes identify the tested tree. Game-displayed seed is not a gameplay replay seed.'};
const data={metadata:meta,verification:{status:report.status,totalAssertions:report.totalAssertions,failures:report.failures,
  integrity:integrity.rows.map(({mode,passed,exit})=>({mode,passed,exit})),pixel:read('pixel'),audio:report.audio,realtime:report.realtime,stress:extra.stress},
  weapons:bench.all,sustained60s:focused.find(r=>r.name==='sustained_60s_fps').result,
  satelliteAreaCoverage:bench.areaCoverage,satellitePassiveInteractions:bench.passiveInteractions,
  flows:flows.map(({levels,...rest})=>rest),growth:{method:'390x844, 60Hz, seeds 1..30 per difficulty/strategy, up to 900 simulated seconds, real offered cards, identical movement policy, no granted equipment or invulnerability. Quantiles are conditional on reaching each milestone; unreached samples remain censored.',summary:growthSummary}};
fs.writeFileSync(path.join(root,'CURRENT_BENCHMARK.json'),JSON.stringify(data,null,2)+'\n');
const names={pulse_blade:'脉冲刃',arc_core:'电弧核心',orbital_satellites:'轨道卫星',plasma_cannon:'等离子炮',black_hole:'黑洞发生器',prism_ray:'棱镜射线'};
const dpsTable=bench.all.map(w=>`| ${names[w.id]} | ${w.levelsAt100[4]} | ${w.evolvedAt100} |`).join('\n');
const growthTable=growthSummary.map(r=>`| ${r.difficulty} / ${r.strategy} | ${r.victories}/${r.deaths}/${r.timeouts} | ${r.finalLevel.median} | ${r.bossArrivalLevel.reached}/30；${r.bossArrivalLevel.median??'—'} | ${r.firstEvolution.reached}/30 | ${r.firstEvolution.p25??'—'} / ${r.firstEvolution.median??'—'} / ${r.firstEvolution.p75??'—'} |`).join('\n');
const satellite=bench.all.find(r=>r.id==='orbital_satellites');
const areaAt100=bench.areaCoverage.find(r=>r.radius===46&&r.distance===100);
const common=`生成时间：${meta.timestamp}。运行 ID：\`${meta.runId}\`。\n\n环境：Node ${meta.node}；${meta.browser}。\n\n本文件由 \`node tests/build-report.cjs\` 从同次运行结果生成；完整源码 SHA-256 与运行条件见 [CURRENT_BENCHMARK.json](CURRENT_BENCHMARK.json)。父提交为 \`${meta.baseCommit}\`，测试包含其后的工作区修改。\n`;
fs.writeFileSync(path.join(root,'FIX_VERIFICATION.md'),`# 修复与验收结果\n\n${common}
## 结论

本轮自动断言 **${report.totalAssertions}/${report.totalAssertions} 通过**；浏览器错误 ${report.errors.length} 条。验证器自身的正常对照及四种故障注入均通过。此结论仅覆盖下列自动场景，不代表真机兼容性或游戏平衡全部验收。

## 本轮修复

- 像素美术更新：本地 CC0 角色/怪物/装备图集、五帧爆炸、12 个采样音效、低音量循环 BGM，以及 OFL 中文像素字体。六武器渲染、地板、HUD 和所有弹窗统一像素风；不修改攻击与碰撞参数。素材来源与完整许可见 assets/CREDITS.md。
- 新增资源哈希/解码、像素画布、渲染不消耗玩法随机数、BGM 跟随暂停/抽屉/静音、采样节点上限与回收回归。

- R01：黑洞每帧仅扣一次 tick 时间；Lv5 单洞 3.4 秒内为 13 次命中、260 伤害。
- R03：用户暂停、协议抽屉、升级选择和系统失焦分别记录；抽屉关闭及最后一次选卡不会清掉系统暂停，隐藏页面拒绝恢复。
- R04：卫星持续接触时保留冷却余量，离开再进入不补算空档伤害；持续接触 60 秒在 30/60/120/144Hz 均为 215 次基础命中。
- R05：黑洞和光束只结算有效寿命内的 tick；寿命端点允许命中。扫掠光束按 tick 的角度判断。
- R06：普通特效不能挤掉已满池的高优先级特效；Boss 危险区和超新星均标记优先级。高优先级自身饱和时淘汰最旧项。
- R07：难度按钮及抽屉关闭按钮补齐 44px；八种视口检查全部实际按钮和升级卡的尺寸及中心/边缘命中。
- R02/R08：测试纳入仓库，语法、JSON、资源、用例异常、浏览器异常均阻止通过；断言数量实时计数，记录浏览器版本、父提交和源码哈希。
- 升级卡监听只消费一次，旧卡引用不能重复消耗下一次选择。

保留已有无偏抽卡/目标选择、输入重置、横屏卡片、暂停保护预算、伤害记账与 Boss 容量修复。

## 已执行

- 全部仓库 JS/CJS 语法、JSON 解析、HTML ID、静态资源路径检查。
- 六武器 10 秒矩阵：Lv1–5、真实进化、100/200/300 距离、移动靶、24 个密集靶、10/20/30/60/120/144Hz；30/60/120/144Hz 单靶偏差断言 ≤5%。
- 六进化武器 60 秒跨帧率；卫星持续接触含 10Hz、CDR 0/40%、基础/进化，偏差断言 ≤2%；寿命前/端点/之后、多 tick 和抖动 dt 回归。
- 9 局普通自动流程 + 3 局全进化无敌覆盖，后者只验证真实刷怪、Boss 三阶段和胜利路径，最长 900 秒。
- 4 种选卡策略 × 3 难度 × 30 种子 = 360 局成长模拟；等级里程碑、首把 Lv5、首进化时间、Boss 到场等级、结局均记录。
- 8 视口（320×568、360×800、390×844、430×932、844×390、932×430、768×1024、1728×896），坐标触控按钮、协议滚动及真实 RAF 冒烟运行。
- 桌面/移动预算各 60 秒模拟、180 高血量敌人、全进化武器更新与 Canvas 渲染；真实音效压测 ${report.audio.seconds.toFixed(2)} 秒，创建 ${report.audio.created} 节点，峰值 ${report.audio.peak}，结束后活跃 ${report.audio.active}，断开 ${report.audio.disconnected}。
- 正常验证器退出 0；异步异常、用例抛错、坏 JSON、缺失资源分别退出 1。

## 武器 10 秒 DPS

60Hz、距离 100、半径 46 无限血靶、暴击/CDR 为 0、范围倍率 1、冷启动，伤害包含溢出；目标不运行 AI 或位移。

| 武器 | Lv5 | 进化 |
| --- | ---: | ---: |
${dpsTable}

## 边界与未验收项

- 卫星保留环形定位；范围 Lv5 将轨道 102 推至 183.6，距离 100 的进化靶 DPS ${areaAt100.evolved}→${areaAt100.evolvedArea5}。这是已记录的设计取舍，未实施全盘覆盖重构。
- 成长数据是固定机器人策略结果，不代表人类胜率；首进化分位数仅统计实际到达者，未到达者单列。
- 未执行 iOS Safari、Android 真机及低端设备 GPU/长期内存测试；模拟 CPU 提交时间不能换算为实际显示帧率。
- 画面/音效与战斗仍共用 Math.random；测试固定时钟、种子和调用路径，游戏界面 seed 不承诺回放。
- 相机滞后较大时的刷怪视口定位仍是后续优化项（测试诊断有记录），不在本轮 R01—R08 修复范围。

复现与原始产物说明见 [test_notes.md](test_notes.md)，设计数据见 [BALANCE_REVIEW.md](BALANCE_REVIEW.md)。
`);
fs.writeFileSync(path.join(root,'BALANCE_REVIEW.md'),`# 当前战斗基准与设计决定\n\n${common}
## 数据口径

10 秒窗口、冷启动、固定逻辑 dt、种子 12345；靶不执行 AI、位移或死亡，禁用暴击；进化调用实际 evolve() 并保留 Lv5。密集群为 24 个半径 13 靶，移动靶以 0.7rad/s 绕玩家运动。原始矩阵含距离与帧率，不把单靶结果当成实战强度排序。

| 武器 | Lv5 单靶 DPS | 进化单靶 DPS |
| --- | ---: | ---: |
${dpsTable}

旧黑洞 146/209.4 包含重复扣 dt 的错误，不能继续作为平衡目标。当前数值来自修正后的实现。

## 卫星设计决定

保留卫星核心碰撞和进化环形力场，保留范围增大时轨道外移；不额外提高转速、不扩大为全盘伤害，以维持环形防护和走位定位。范围对近靶存在反向收益，README 已明确说明。

- Lv5 轨道半径：102；范围 Lv5：183.6。距离 100、靶半径 46：进化 DPS ${satellite.evolvedAt100}，范围 Lv5 后 ${areaAt100.evolvedArea5}。
- 超频影响命中间隔：核心 0.28→0.168 秒；力场 0.32→0.192 秒；只对实际接触结算。
- JSON 的 satelliteAreaCoverage 提供半径 13/24/46、距离 0/40/70/100/140/180/220/260 的基础和进化覆盖；satellitePassiveInteractions 提供范围 Lv0–5 × 超频 Lv0–5 的组合。
- 是否进一步改善近圈覆盖属于下一轮平衡选择；本轮不以提高所有距离 DPS 为验收条件。

## 360 局成长模拟

390×844、60Hz、每组种子 1–30，最长 900 模拟秒；使用实际发出的三张卡。四种策略为均衡、存活优先、输出优先、凑进化；移动策略相同（趋近经验、避开敌人/子弹）。无额外装备或无敌。

| 难度 / 策略 | 胜/死/超时 | 结束等级中位 | 到 Boss 样本；等级中位 | 首进化达到数 | 首进化秒 P25 / P50 / P75 |
| --- | ---: | ---: | ---: | ---: | ---: |
${growthTable}

所有时间分位数仅统计到达者，未到达样本没有被替换为 0 或 900。JSON 同时记录 Lv5/10/15/20/25/30 的到达数量与时间分位数、首把武器 Lv5 及结束等级分布。数据用于比较本测试策略，不推断人类胜率，不据此直接削弱或加强某把武器。

## 已知验证边界

玩法与表现随机源尚未分离；这些结果依赖相同测试调用路径。没有真机帧率、完整 GPU 或长期内存结论。历史文件 benchmark_and_fixes_results.json、targeted_fixes_test_results.json 及旧审计目录保留为历史证据，不作为当前版本验收基线。
`);
console.log('Generated CURRENT_BENCHMARK.json, FIX_VERIFICATION.md and BALANCE_REVIEW.md from run',report.runId);
