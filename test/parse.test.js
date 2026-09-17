var MD = typeof module === 'object' ? require('../parse.js') : window.MD;
var T = typeof module === 'object' ? require('./harness.js') : window.MDTest;

T.test('parseAmount: 支出は負に変換する', function () {
  T.assertEqual(MD.parseAmount('3017', 'expense'), { ok: true, amount: -3017 });
});

T.test('parseAmount: 収入は正のまま', function () {
  T.assertEqual(MD.parseAmount('318353', 'income'), { ok: true, amount: 318353 });
});

T.test('parseAmount: 数値化できないものはok:false', function () {
  T.assertEqual(MD.parseAmount('', 'expense'), { ok: false, raw: '' });
  T.assertEqual(MD.parseAmount(null, 'income'), { ok: false, raw: null });
  T.assertEqual(MD.parseAmount('-100', 'expense'), { ok: false, raw: '-100' });
});

T.test('parseDate: YYYY/MM/DDをDateにする', function () {
  var r = MD.parseDate('2026/06/23');
  T.assertTrue(r.ok);
  T.assertDateEqual(r.date, new Date(2026, 5, 23));
});

T.test('parseDate: タイムスタンプ形式(時刻付き)でも日付だけ取れる', function () {
  var r = MD.parseDate('2026/06/26 23:45:08');
  T.assertTrue(r.ok);
  T.assertDateEqual(r.date, new Date(2026, 5, 26));
});

T.test('parseDate: 不正な値はok:false', function () {
  T.assertEqual(MD.parseDate(''), { ok: false, raw: '' });
  T.assertEqual(MD.parseDate('2026/13/01'), { ok: false, raw: '2026/13/01' });
  T.assertEqual(MD.parseDate('abc'), { ok: false, raw: 'abc' });
});

T.test('parseCsv: 引用符内のカンマ・改行に対応', function () {
  var text = 'a,b\n"1,2","line1\nline2"\n';
  var rows = MD.parseCsv(text);
  T.assertEqual(rows, [['a', 'b'], ['1,2', 'line1\nline2']]);
});

T.test('normalizeRecord: 日付（記入日以外の場合）があればそれを使う', function () {
  var row = ['2026/06/29 23:35:17', '812', '趣味・娯楽費', 'アイス', '2026/06/24'];
  var r = MD.normalizeRecord(row, 'expense');
  T.assertTrue(r.date.ok);
  T.assertDateEqual(r.date.date, new Date(2026, 5, 24));
  T.assertEqual(r.amount, { ok: true, amount: -812 });
  T.assertEqual(r.category, '趣味・娯楽費');
  T.assertEqual(r.memo, 'アイス');
  T.assertEqual(r.kind, 'expense');
});

T.test('normalizeRecord: 日付（記入日以外の場合）が空ならタイムスタンプの日付を使う', function () {
  var row = ['2026/06/26 23:45:08', '3017', '交通費', 'ガソリン', ''];
  var r = MD.normalizeRecord(row, 'expense');
  T.assertDateEqual(r.date.date, new Date(2026, 5, 26));
});

T.test('normalizeRecord: カテゴリが空なら未分類にする', function () {
  var row = ['2026/09/07 8:48:14', '100000', '', '', ''];
  var r = MD.normalizeRecord(row, 'income');
  T.assertEqual(r.category, '未分類');
});

T.test('normalizeRecords: kindを全行に付与する', function () {
  var rows = [
    ['2026/06/26 23:45:08', '3017', '交通費', 'ガソリン', ''],
    ['2026/06/27 14:17:53', '437', '寄付', 'アイスら', '']
  ];
  var result = MD.normalizeRecords(rows, 'expense');
  T.assertEqual(result.length, 2);
  T.assertEqual(result[0].kind, 'expense');
  T.assertEqual(result[1].amount.amount, -437);
});
