const { validManifest } = require('./source-manifest-core.cjs');
const { saneDate, filled } = require('./release-audit-core.cjs');
function evaluateRecovery({ current, target, plan = {}, envId = '' }, today) {
  const errors = [], add = code => errors.push(code);
  if (!validManifest(current)) add('CURRENT_INVALID');
  if (!validManifest(target)) add('TARGET_INVALID');
  if (plan.mode !== 'manual-review') add('LEARNING_ONLY');
  if (!filled(plan.owner)) add('OWNER_MISSING');
  if (!filled(envId) || envId !== plan.expectedEnvId) add('ENV_UNCONFIRMED');
  if (!current || current.fingerprint !== plan.expectedCurrentFingerprint) add('CURRENT_CHANGED');
  if (!target || !/^[a-f0-9]{64}$/.test(plan.expectedTargetFingerprint || '') || target.fingerprint !== plan.expectedTargetFingerprint) add('TARGET_UNCONFIRMED');
  if (!current || !target || current.stage !== target.stage || plan.stage !== current.stage) add('STAGE_MISMATCH');
  if (current && target && (current.fingerprint === target.fingerprint || current.releaseVersion === target.releaseVersion)) add('NOT_A_DISTINCT_TARGET');
  if (plan.cloudCompatibility !== 'verified') add('CLOUD_COMPATIBILITY_UNKNOWN');
  if (plan.dataCompatibility !== 'verified') add('DATA_COMPATIBILITY_UNKNOWN');
  for (const key of ['backup', 'restoreDrill', 'stopWrites', 'review']) {
    const proof = plan.evidence && plan.evidence[key];
    if (!proof || proof.status !== 'verified' || !saneDate(proof.checkedAt, today) || !filled(proof.reference)) add('EVIDENCE_PENDING:' + key);
  }
  return { kind: 'local-recovery-review', decision: errors.length ? 'blocked' : 'manual-review-only',
    canExecute: false, remoteVerified: false, dataRestored: false, errors, checkedAt: today,
    note: '仅核对本地登记。未验证材料真实性、停止写入、真实备份或兼容性；不部署、不删数据、不发送消息。' };
}
module.exports = { evaluateRecovery };
