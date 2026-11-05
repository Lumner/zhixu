// 发行类型与后端环境不是同一概念；生产候选也可能先以体验版验收。
const stages = { development: ['develop'], staging: ['develop', 'trial'], production: ['trial', 'release'] };
const text = value => typeof value === 'string' && value.trim().length > 0;
function checkEnvironment({ runtime = {}, cloud = {}, account } = {}) {
  const stage = Object.prototype.hasOwnProperty.call(stages, runtime.STAGE) ? runtime.STAGE : 'unknown';
  const problems = [];
  if (stage === 'unknown') problems.push('STAGE_UNKNOWN');
  if (!/^\d+\.\d+\.\d+$/.test(runtime.RELEASE_VERSION || '')) problems.push('VERSION_INVALID');
  if (!text(runtime.EXPECTED_APP_ID) || !text(runtime.EXPECTED_ENV_ID)) problems.push('EXPECTED_TARGET_MISSING');
  if (!text(cloud.ENV_ID) || cloud.ENV_ID !== runtime.EXPECTED_ENV_ID) problems.push('ENV_MISMATCH');
  const mini = account && account.miniProgram;
  if (!mini || !text(mini.appId) || !text(mini.envVersion)) problems.push('PLATFORM_UNKNOWN');
  else {
    if (mini.appId !== runtime.EXPECTED_APP_ID) problems.push('APP_MISMATCH');
    if (stage === 'unknown' || !stages[stage].includes(mini.envVersion)) problems.push('PLATFORM_STAGE_MISMATCH');
  }
  return { ok: problems.length === 0, stage, version: /^\d+\.\d+\.\d+$/.test(runtime.RELEASE_VERSION || '') ? runtime.RELEASE_VERSION : 'unknown',
    problems, note: '仅核对本地目标与平台元数据；不证明云资源隔离、身份、权限或部署状态。' };
}
module.exports = { checkEnvironment };
