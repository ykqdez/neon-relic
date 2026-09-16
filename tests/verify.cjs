// Zero-dependency browser verification. Node 22+ and Chromium/Edge are required.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(process.env.PROJECT_ROOT || path.join(__dirname, '..'));
const out = path.resolve(process.env.OUTPUT_DIR || path.join(root, 'test-results'));
fs.mkdirSync(out, { recursive: true });
const assertions = [];
const errors = [];
const report = { runId: crypto.randomUUID(), timestamp: new Date().toISOString(), node: process.version, root, assertions, errors, sha256: {} };
const save = (name, value) => fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
function check(ok, name, detail) {
  assertions.push({ name, passed: !!ok, ...(detail === undefined ? {} : { detail }) });
  if (!ok) console.error('FAIL:', name, JSON.stringify(detail));
}
function cases(rows, suite) {
  check(Array.isArray(rows) && rows.length > 0, suite + ': nonempty');
  for (const row of rows) check(!row.error, suite + ': ' + row.name + ' executes', row.error);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (['.git', 'node_modules', 'test-results'].includes(e.name)) return [];
    const file = path.join(dir, e.name);
    if (file === out) return [];
    return e.isDirectory() ? walk(file) : [file];
  });
}
function staticChecks() {
  report.baseCommit = cp.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim();
  report.workingTree = cp.spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout?.trim();
  for (const file of walk(root)) {
    const name = path.relative(root, file).replaceAll('\\', '/');
    if (/\.(js|cjs|json|html|css)$/.test(file) || name.startsWith('assets/')) report.sha256[name] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (/\.(js|cjs)$/.test(file)) {
      const result = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      check(result.status === 0, 'syntax: ' + name, result.stderr?.trim() || undefined);
    }
    if (file.endsWith('.json')) {
      try { JSON.parse(fs.readFileSync(file, 'utf8')); check(true, 'JSON: ' + name); }
      catch (e) { check(false, 'JSON: ' + name, e.message); }
    }
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const assets=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  for(const asset of assets.files) {
    const file=path.resolve(root,asset.path);
    const exists=file.startsWith(root+path.sep)&&fs.existsSync(file);
    check(exists && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===asset.sha256,'asset integrity: '+asset.path);
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  check(new Set(ids).size === ids.length, 'HTML IDs unique');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    check(fs.existsSync(path.resolve(root, ref.split(/[?#]/)[0])), 'local reference: ' + ref);
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, ws, server, cdp;
const pending = new Map();
async function startBrowser() {
  const executable = [process.env.EDGE_PATH, process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean).find(p => fs.existsSync(p));
  if (!executable) throw Error('Set EDGE_PATH or CHROME_PATH to a Chromium executable');
  server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    try {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg','.woff2':'font/woff2','.json':'application/json'};
      res.setHeader('Content-Type',types[path.extname(file)]||'text/html; charset=utf-8');
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(out, 'browser-profile-'));
  browser = cp.spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--no-first-run', '--disable-extensions', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let launchError;
  browser.on('error', e => { launchError = e; });
  let tabs;
  for (let i = 0; i < 100; i++) {
    if (launchError) throw launchError;
    try {
      const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(1000) })).json();
      if (tabs.some(t => t.type === 'page')) break;
    } catch { /* Browser still starting. */ }
    await sleep(100);
  }
  const tab = tabs?.find(t => t.type === 'page');
  if (!tab) throw Error('Browser startup timed out');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('WebSocket open timeout')), 10000);
    ws.onopen = () => { clearTimeout(timer); resolve(); };
    ws.onerror = () => { clearTimeout(timer); reject(Error('WebSocket error')); };
  });
  let seq = 0;
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
      message.error ? item.reject(Error(JSON.stringify(message.error))) : item.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown' ||
      (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') ||
      (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')) errors.push(message);
  };
  ws.onclose = () => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('Browser connection closed')); }
    pending.clear();
  };
  cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 90000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.auditOriginalRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;'
  });
  if(process.argv.includes('--no-ogg')){
    report.noOgg=true;
    await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
      window.auditRejectedOgg=0;
      const originalDecode=AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData=function(data,...args){
        const bytes=new Uint8Array(data,0,Math.min(4,data.byteLength));
        if(String.fromCharCode(...bytes)==='OggS'){window.auditRejectedOgg++;return Promise.reject(new DOMException('OGG unsupported','EncodingError'));}
        return originalDecode.call(this,data,...args);
      };`});
  }
  await cdp('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/' });
}
async function ev(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function main() {
  staticChecks();
  if (assertions.some(a => !a.passed)) return;
  await startBrowser();
  let ready = false;
  for (let i = 0; i < 100; i++) {
    ready = await ev('!!window.gameInstance');
    if (ready) break;
    await sleep(100);
  }
  if (!ready) throw Error('Game startup timed out');
  report.browser = await ev('({userAgent:navigator.userAgent,initialState:game.state})');
  check(report.browser.initialState === 'ready', 'initial state ready');
  for (const file of ['scenarios.js', 'diagnostics.js', 'regression-probes.js', 'checks.js', 'pixel-checks.js', 'experience-checks.js']) await ev(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  await ev('auditSaved.sound.ready');
  if(report.noOgg)check(await ev('auditRejectedOgg===0&&auditSaved.sound.failed.length===0&&auditSaved.sound.buffers.size===15'),'all SFX decode with OGG support disabled');
  if (process.env.VERIFY_FAULT === 'async') await ev('setTimeout(()=>{throw Error("VERIFY_ASYNC_SENTINEL")},0)');
  if (process.env.VERIFY_FAULT === 'case') cases(await ev('[(()=>{try{throw Error("VERIFY_CASE_SENTINEL")}catch(e){return {name:"injected",error:e.message}}})()]'), 'injected');
  const core = await ev('regressionChecks()');
  for (const row of core) check(row.passed, 'regression: ' + row.name, row.detail);
  save('regressions', core);
  if (process.argv.includes('--smoke')) { await sleep(100); return; }
  const pixel=await ev('pixelChecks()');save('pixel',pixel);
  for(const row of pixel)check(row.passed,'pixel: '+row.name,row.detail);
  const experience=await ev('experienceChecks()');save('experience',experience);
  for(const row of experience)check(row.passed,'experience: '+row.name,row.detail);
  const bladeFrames=await ev('window.bladePreview');
  for(let i=0;i<bladeFrames.length;i++)fs.writeFileSync(path.join(out,`blade-trail-${i}.png`),Buffer.from(bladeFrames[i].split(',')[1],'base64'));
  fs.writeFileSync(path.join(out,'plasma-preview.png'),Buffer.from((await ev('window.plasmaPreview')).split(',')[1],'base64'));
  if(process.argv.includes('--preview')) {
    const layouts=[];
    for(const [width,height] of [[390,844],[960,640],[844,390],[320,568]]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
      for(const screen of ['start','battle','boss','upgrade','gear']) {
        await ev(`pixelScene(${JSON.stringify(screen)})`);await sleep(100);
        const shot=await cdp('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(out,`pixel-${screen}-${width}.png`),Buffer.from(shot.data,'base64'));
      }
      const controls=await ev('measureControls()');
      for(const c of controls)check(c.width>=44&&c.height>=44&&c.hittable,`preview control ${width}: ${c.id}`,c);
      layouts.push({width,height,controls});
    }
    save('pixel-layouts',layouts);return;
  }
  console.log('Running diagnostics and DPS matrix...');
  const focused = await ev('focusedRecheck()'); cases(focused, 'focused'); save('focused', focused);
  const logic = await ev('auditTests()'); cases(logic, 'logic'); save('logic', logic);
  await ev('auditSaved.sound?.ctx?.resume()');
  const extra = await ev('auditExtra()'); save('extra', extra);
  const bench = await ev('auditBenchmarks()'); save('dps', bench);
  const { verifyMeasurements } = require('./measurements.cjs');
  verifyMeasurements({ focused, logic, extra, bench }, check);
  console.log('Running game flows...');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const flows = await ev('auditFlows()'); save('flows', flows);
  check(flows.length === 12, '12 flow scenarios');
  for (const flow of flows) {
    check(!flow.nonfinite && Number.isFinite(flow.time), 'finite flow: ' + flow.diff + '/' + (flow.seed ?? 'controlled'));
    if (flow.controlled) check(flow.bossKills === 1 && flow.phases.length === 3, 'controlled boss victory and phases: ' + flow.diff, flow);
  }
  const layouts = [];
  for (const [width, height] of [[320,568],[360,800],[390,844],[430,932],[844,390],[932,430],[768,1024],[1728,896]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 1000 });
    const layout = await ev('auditLayout()');
    check(layout.docWidth <= width && layout.upgrade.scrollWidth <= layout.upgrade.clientWidth, `layout overflow ${width}x${height}`, layout.upgrade);
    for (const card of layout.upgrade.cards) check(card.left >= 0 && card.right <= width && card.width >= 44, 'upgrade card bounds ' + width);
    await ev("document.querySelector('#modal-build-detail').classList.remove('active');document.querySelector('#modal-upgrade').classList.add('active');game.render()");
    if (width === 320 || width === 844) {
      await sleep(150);
      const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(out, 'upgrade-' + width + '.png'), Buffer.from(screenshot.data, 'base64'));
    }
    layout.controls = await ev('measureControls()');
    for (const control of layout.controls) check(control.width >= 44 && control.height >= 44 && control.hittable,
      'control ' + width + 'x' + height + ': ' + control.id, control);
    layouts.push(layout);
  }
  save('layouts', layouts);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  async function tap(selector, expected) {
    const point = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(30);
    check(await ev(expected), 'trusted touch: ' + selector);
  }
  await ev("resetAudit();window.soundSystem=auditSaved.sound;game.state='ready';document.querySelector('#modal-start').classList.add('active')");
  await tap('[data-diff="hard"]', "game.difficulty==='hard'");
  await tap('[data-diff="normal"]', "game.difficulty==='normal'");
  await tap('[data-diff="casual"]', "game.difficulty==='casual'");
  await tap('#btn-start-game', "game.state==='playing'");
  await ev('window.soundSystem.isMuted=false');
  await tap('#btn-mute', 'window.soundSystem.isMuted');
  check(await ev("document.querySelector('#btn-mute').textContent==='OFF' && document.querySelector('#btn-mute').getAttribute('aria-pressed')==='true'"), 'pixel mute button label and accessible state');
  await tap('#btn-pause', "game.state==='paused'");
  await tap('#btn-resume', "game.state==='playing'");
  await ev("(async()=>{soundSystem.isMuted=false;game.openPauseModal();await soundSystem.ctx.suspend();soundSystem.hasUnlocked=false;})()");
  await tap('#btn-resume', "game.state==='playing'&&soundSystem.ctx.state==='running'");
  const resumedAttack=await cdp('Runtime.evaluate',{expression:"(()=>{const w=new WeaponRegistry.plasma_cannon();w.level=1;soundSystem.lastSoundTimes['weapon:plasma_cannon']=-Infinity;w.fire(game.player,[],game);return [...soundSystem.voices].some(v=>v.group==='weapon:plasma_cannon'&&v.node.buffer===soundSystem.buffers.get('plasma-shot'));})()",returnByValue:true,userGesture:false});
  check(resumedAttack.result.value===true,'attack SFX play after trusted touch resumes suspended audio');
  await tap('#btn-toggle-build', "game.pauseReasons.has('build_detail')");
  await tap('#btn-close-build-detail', "game.state==='playing'");
  await tap('#btn-toggle-build', "game.pauseReasons.has('build_detail')");
  await tap('#btn-done-build-detail', "game.state==='playing'");
  await tap('#btn-pause', "game.state==='paused'");
  await tap('#btn-restart', "game.state==='playing'&&game.elapsedTime===0");
  await ev('game.gameOver(false)');
  await tap('#btn-gameover-restart', "game.state==='playing'&&game.player.level===1");
  await ev('game.player.pendingUpgrades=1;game.openUpgradeModal()');
  await tap('.upgrade-card', "game.state==='playing'&&game.player.pendingUpgrades===0");
  await ev('window.soundSystem=null');
  await ev('auditScrollSetup()');
  const before = await ev('auditScrollRead()');
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 620 }] });
  for (let i = 0; i < 12; i++) { await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 620-i*28 }] }); await sleep(20); }
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(100);
  const after = await ev('auditScrollRead()');
  report.touchScroll = { before, after }; check(after.scrollTop > before.scrollTop, 'protocol drawer touch scroll');
  console.log('Running 60-second real audio stress...');
  report.audio = await ev('checkSustainedAudio()');
  check(report.audio.created > 0 && report.audio.peak <= 10 && report.audio.active === 0 && report.audio.disconnected === report.audio.created,
    'sustained hit audio bounded and disconnected', report.audio);
  if (process.argv.includes('--growth')) {
    await ev(fs.readFileSync(path.join(__dirname, 'growth.js'), 'utf8'));
    const growth = [];
    for (const diff of ['casual', 'normal', 'hard']) for (const strategy of ['balanced', 'survival', 'damage', 'evolution']) {
      console.log('Growth:', diff, strategy);
      for (let seed = 1; seed <= 30; seed++) {
        const row = await ev(`growthRun(${JSON.stringify(diff)},${JSON.stringify(strategy)},${seed})`);
        check(!row.nonfinite && row.choices < 500 && ['playing','gameover'].includes(row.state), `growth ${diff}/${strategy}/${seed}`, row.nonfinite);
        growth.push(row);
      }
      save('growth', growth);
    }
    report.growthRuns = growth.length;
    check(growth.length === 360, '360 growth runs complete');
  }
  report.realtime = await ev(`(async()=>{
    const g=resetAudit('casual');Date.now=auditSaved.now;Math.random=auditSaved.random;window.soundSystem=auditSaved.sound;
    window.soundSystem.isMuted=false;window.requestAnimationFrame=window.auditOriginalRAF;g.lastTime=performance.now();
    let frames=0;const render=g.render.bind(g);g.render=()=>{frames++;render();};g.loop(performance.now());
    await new Promise(r=>setTimeout(r,3000));window.requestAnimationFrame=()=>0;g.state='paused';
    return {frames,elapsed:g.elapsedTime,finite:Number.isFinite(g.player.x),soundState:soundSystem.ctx?.state};})()`);
  check(report.realtime.frames > 0 && report.realtime.elapsed > 0 && report.realtime.finite, 'real RAF and audio smoke', report.realtime);
}
main().catch(e => { check(false, 'uncaught runner failure', e.stack); }).finally(async () => {
  check(errors.length === 0, 'no browser errors', errors);
  report.totalAssertions = assertions.length;
  report.failures = assertions.filter(a => !a.passed);
  report.status = report.failures.length ? 'FAILED' : 'PASSED';
  save('verification_report', report);
  process.exitCode = report.failures.length ? 1 : 0;
  if (cdp && ws?.readyState === WebSocket.OPEN) await cdp('Browser.close').catch(() => {});
  ws?.close(); server?.close(); browser?.kill();
  console.log(`${report.status}: ${assertions.length - report.failures.length}/${assertions.length}; ${out}`);
});
