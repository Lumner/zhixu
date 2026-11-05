function createWindowWatch({ api, onChange }) {
  let active = false, listener = null, generation = 0;
  return {
    start() {
      if (active) return 'listening';
      if (typeof api.onWindowResize !== 'function' || typeof api.offWindowResize !== 'function') return 'unavailable';
      const token = ++generation; active = true;
      listener = () => { if (active && token === generation) onChange(); };
      try { api.onWindowResize(listener); return 'listening'; }
      catch (_) { active = false; generation++; try { api.offWindowResize(listener); } catch (_) {} listener = null; return 'failed'; }
    },
    stop() { active = false; generation++; const own = listener; listener = null;
      if (own) { try { api.offWindowResize(own); } catch (_) {} }
    }
  };
}
module.exports = { createWindowWatch };
