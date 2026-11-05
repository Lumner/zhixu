const { validReport } = require('../../shared/stats-core');
const { display } = require('../../utils/stats-display');
Component({
  properties: { report: { type: Object, value: null } },
  data: { ready: false, presentation: null, days: [], totals: null, dateFrom: '', dateTo: '' },
  observers: {
    report(report) {
      if (!validReport(report)) { this.setData({ ready: false, presentation: null, days: [], totals: null }); return; }
      this.setData({ ready: true, presentation: display(report), days: report.days, totals: report.totals,
        dateFrom: report.dateFrom, dateTo: report.dateTo });
    }
  }
});
