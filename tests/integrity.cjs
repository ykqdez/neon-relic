// Fault-injection tests run against isolated copies, never against the working tree.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-relic-integrity-'));
const rows = [];
let sourceHashes;
for (const mode of ['control', 'async', 'case', 'json', 'asset']) {
  const fixture = path.join(runDir, mode);
  fs.mkdirSync(fixture);
  for (const name of ['index.html', 'js', 'css']) fs.cpSync(path.join(root, name), path.join(fixture, name), { recursive: true });
  if (mode === 'json') fs.writeFileSync(path.join(fixture, 'broken.json'), '{ INVALID_JSON');
  if (mode === 'asset') fs.appendFileSync(path.join(fixture, 'index.html'), '\n<script src="missing-regression-script.js"></script>\n');
  const output = path.join(runDir, mode + '-results');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'verify.cjs'), '--smoke'], {
    cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true,
    env: { ...process.env, PROJECT_ROOT: fixture, OUTPUT_DIR: output, VERIFY_FAULT: mode }
  });
  const reportPath = path.join(output, 'verification_report.json');
  const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
  if (mode === 'control') sourceHashes = report?.sha256;
  const expectedFailure = { async:'no browser errors', case:'injected: injected executes', json:'JSON: broken.json', asset:'local reference: missing-regression-script.js' }[mode];
  const passed = !result.error && (mode === 'control'
    ? result.status === 0 && report?.status === 'PASSED'
    : result.status === 1 && report?.status === 'FAILED' && report.failures.some(f => f.name === expectedFailure));
  rows.push({ mode, passed, exit: result.status, expectedFailure, failures: report?.failures, error: result.error?.message });
  console.log((passed ? 'PASS' : 'FAIL') + ': verifier integrity ' + mode);
  if (!passed) console.error(result.stdout, result.stderr);
}
const output = path.join(root, 'test-results'); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'integrity.json'), JSON.stringify({ runDir, sourceHashes, rows }, null, 2) + '\n');
process.exitCode = rows.every(r => r.passed) ? 0 : 1;
