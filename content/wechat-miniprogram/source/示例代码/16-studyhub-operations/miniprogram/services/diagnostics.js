const { createJournal } = require('./diagnostics-core');
const { ENABLE_LOCAL_DIAGNOSTICS } = require('../config/runtime');
module.exports = createJournal({ enabled: ENABLE_LOCAL_DIAGNOSTICS });
