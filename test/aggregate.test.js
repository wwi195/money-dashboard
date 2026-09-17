var MD = typeof module === 'object' ? require('../aggregate.js') : window.MD;
var T = typeof module === 'object' ? require('./harness.js') : window.MDTest;

function record(kind, category, amount, date) {
  return {
    kind: kind,
    category: category,
    amount: { ok: true, amount: amount },
    date: { ok: true, date: date }
  };
}

T.test('filterValidRecords: 金額または日付が失敗した記録を除外する', function () {
  var records = [
    record('expense', '食費', -100, new Date(2026, 5, 1)),
    { kind: 'expense', category: '食費', amount: { ok: false, raw: 'x' }, date: { ok: true, date: new Date() } },
    { kind: 'expense', category: '食費', amount: { ok: true, amount: -1 }, date: { ok: false, raw: 'y' } }
  ];
  T.assertEqual(MD.filterValidRecords(records).length, 1);
});

T.test('rangeForYear: 1/1 0時から12/31 23:59:59.999まで', function () {
  var r = MD.rangeForYear(2026);
  T.assertDateEqual(r.start, new Date(2026, 0, 1, 0, 0, 0));
  T.assertDateEqual(r.end, new Date(2026, 11, 31, 23, 59, 59, 999));
});

T.test('rangeForMonth: 月初0時から月末23:59:59.999まで（月末日を自動計算）', function () {
  var r = MD.rangeForMonth(2026, 2);
  T.assertDateEqual(r.start, new Date(2026, 1, 1, 0, 0, 0));
  T.assertDateEqual(r.end, new Date(2026, 1, 28, 23, 59, 59, 999));
});

T.test('filterByRange: rangeがnullなら全件通す', function () {
  var records = [record('income', 'CCI', 1000, new Date(2026, 5, 1))];
  T.assertEqual(MD.filterByRange(records, null).length, 1);
});

T.test('filterByRange: 範囲内のみ残す', function () {
  var records = [
    record('income', 'CCI', 1000, new Date(2026, 5, 1)),
    record('income', 'CCI', 2000, new Date(2026, 5, 10))
  ];
  var range = { start: new Date(2026, 5, 5), end: new Date(2026, 5, 15) };
  var filtered = MD.filterByRange(records, range);
  T.assertEqual(filtered.length, 1);
  T.assertEqual(filtered[0].amount.amount, 2000);
});

T.test('summarize: 収入・支出・差額・カテゴリ別内訳を算出する', function () {
  var records = [
    record('income', 'CCI', 300000, new Date(2026, 5, 25)),
    record('income', 'ありさから', 5000, new Date(2026, 5, 26)),
    record('expense', '生活必需・固定費', -200000, new Date(2026, 5, 29)),
    record('expense', '食費', -3000, new Date(2026, 5, 26)),
    record('expense', '食費', -1000, new Date(2026, 5, 27))
  ];
  var s = MD.summarize(records, null);
  T.assertEqual(s.incomeSum, 305000);
  T.assertEqual(s.expenseSum, -204000);
  T.assertEqual(s.balance, 101000);
  T.assertEqual(s.count, 5);
  T.assertEqual(s.byCategoryExpense, [
    { category: '生活必需・固定費', sum: -200000, count: 1 },
    { category: '食費', sum: -4000, count: 2 }
  ]);
  T.assertEqual(s.byCategoryIncome, [
    { category: 'CCI', sum: 300000, count: 1 },
    { category: 'ありさから', sum: 5000, count: 1 }
  ]);
  T.assertEqual(s.excludedCount, 0);
});

T.test('summarize: 金額・日付が読めない記録はexcludedCountに数える', function () {
  var records = [
    record('income', 'CCI', 1000, new Date(2026, 5, 1)),
    { kind: 'expense', category: '食費', amount: { ok: false, raw: 'x' }, date: { ok: true, date: new Date() } }
  ];
  var s = MD.summarize(records, null);
  T.assertEqual(s.excludedCount, 1);
});

T.test('seriesByMonth: 指定年のみを月別に集計する', function () {
  var records = [
    record('income', 'CCI', 300000, new Date(2026, 5, 25)),
    record('expense', '食費', -3000, new Date(2026, 5, 26)),
    record('income', 'CCI', 320000, new Date(2026, 6, 24)),
    record('income', 'CCI', 999999, new Date(2025, 5, 25))
  ];
  var series = MD.seriesByMonth(records, 2026);
  T.assertEqual(series, [
    { key: '2026-06', incomeSum: 300000, expenseSum: -3000, balance: 297000 },
    { key: '2026-07', incomeSum: 320000, expenseSum: 0, balance: 320000 }
  ]);
});

T.test('seriesByDay: 指定年月のみを日別に集計する', function () {
  var records = [
    record('expense', '食費', -1000, new Date(2026, 8, 1)),
    record('expense', '食費', -500, new Date(2026, 8, 1)),
    record('income', 'CCI', 2000, new Date(2026, 8, 2)),
    record('expense', '食費', -100, new Date(2026, 9, 1))
  ];
  var series = MD.seriesByDay(records, 2026, 9);
  T.assertEqual(series, [
    { key: '2026-09-01', incomeSum: 0, expenseSum: -1500, balance: -1500 },
    { key: '2026-09-02', incomeSum: 2000, expenseSum: 0, balance: 2000 }
  ]);
});

T.test('distinctYears: 出現する年を降順で返す', function () {
  var records = [
    record('income', 'CCI', 1, new Date(2025, 0, 1)),
    record('income', 'CCI', 1, new Date(2026, 0, 1)),
    record('income', 'CCI', 1, new Date(2024, 0, 1))
  ];
  T.assertEqual(MD.distinctYears(records), [2026, 2025, 2024]);
});
