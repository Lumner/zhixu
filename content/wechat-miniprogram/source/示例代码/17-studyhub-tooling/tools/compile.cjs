const path = require('node:path'), { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
function compile(check = false) {
  let cli;
  try {
    const meta = require('typescript/package.json');
    if (meta.version !== '5.9.3') throw new Error('COMPILER_VERSION');
    cli = require.resolve('typescript/bin/tsc');
  } catch (_) { throw new Error('请先在本实验目录运行 npm ci --ignore-scripts --no-audit --no-fund，固定编译器为5.9.3。'); }
  const child = spawnSync(process.execPath, [cli, '--project', check ? 'tsconfig.type-tests.json' : 'tsconfig.json', '--pretty', 'false'], { cwd: ROOT, encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (child.error || child.status !== 0) throw new Error('TYPE_CHECK_FAILED\n' + (child.stdout || '') + (child.stderr || ''));
}
if (require.main === module) {
  try { compile(process.argv.includes('--check')); console.log(process.argv.includes('--check') ? 'TYPE_CHECK_PASSED' : 'BUILD_PASSED'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { compile };
