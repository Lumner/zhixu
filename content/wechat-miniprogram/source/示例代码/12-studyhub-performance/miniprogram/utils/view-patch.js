const { utf8Bytes } = require('./report-file');
const clone = value => JSON.parse(JSON.stringify(value));
function getAt(data, path) { return path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((value, key) => value == null ? undefined : value[key], data); }
function createPatchWriter({ send, project, read, onError = () => {} }) {
  let alive = true, suspended = false, latest = null; const accepted = new Map();
  const metrics = { calls: 0, bytes: 0, skipped: 0, failures: 0 };
  function flush() {
    if (!alive || suspended || latest === null) return false;
    const patch = {}, signatures = new Map();
    for (const [key, value] of Object.entries(latest)) {
      if (!/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*|\[\d+\])*$/.test(key) || key.split(/[.\[\]]/).some(x => ['__proto__','prototype','constructor'].includes(x))) throw new Error('Invalid view path');
      const signature = JSON.stringify(value);
      if (signature === undefined) throw new Error('Undefined view data');
      const previous = read ? JSON.stringify(read(key)) : accepted.get(key);
      if (previous !== signature) { patch[key] = clone(value); signatures.set(key, signature); }
    }
    if (!signatures.size) { metrics.skipped++; return false; }
    const bytes = utf8Bytes(JSON.stringify(patch));
    try { send(patch); }
    catch (error) { metrics.failures++; onError(error); return false; }
    for (const [key, value] of signatures) accepted.set(key, value);
    metrics.calls++; metrics.bytes += bytes; return true;
  }
  return {
    write(model) { if (!alive) return false; const view = project(model); for (const value of Object.values(view)) if (JSON.stringify(value) === undefined) throw new Error('Undefined view data'); latest = clone(view); return flush(); },
    suspend() { suspended = true; }, resume() { if (alive) { suspended = false; return flush(); } return false; },
    dispose() { alive = false; latest = null; accepted.clear(); },
    metrics: () => ({ ...metrics })
  };
}
module.exports = { createPatchWriter, getAt };
