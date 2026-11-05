const crypto = require('node:crypto');
const GROUPS = ['client', 'cloud', 'controls'];
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const fingerprint = components => hash(GROUPS.map(key => key + '\0' + components[key].sha256).join('\n'));
function validManifest(value) {
  return !!value && value.kind === 'course-source-artifacts' && value.compiled === false
    && /^\d+\.\d+\.\d+$/.test(value.releaseVersion || '')
    && ['development', 'staging', 'production'].includes(value.stage)
    && GROUPS.every(key => /^[a-f0-9]{64}$/.test(value.components && value.components[key] && value.components[key].sha256 || ''))
    && value.fingerprint === fingerprint(value.components);
}
module.exports = { GROUPS, hash, fingerprint, validManifest };
