(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MD = root.MD || {};
    Object.assign(root.MD, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var COLOR_INCOME = '#2f9e59';
  var COLOR_EXPENSE = '#c0392b';

  function buildGroupedBarConfig(labels, series) {
    return {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '収入',
            data: series.map(function (s) { return s.incomeSum; }),
            backgroundColor: COLOR_INCOME
          },
          {
            label: '支出',
            data: series.map(function (s) { return Math.abs(s.expenseSum); }),
            backgroundColor: COLOR_EXPENSE
          }
        ]
      },
      options: {
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } }
      }
    };
  }

  function buildYearSeriesChartConfig(series) {
    return buildGroupedBarConfig(series.map(function (s) { return s.key + '年'; }), series);
  }

  function buildMonthSeriesChartConfig(series) {
    var labels = series.map(function (s) {
      return String(Number(s.key.split('-')[1])) + '月';
    });
    return buildGroupedBarConfig(labels, series);
  }

  function formatDaySeriesAxisLabel(dateStr, isFirst) {
    var parts = dateStr.split('-');
    var y = parts[0];
    var m = String(Number(parts[1]));
    var d = String(Number(parts[2]));
    return isFirst ? (y + '/' + m + '/' + d) : (m + '/' + d);
  }

  function buildDaySeriesChartConfig(series) {
    var labels = series.map(function (s, i) { return formatDaySeriesAxisLabel(s.key, i === 0); });
    return buildGroupedBarConfig(labels, series);
  }

  function buildCategoryChartConfig(byCategory, color) {
    return {
      type: 'bar',
      data: {
        labels: byCategory.map(function (c) { return c.category; }),
        datasets: [{
          data: byCategory.map(function (c) { return Math.abs(c.sum); }),
          backgroundColor: color
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } }
      }
    };
  }

  return {
    COLOR_INCOME: COLOR_INCOME,
    COLOR_EXPENSE: COLOR_EXPENSE,
    buildYearSeriesChartConfig: buildYearSeriesChartConfig,
    buildMonthSeriesChartConfig: buildMonthSeriesChartConfig,
    buildDaySeriesChartConfig: buildDaySeriesChartConfig,
    buildCategoryChartConfig: buildCategoryChartConfig
  };
});
