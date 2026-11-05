const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { GROUPS, fingerprint } = require('./source-manifest-core.cjs');
function collect(root) {
  const components = {};
  const folders = { client: ['miniprogram'], cloud: ['cloudfunctions'], controls: ['database', 'security'] };
  for (const key of GROUPS) {
    const files = [];
    function walk(dir) {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', 'reports', '__pycache__'].includes(item.name)) continue;
        if (item.isSymbolicLink()) throw new Error('MANIFEST_SYMLINK');
        if (item.name.startsWith('.env') || /\.(?:pem|key|p12|pfx)$/i.test(item.name)) throw new Error('MANIFEST_KEY_FILE');
        const file = path.join(dir, item.name);
        if (item.isDirectory()) walk(file); else if (item.isFile()) files.push(file);
      }
    }
    for (const folder of folders[key]) walk(path.join(root, folder));
    files.sort((a, b) => {
      const left = path.relative(root, a).split(path.sep).join('/'), right = path.relative(root, b).split(path.sep).join('/');
      return left < right ? -1 : left > right ? 1 : 0;
    });
    const digest = crypto.createHash('sha256'); let bytes = 0;
    for (const file of files) {
      const body = fs.readFileSync(file); bytes += body.length;
      digest.update(path.relative(root, file).split(path.sep).join('/') + '\0' + body.length + '\0').update(body);
    }
    components[key] = { sha256: digest.digest('hex'), files: files.length, bytes };
  }
  const runtime = require(path.join(root, 'miniprogram/config/runtime.js'));
  return { kind: 'course-source-artifacts', compiled: false, deployed: false,
    releaseVersion: runtime.RELEASE_VERSION, stage: runtime.STAGE, components, fingerprint: fingerprint(components),
    scope: '客户端、云函数及规则计划源码；不是微信编译包、部署证明、签名或数据备份。' };
}
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  try {
    const result = collect(root), file = path.join(root, 'operations/reports/artifacts.json');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ kind: result.kind, compiled: false, components: result.components, fingerprint: result.fingerprint }));
  } catch (_) {
    const file = path.join(root, 'operations/reports/artifacts.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ kind: 'source-artifacts-unavailable', compiled: false, deployed: false, errors: ['MANIFEST_INPUT_ERROR'] }, null, 2) + '\n');
    console.error('MANIFEST_INPUT_ERROR：无法生成当前清单，旧清单不能作为当前证据。'); process.exitCode = 2;
  }
}
module.exports = { collect };
