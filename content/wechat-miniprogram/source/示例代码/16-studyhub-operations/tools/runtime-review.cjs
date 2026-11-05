const { filled } = require('./release-audit-core.cjs');
function reviewRuntime(snapshot) {
  const { runtime = {}, plan = {}, projectConfig = {}, cloud = {} } = snapshot;
  const errors = [], add = code => errors.push({ code, message: '发布候选运行配置待核对：' + code });
  if (runtime.STAGE !== 'production') add('RUNTIME_STAGE');
  if (!/^\d+\.\d+\.\d+$/.test(runtime.RELEASE_VERSION || '') || runtime.RELEASE_VERSION !== plan.targetVersion) add('RUNTIME_VERSION');
  if (!filled(runtime.EXPECTED_APP_ID) || runtime.EXPECTED_APP_ID !== projectConfig.appid) add('RUNTIME_APP');
  if (!filled(runtime.EXPECTED_ENV_ID) || runtime.EXPECTED_ENV_ID !== cloud.ENV_ID) add('RUNTIME_ENV');
  if (runtime.ENABLE_LOCAL_DIAGNOSTICS !== false) add('LOCAL_DIAGNOSTICS_ENABLED');
  return errors;
}
module.exports = { reviewRuntime };
