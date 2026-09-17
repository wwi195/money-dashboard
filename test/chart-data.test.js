var MD = typeof module === 'object' ? require('../chart-data.js') : window.MD;
var T = typeof module === 'object' ? require('./harness.js') : window.MDTest;

T.test('buildYearSeriesChartConfig: labels/data/凡例を組み立てる', function () {
  var series = [
    { key: '2025', incomeSum: 1000, expenseSum: -400, balance: 600 },
    { key: '2026', incomeSum: 2000, expenseSum: -1500, balance: 500 }
  ];
  var config = MD.buildYearSeriesChartConfig(series);
  T.assertEqual(config.type, 'bar');
  T.assertEqual(config.data.labels, ['2025年', '2026年']);
  T.assertEqual(config.data.datasets[0], { label: '収入', data: [1000, 2000], backgroundColor: '#2f9e59' });
  T.assertEqual(config.data.datasets[1], { label: '支出', data: [400, 1500], backgroundColor: '#c0392b' });
});

T.test('buildMonthSeriesChartConfig: キーからM月ラベルを作る', function () {
  var series = [
    { key: '2026-06', incomeSum: 300000, expenseSum: -200000, balance: 100000 },
    { key: '2026-07', incomeSum: 320000, expenseSum: -250000, balance: 70000 }
  ];
  var config = MD.buildMonthSeriesChartConfig(series);
  T.assertEqual(config.data.labels, ['6月', '7月']);
  T.assertEqual(config.data.datasets[1].data, [200000, 250000]);
});

T.test('buildDaySeriesChartConfig: 先頭だけ年表記、残りはM/D表記', function () {
  var series = [
    { key: '2026-09-01', incomeSum: 0, expenseSum: -500, balance: -500 },
    { key: '2026-09-02', incomeSum: 1000, expenseSum: 0, balance: 1000 }
  ];
  var config = MD.buildDaySeriesChartConfig(series);
  T.assertEqual(config.data.labels, ['2026/9/1', '9/2']);
});

T.test('buildCategoryChartConfig: labels/dataを絶対値で組み立てる', function () {
  var byCategory = [
    { category: '生活必需・固定費', sum: -336015, count: 1 },
    { category: '食費', sum: -1735, count: 1 }
  ];
  var config = MD.buildCategoryChartConfig(byCategory, '#c0392b');
  T.assertEqual(config.data.labels, ['生活必需・固定費', '食費']);
  T.assertEqual(config.data.datasets[0].data, [336015, 1735]);
  T.assertEqual(config.data.datasets[0].backgroundColor, '#c0392b');
  T.assertEqual(config.options.indexAxis, 'y');
});
