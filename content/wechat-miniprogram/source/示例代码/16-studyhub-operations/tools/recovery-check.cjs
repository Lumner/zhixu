const fs = require('node:fs'), path = require('node:path');
const { collect } = require('./build-manifest.cjs');
const { evaluateRecovery } = require('./recovery-core.cjs');
const root = path.resolve(__dirname, '..'), today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
let result;
try {
  const json = name => JSON.parse(fs.readFileSync(path.join(root, 'operations', name), 'utf8'));
  result = evaluateRecovery({ current: collect(root), target: json('rollback-target.json'), plan: json('recovery-plan.json'),
    envId: require(path.join(root, 'miniprogram/config/cloud.js')).ENV_ID }, today);
} catch (_) { result = { kind: 'local-recovery-review', decision: 'blocked', canExecute: false, remoteVerified: false, dataRestored: false, errors: ['INPUT_INVALID'], checkedAt: today }; }
const file = path.join(root, 'operations/reports/recovery.json');
fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result)); process.exitCode = result.decision === 'blocked' ? 2 : 0;
