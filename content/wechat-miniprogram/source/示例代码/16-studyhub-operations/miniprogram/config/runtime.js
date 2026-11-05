// 构建前人工核对；不提供用户可切换的云环境入口。默认不采集本地诊断。
module.exports = {
  STAGE: 'development',
  RELEASE_VERSION: '0.0.0',
  EXPECTED_APP_ID: '',
  EXPECTED_ENV_ID: '',
  ENABLE_LOCAL_DIAGNOSTICS: false
};
