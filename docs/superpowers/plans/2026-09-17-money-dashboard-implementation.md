# money-dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, mobile-first dashboard that reads the "支出（回答）" and "収入（回答）" Google Sheets (via published CSV) and shows income/expense balance across all-time, yearly, and monthly views.

**Architecture:** Vanilla JS, no build step, matching the sibling projects `fx-dashboard` and `gambling-dashboard` exactly: pure-function modules (`parse.js`, `aggregate.js`, `chart-data.js`) covered by a hand-rolled Node/browser test harness, plus DOM-facing modules (`render.js`, `app.js`) that are verified manually via `dev.html`. Deployed as a static site on GitHub Pages.

**Tech Stack:** Vanilla JS (ES5-style, UMD module wrapper), Chart.js 4.4.1 (CDN), no npm dependencies, Node.js only for running the test suite.

Reference spec: `docs/superpowers/specs/2026-09-17-money-dashboard-design.md`

---

### Task 1: Test harness and directory scaffolding

**Files:**
- Create: `.gitignore`
- Create: `test/harness.js`
- Create: `test/run.js`
- Create: `test/index.html`

- [ ] **Step 1: Create `.gitignore`**

```
.DS_Store
Thumbs.db
*.log
```

- [ ] **Step 2: Create `test/harness.js`**

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MDTest = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var tests = [];

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  function run() {
    var results = [];
    var passCount = 0;
    var failCount = 0;
    tests.forEach(function (t) {
      try {
        t.fn();
        results.push({ name: t.name, pass: true });
        passCount += 1;
      } catch (e) {
        results.push({ name: t.name, pass: false, error: e.message });
        failCount += 1;
      }
    });
    return { results: results, passCount: passCount, failCount: failCount };
  }

  function assertEqual(actual, expected, message) {
    var a = JSON.stringify(actual);
    var e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error((message ? message + ': ' : '') + 'expected ' + e + ' but got ' + a);
    }
  }

  function assertTrue(condition, message) {
    if (!condition) {
      throw new Error(message || 'expected condition to be true');
    }
  }

  function assertDateEqual(actual, expected, message) {
    if (!(actual instanceof Date) || !(expected instanceof Date) || actual.getTime() !== expected.getTime()) {
      throw new Error(
        (message ? message + ': ' : '') +
        'expected date ' + (expected instanceof Date ? expected.toISOString() : String(expected)) +
        ' but got ' + (actual instanceof Date ? actual.toISOString() : String(actual))
      );
    }
  }

  return {
    test: test,
    run: run,
    assertEqual: assertEqual,
    assertTrue: assertTrue,
    assertDateEqual: assertDateEqual
  };
});
```

- [ ] **Step 3: Create `test/run.js`**

```js
require('./parse.test.js');
require('./aggregate.test.js');
require('./chart-data.test.js');

var harness = require('./harness.js');
var summary = harness.run();

summary.results.forEach(function (r) {
  console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.pass ? '' : ' :: ' + r.error));
});
console.log('\n' + summary.passCount + ' passed, ' + summary.failCount + ' failed');
process.exit(summary.failCount > 0 ? 1 : 0);
```

This `require`s three test files that don't exist yet (`parse.test.js`, `aggregate.test.js`, `chart-data.test.js`) — they're created in Tasks 2-4. Don't run this file until Task 2's test file exists (it will fail with `Cannot find module` until then).

- [ ] **Step 4: Create `test/index.html`**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>支出・収入ダッシュボード テスト</title>
<style>
  body { font-family: sans-serif; padding: 16px; background: #fafafa; }
  #test-summary { font-weight: bold; margin-bottom: 12px; }
  ul { list-style: none; padding: 0; }
  li { padding: 4px 8px; font-family: monospace; font-size: 13px; }
  li.pass { color: #2f9e59; }
  li.fail { color: #c0392b; background: #fdecea; }
</style>
</head>
<body>
<h1>支出・収入ダッシュボード テスト</h1>
<div id="test-summary">実行中…</div>
<ul id="test-results"></ul>

<script src="../parse.js"></script>
<script src="../aggregate.js"></script>
<script src="../chart-data.js"></script>
<script src="harness.js"></script>
<script src="parse.test.js"></script>
<script src="aggregate.test.js"></script>
<script src="chart-data.test.js"></script>
<script>
  var summary = window.MDTest.run();
  var out = document.getElementById('test-results');
  summary.results.forEach(function (r) {
    var li = document.createElement('li');
    li.className = r.pass ? 'pass' : 'fail';
    li.textContent = (r.pass ? '✓ ' : '✗ ') + r.name + (r.pass ? '' : ' — ' + r.error);
    out.appendChild(li);
  });
  document.getElementById('test-summary').textContent =
    summary.passCount + ' passed, ' + summary.failCount + ' failed';
</script>
</body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore test/harness.js test/run.js test/index.html
git commit -m "Add test harness scaffolding"
```

---

### Task 2: `parse.js` — CSV parsing and record normalization

**Files:**
- Create: `parse.js`
- Test: `test/parse.test.js`

Column order for both sheets: `タイムスタンプ, 金額, カテゴリ, メモ, 日付（記入日以外の場合）` (indices 0-4). `金額` is always a positive integer in the sheet; the sign is derived from which sheet it came from (`kind`: `'expense'` or `'income'`).

- [ ] **Step 1: Write the failing tests**

Create `test/parse.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node -e "require('./test/parse.test.js')"`
Expected: throws `Cannot find module '../parse.js'`

- [ ] **Step 3: Create `parse.js`**

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MD = root.MD || {};
    Object.assign(root.MD, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // 列順（支出・収入シート共通）: タイムスタンプ,金額,カテゴリ,メモ,日付（記入日以外の場合）

  function parseAmount(raw, kind) {
    if (raw === null || raw === undefined) return { ok: false, raw: raw };
    var s = String(raw).trim();
    if (s === '' || !/^\d+(\.\d+)?$/.test(s)) return { ok: false, raw: raw };
    var value = parseFloat(s);
    return { ok: true, amount: kind === 'expense' ? -value : value };
  }

  // "YYYY/MM/DD" と "YYYY/MM/DD HH:MM:SS" のどちらも受け付ける。
  // parseIntが日の部分の末尾（空白以降の時刻）を無視するため、
  // タイムスタンプ文字列をそのまま渡しても日付だけが取れる。
  function parseDate(raw) {
    if (!raw) return { ok: false, raw: raw };
    var trimmed = String(raw).trim();
    var segs = trimmed.split('/');
    if (segs.length !== 3) return { ok: false, raw: raw };
    var year = parseInt(segs[0], 10);
    var month = parseInt(segs[1], 10);
    var day = parseInt(segs[2], 10);
    if ([year, month, day].some(function (n) { return isNaN(n); })) return { ok: false, raw: raw };
    if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, raw: raw };
    return { ok: true, date: new Date(year, month - 1, day) };
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    function pushField() {
      row.push(field);
      field = '';
    }
    function pushRow() {
      pushField();
      rows.push(row);
      row = [];
    }

    while (i < len) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i += 1;
            continue;
          }
        } else {
          field += ch;
          i += 1;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i += 1;
          continue;
        } else if (ch === ',') {
          pushField();
          i += 1;
          continue;
        } else if (ch === '\r') {
          i += 1;
          continue;
        } else if (ch === '\n') {
          pushRow();
          i += 1;
          continue;
        } else {
          field += ch;
          i += 1;
          continue;
        }
      }
    }

    if (field.length > 0 || row.length > 0) {
      pushRow();
    }

    return rows;
  }

  function normalizeRecord(row, kind) {
    var overrideDate = (row[4] || '').trim();
    var dateRaw = overrideDate !== '' ? overrideDate : row[0];
    return {
      date: parseDate(dateRaw),
      amount: parseAmount(row[1], kind),
      category: (row[2] || '').trim() || '未分類',
      memo: row[3] || '',
      kind: kind
    };
  }

  function normalizeRecords(rows, kind) {
    return rows.map(function (row) { return normalizeRecord(row, kind); });
  }

  return {
    parseAmount: parseAmount,
    parseDate: parseDate,
    parseCsv: parseCsv,
    normalizeRecord: normalizeRecord,
    normalizeRecords: normalizeRecords
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node -e "require('./test/parse.test.js'); var h=require('./test/harness.js'); var s=h.run(); s.results.forEach(function(r){console.log((r.pass?'PASS':'FAIL')+' - '+r.name+(r.pass?'':' :: '+r.error));}); console.log(s.passCount+' passed, '+s.failCount+' failed');"`
Expected: `12 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add parse.js test/parse.test.js
git commit -m "Add parse.js: CSV parsing and record normalization"
```

---

### Task 3: `aggregate.js` — summaries and time-bucketed series

**Files:**
- Create: `aggregate.js`
- Test: `test/aggregate.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/aggregate.test.js`:

```js
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

T.test('seriesByYear: 年ごとに収入・支出・差額を集計する', function () {
  var records = [
    record('income', 'CCI', 1000000, new Date(2025, 5, 1)),
    record('expense', '食費', -400000, new Date(2025, 5, 1)),
    record('income', 'CCI', 1200000, new Date(2026, 5, 1)),
    record('expense', '食費', -900000, new Date(2026, 5, 1))
  ];
  var series = MD.seriesByYear(records);
  T.assertEqual(series, [
    { key: '2025', incomeSum: 1000000, expenseSum: -400000, balance: 600000 },
    { key: '2026', incomeSum: 1200000, expenseSum: -900000, balance: 300000 }
  ]);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node -e "require('./test/aggregate.test.js')"`
Expected: throws `Cannot find module '../aggregate.js'`

- [ ] **Step 3: Create `aggregate.js`**

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MD = root.MD || {};
    Object.assign(root.MD, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function yearKey(date) { return String(date.getFullYear()); }
  function monthKey(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1); }
  function dayKey(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }

  function rangeForYear(year) {
    return { start: new Date(year, 0, 1, 0, 0, 0), end: new Date(year, 11, 31, 23, 59, 59, 999) };
  }

  function rangeForMonth(year, month) {
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0),
      end: new Date(year, month, 0, 23, 59, 59, 999)
    };
  }

  function filterValidRecords(records) {
    return records.filter(function (r) {
      return r.amount && r.amount.ok && r.date && r.date.ok;
    });
  }

  function filterByRange(records, range) {
    if (!range) return records;
    return records.filter(function (r) {
      var time = r.date.date.getTime();
      return time >= range.start.getTime() && time <= range.end.getTime();
    });
  }

  function sum(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0);
  }

  function buildCategoryBreakdown(records) {
    var map = {};
    records.forEach(function (r) {
      if (!map[r.category]) map[r.category] = { category: r.category, sum: 0, count: 0 };
      map[r.category].sum += r.amount.amount;
      map[r.category].count += 1;
    });
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function summarize(records, range) {
    var valid = filterValidRecords(records);
    var excludedCount = records.length - valid.length;
    var inRange = filterByRange(valid, range);

    var expenseRecords = inRange.filter(function (r) { return r.kind === 'expense'; });
    var incomeRecords = inRange.filter(function (r) { return r.kind === 'income'; });

    var incomeSum = sum(incomeRecords.map(function (r) { return r.amount.amount; }));
    var expenseSum = sum(expenseRecords.map(function (r) { return r.amount.amount; }));

    var byCategoryExpense = buildCategoryBreakdown(expenseRecords)
      .sort(function (a, b) { return a.sum - b.sum; });
    var byCategoryIncome = buildCategoryBreakdown(incomeRecords)
      .sort(function (a, b) { return b.sum - a.sum; });

    return {
      incomeSum: incomeSum,
      expenseSum: expenseSum,
      balance: incomeSum + expenseSum,
      count: inRange.length,
      byCategoryExpense: byCategoryExpense,
      byCategoryIncome: byCategoryIncome,
      excludedCount: excludedCount
    };
  }

  function buildSeries(records, keyFn) {
    var map = {};
    records.forEach(function (r) {
      var key = keyFn(r.date.date);
      if (!map[key]) map[key] = { key: key, incomeSum: 0, expenseSum: 0 };
      if (r.kind === 'income') map[key].incomeSum += r.amount.amount;
      else map[key].expenseSum += r.amount.amount;
    });
    return Object.keys(map).sort().map(function (key) {
      var entry = map[key];
      return { key: entry.key, incomeSum: entry.incomeSum, expenseSum: entry.expenseSum, balance: entry.incomeSum + entry.expenseSum };
    });
  }

  function seriesByYear(records) {
    return buildSeries(filterValidRecords(records), yearKey);
  }

  function seriesByMonth(records, year) {
    var scoped = filterValidRecords(records).filter(function (r) {
      return r.date.date.getFullYear() === year;
    });
    return buildSeries(scoped, monthKey);
  }

  function seriesByDay(records, year, month) {
    var scoped = filterValidRecords(records).filter(function (r) {
      return r.date.date.getFullYear() === year && r.date.date.getMonth() + 1 === month;
    });
    return buildSeries(scoped, dayKey);
  }

  function distinctYears(records) {
    var years = {};
    filterValidRecords(records).forEach(function (r) { years[r.date.date.getFullYear()] = true; });
    return Object.keys(years).map(Number).sort(function (a, b) { return b - a; });
  }

  return {
    yearKey: yearKey,
    monthKey: monthKey,
    dayKey: dayKey,
    rangeForYear: rangeForYear,
    rangeForMonth: rangeForMonth,
    filterValidRecords: filterValidRecords,
    filterByRange: filterByRange,
    summarize: summarize,
    seriesByYear: seriesByYear,
    seriesByMonth: seriesByMonth,
    seriesByDay: seriesByDay,
    distinctYears: distinctYears
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node -e "require('./test/aggregate.test.js'); var h=require('./test/harness.js'); var s=h.run(); s.results.forEach(function(r){console.log((r.pass?'PASS':'FAIL')+' - '+r.name+(r.pass?'':' :: '+r.error));}); console.log(s.passCount+' passed, '+s.failCount+' failed');"`
Expected: `11 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add aggregate.js test/aggregate.test.js
git commit -m "Add aggregate.js: summaries and time-bucketed series"
```

---

### Task 4: `chart-data.js` — Chart.js config builders

**Files:**
- Create: `chart-data.js`
- Test: `test/chart-data.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/chart-data.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node -e "require('./test/chart-data.test.js')"`
Expected: throws `Cannot find module '../chart-data.js'`

- [ ] **Step 3: Create `chart-data.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test/run.js`
Expected: `27 passed, 0 failed` (12 from parse + 11 from aggregate + 4 from chart-data)

- [ ] **Step 5: Commit**

```bash
git add chart-data.js test/chart-data.test.js
git commit -m "Add chart-data.js: Chart.js config builders"
```

---

### Task 5: `style.css`

**Files:**
- Create: `style.css`

- [ ] **Step 1: Create `style.css`**

```css
:root {
  --bg: #fafafa;
  --card-bg: #ffffff;
  --text: #1a1a1a;
  --text-muted: #6b6b6b;
  --border: #e2e2e2;
  --plus: #2f9e59;
  --minus: #c0392b;
  --accent: #2563eb;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  padding-bottom: 40px;
}

.error-banner {
  background: #fdecea;
  color: var(--minus);
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
}

.empty-state {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-muted);
}

.period-filter {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 10;
  overflow-x: auto;
}

.period-filter button {
  flex: 1 0 auto;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--card-bg);
  color: var(--text);
  font-size: 13px;
}

.period-filter button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.range-picker {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.range-picker select {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-size: 13px;
  padding: 6px 10px;
}

.summary-tiles {
  padding: 0 16px;
}

.summary-main-row {
  margin-bottom: 12px;
}

.summary-tile {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}

.summary-tile-label {
  font-size: 12px;
  color: var(--text-muted);
}

.summary-tile-value {
  font-size: 22px;
  font-weight: bold;
  margin-top: 4px;
}

.summary-sub-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.summary-sub-stat {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.summary-sub-label { color: var(--text-muted); }

.excluded-warn {
  font-size: 12px;
  color: var(--minus);
  padding: 4px 0 12px;
}

.pnl-plus { color: var(--plus); }
.pnl-minus { color: var(--minus); }

.chart-section {
  padding: 16px;
}

.chart-section h2, .record-list-section h2 {
  font-size: 15px;
  margin: 0 0 8px;
}

.chart-section canvas {
  max-height: 260px;
}

.category-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
}

.category-list li {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.record-list-section {
  padding: 16px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}

.record-card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
}

.record-card-date { color: var(--text-muted); }
.record-card-category { font-weight: 500; }
.record-card-amount { font-weight: bold; font-size: 15px; }

.record-card-memo {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-bottom: 6px;
}

.badge-warn {
  background: #fdecea;
  color: var(--minus);
}

.empty-note {
  color: var(--text-muted);
  font-size: 13px;
}

@media (min-width: 900px) {
  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "Add style.css"
```

---

### Task 6: `render.js` — DOM rendering

**Files:**
- Create: `render.js`

- [ ] **Step 1: Create `render.js`**

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MD = root.MD || {};
    Object.assign(root.MD, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function formatMoney(n) {
    var sign = n >= 0 ? '+' : '';
    return '¥' + sign + Math.round(n).toLocaleString('ja-JP');
  }

  function formatDate(date) {
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return m + '/' + d;
  }

  function firstLine(text) {
    if (!text) return '';
    var line = String(text).split(/\r?\n/)[0];
    return line.length > 40 ? line.slice(0, 40) + '…' : line;
  }

  function renderError(container, message) {
    container.hidden = false;
    container.textContent = message;
  }

  function buildTile(label, value, positive) {
    var tile = document.createElement('div');
    tile.className = 'summary-tile ' + (positive ? 'pnl-plus' : 'pnl-minus');
    var labelEl = document.createElement('div');
    labelEl.className = 'summary-tile-label';
    labelEl.textContent = label;
    var valueEl = document.createElement('div');
    valueEl.className = 'summary-tile-value';
    valueEl.textContent = value;
    tile.appendChild(labelEl);
    tile.appendChild(valueEl);
    return tile;
  }

  function buildSubStat(label, value) {
    var el = document.createElement('div');
    el.className = 'summary-sub-stat';
    var labelEl = document.createElement('span');
    labelEl.className = 'summary-sub-label';
    labelEl.textContent = label;
    var valueEl = document.createElement('span');
    valueEl.className = 'summary-sub-value';
    valueEl.textContent = value;
    el.appendChild(labelEl);
    el.appendChild(valueEl);
    return el;
  }

  function renderSummary(container, summary) {
    container.innerHTML = '';

    var mainRow = document.createElement('div');
    mainRow.className = 'summary-main-row';
    mainRow.appendChild(buildTile('収支合計', formatMoney(summary.balance), summary.balance >= 0));
    container.appendChild(mainRow);

    var subRow = document.createElement('div');
    subRow.className = 'summary-sub-row';
    subRow.appendChild(buildSubStat('収入合計', formatMoney(summary.incomeSum)));
    subRow.appendChild(buildSubStat('支出合計', formatMoney(summary.expenseSum)));
    subRow.appendChild(buildSubStat('件数', String(summary.count) + '件'));
    container.appendChild(subRow);

    if (summary.excludedCount > 0) {
      var warn = document.createElement('p');
      warn.className = 'excluded-warn';
      warn.textContent = '要確認: ' + summary.excludedCount + '件（金額または日付が読み取れませんでした）';
      container.appendChild(warn);
    }
  }

  function renderBalanceChart(canvas, config, prevChart) {
    if (prevChart) prevChart.destroy();
    return new Chart(canvas.getContext('2d'), config);
  }

  function renderCategory(canvas, listEl, byCategory, color, prevChart) {
    if (prevChart) prevChart.destroy();
    var config = MD.buildCategoryChartConfig(byCategory, color);
    var chart = new Chart(canvas.getContext('2d'), config);

    listEl.innerHTML = '';
    if (byCategory.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'empty-note';
      empty.textContent = 'この期間の記録はありません。';
      listEl.appendChild(empty);
      return chart;
    }

    byCategory.forEach(function (c) {
      var li = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = c.category;
      var stats = document.createElement('span');
      stats.textContent = formatMoney(c.sum) + '（' + c.count + '件）';
      li.appendChild(label);
      li.appendChild(stats);
      listEl.appendChild(li);
    });

    return chart;
  }

  function buildRecordCard(record) {
    var card = document.createElement('div');
    card.className = 'record-card';

    var needsReview = !record.amount.ok || !record.date.ok;
    if (needsReview) {
      var badge = document.createElement('span');
      badge.className = 'badge badge-warn';
      badge.textContent = '要確認';
      card.appendChild(badge);
    }

    var header = document.createElement('div');
    header.className = 'record-card-header';

    var dateEl = document.createElement('div');
    dateEl.className = 'record-card-date';
    dateEl.textContent = record.date.ok ? formatDate(record.date.date) : '日付不明';
    header.appendChild(dateEl);

    var categoryEl = document.createElement('div');
    categoryEl.className = 'record-card-category';
    categoryEl.textContent = record.category;
    header.appendChild(categoryEl);

    var amountEl = document.createElement('div');
    amountEl.className = 'record-card-amount ' + (record.amount.ok && record.amount.amount >= 0 ? 'pnl-plus' : 'pnl-minus');
    amountEl.textContent = record.amount.ok ? formatMoney(record.amount.amount) : '要確認: ' + record.amount.raw;
    header.appendChild(amountEl);

    card.appendChild(header);

    if (record.memo) {
      var memoEl = document.createElement('div');
      memoEl.className = 'record-card-memo';
      memoEl.textContent = firstLine(record.memo);
      card.appendChild(memoEl);
    }

    return card;
  }

  function renderRecordList(container, records) {
    container.innerHTML = '';
    if (records.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'この期間の記録はありません。';
      container.appendChild(empty);
      return;
    }

    var sorted = records.slice().sort(function (a, b) {
      var at = a.date && a.date.ok ? a.date.date.getTime() : -Infinity;
      var bt = b.date && b.date.ok ? b.date.date.getTime() : -Infinity;
      return bt - at;
    });

    sorted.forEach(function (record) {
      container.appendChild(buildRecordCard(record));
    });
  }

  return {
    renderError: renderError,
    renderSummary: renderSummary,
    renderBalanceChart: renderBalanceChart,
    renderCategory: renderCategory,
    renderRecordList: renderRecordList
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add render.js
git commit -m "Add render.js: DOM rendering"
```

---

### Task 7: `index.html`

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>支出・収入ダッシュボード</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="error-banner" class="error-banner" hidden></div>
<div id="empty-state" class="empty-state" hidden>記録がありません。</div>

<div id="app-main" hidden>
  <header id="period-filter" class="period-filter">
    <button type="button" class="active" data-tab="all">全期間</button>
    <button type="button" data-tab="year">年別</button>
    <button type="button" data-tab="month">月別</button>
  </header>

  <div id="range-picker" class="range-picker" hidden>
    <select id="year-select"></select>
    <select id="month-select" hidden></select>
  </div>

  <section id="summary-tiles" class="summary-tiles"></section>

  <section class="chart-section">
    <h2 id="balance-chart-title">年別収支</h2>
    <canvas id="balance-chart"></canvas>
  </section>

  <div class="charts-row">
    <section class="chart-section">
      <h2>支出カテゴリ別</h2>
      <canvas id="expense-category-chart"></canvas>
      <ul id="expense-category-list" class="category-list"></ul>
    </section>

    <section class="chart-section">
      <h2>収入カテゴリ別</h2>
      <canvas id="income-category-chart"></canvas>
      <ul id="income-category-list" class="category-list"></ul>
    </section>
  </div>

  <section class="record-list-section">
    <h2>記録一覧</h2>
    <div id="record-list" class="record-list"></div>
  </section>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script src="config.js"></script>
<script src="parse.js"></script>
<script src="aggregate.js"></script>
<script src="chart-data.js"></script>
<script src="render.js"></script>
<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Add index.html"
```

---

### Task 8: `app.js` — wiring, fetch, tabs

**Files:**
- Create: `app.js`

- [ ] **Step 1: Create `app.js`**

```js
(function () {
  'use strict';

  function main() {
    var els = {
      errorBanner: document.getElementById('error-banner'),
      emptyState: document.getElementById('empty-state'),
      main: document.getElementById('app-main'),
      tabFilter: document.getElementById('period-filter'),
      rangePicker: document.getElementById('range-picker'),
      yearSelect: document.getElementById('year-select'),
      monthSelect: document.getElementById('month-select'),
      summary: document.getElementById('summary-tiles'),
      balanceChartTitle: document.getElementById('balance-chart-title'),
      balanceCanvas: document.getElementById('balance-chart'),
      expenseCategoryCanvas: document.getElementById('expense-category-chart'),
      expenseCategoryList: document.getElementById('expense-category-list'),
      incomeCategoryCanvas: document.getElementById('income-category-chart'),
      incomeCategoryList: document.getElementById('income-category-list'),
      recordList: document.getElementById('record-list')
    };

    var state = {
      records: [],
      tab: 'all',
      year: null,
      month: null,
      balanceChart: null,
      expenseCategoryChart: null,
      incomeCategoryChart: null
    };

    function showError(message) {
      MD.renderError(els.errorBanner, message);
      els.main.hidden = true;
    }

    function recordsForRange(allRecords, range) {
      return allRecords.filter(function (r) {
        if (!r.date || !r.date.ok) return state.tab === 'all';
        if (!range) return true;
        var time = r.date.date.getTime();
        return time >= range.start.getTime() && time <= range.end.getTime();
      });
    }

    function populateYearOptions() {
      var years = MD.distinctYears(state.records);
      els.yearSelect.innerHTML = '';
      years.forEach(function (year) {
        var opt = document.createElement('option');
        opt.value = String(year);
        opt.textContent = year + '年';
        els.yearSelect.appendChild(opt);
      });
      if (years.length > 0 && (state.year === null || years.indexOf(state.year) === -1)) {
        state.year = years[0];
      }
      els.yearSelect.value = String(state.year);
    }

    function populateMonthOptions() {
      els.monthSelect.innerHTML = '';
      for (var m = 1; m <= 12; m++) {
        var opt = document.createElement('option');
        opt.value = String(m);
        opt.textContent = m + '月';
        els.monthSelect.appendChild(opt);
      }
      if (state.month === null) state.month = 1;
      els.monthSelect.value = String(state.month);
    }

    function rerender() {
      if (state.records.length === 0) {
        els.emptyState.hidden = false;
        els.main.hidden = true;
        return;
      }

      els.emptyState.hidden = true;
      els.main.hidden = false;

      var range;
      var chartConfig;
      var title;

      if (state.tab === 'all') {
        range = null;
        chartConfig = MD.buildYearSeriesChartConfig(MD.seriesByYear(state.records));
        title = '年別収支';
      } else if (state.tab === 'year') {
        range = MD.rangeForYear(state.year);
        chartConfig = MD.buildMonthSeriesChartConfig(MD.seriesByMonth(state.records, state.year));
        title = state.year + '年の月別収支';
      } else {
        range = MD.rangeForMonth(state.year, state.month);
        chartConfig = MD.buildDaySeriesChartConfig(MD.seriesByDay(state.records, state.year, state.month));
        title = state.year + '年' + state.month + '月の日別収支';
      }

      els.balanceChartTitle.textContent = title;

      var summary = MD.summarize(state.records, range);
      MD.renderSummary(els.summary, summary);

      state.balanceChart = MD.renderBalanceChart(els.balanceCanvas, chartConfig, state.balanceChart);
      state.expenseCategoryChart = MD.renderCategory(
        els.expenseCategoryCanvas, els.expenseCategoryList, summary.byCategoryExpense, MD.COLOR_EXPENSE, state.expenseCategoryChart
      );
      state.incomeCategoryChart = MD.renderCategory(
        els.incomeCategoryCanvas, els.incomeCategoryList, summary.byCategoryIncome, MD.COLOR_INCOME, state.incomeCategoryChart
      );

      MD.renderRecordList(els.recordList, recordsForRange(state.records, range));
    }

    function onTabClick(event) {
      var btn = event.target.closest('[data-tab]');
      if (!btn) return;
      state.tab = btn.getAttribute('data-tab');
      Array.prototype.forEach.call(els.tabFilter.querySelectorAll('[data-tab]'), function (b) {
        b.classList.toggle('active', b === btn);
      });

      if (state.tab === 'all') {
        els.rangePicker.hidden = true;
        els.monthSelect.hidden = true;
      } else if (state.tab === 'year') {
        els.rangePicker.hidden = false;
        els.monthSelect.hidden = true;
        populateYearOptions();
      } else {
        els.rangePicker.hidden = false;
        els.monthSelect.hidden = false;
        populateYearOptions();
        populateMonthOptions();
      }

      rerender();
    }

    function onYearChange() {
      state.year = Number(els.yearSelect.value);
      rerender();
    }

    function onMonthChange() {
      state.month = Number(els.monthSelect.value);
      rerender();
    }

    function fetchCsv(url) {
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error('HTTPエラー: ' + res.status);
        return res.text();
      });
    }

    els.tabFilter.addEventListener('click', onTabClick);
    els.yearSelect.addEventListener('change', onYearChange);
    els.monthSelect.addEventListener('change', onMonthChange);

    if (!window.MD_CONFIG || !MD_CONFIG.CSV_EXPENSE || !MD_CONFIG.CSV_INCOME) {
      showError(
        'CSVの公開URLが未設定です。config.js に、Googleスプレッドシート（支出・収入）をそれぞれ「ウェブに公開（CSV形式）」して発行されたURLを貼ってください。'
      );
      return;
    }

    Promise.all([fetchCsv(MD_CONFIG.CSV_EXPENSE), fetchCsv(MD_CONFIG.CSV_INCOME)])
      .then(function (texts) {
        var expenseRows = MD.parseCsv(texts[0]).slice(1);
        var incomeRows = MD.parseCsv(texts[1]).slice(1);
        state.records = MD.normalizeRecords(expenseRows, 'expense').concat(
          MD.normalizeRecords(incomeRows, 'income')
        );
        rerender();
      })
      .catch(function (err) {
        showError(
          'データの取得に失敗しました（' + err.message + '）。' +
          'スプレッドシートが「ウェブに公開」されているか、config.js のURLが正しいか確認してください。'
        );
      });
  }

  document.addEventListener('DOMContentLoaded', main);
})();
```

- [ ] **Step 2: Commit**

```bash
git add app.js
git commit -m "Add app.js: wiring, fetch, tabs"
```

---

### Task 9: `config.js`, `dev.html`, and fixtures for manual verification

**Files:**
- Create: `config.js`
- Create: `dev.html`
- Create: `test/fixtures/sample-expense.csv`
- Create: `test/fixtures/sample-income.csv`

- [ ] **Step 1: Create `config.js`**

```js
// Googleスプレッドシートの「ファイル → 共有 → ウェブに公開 → CSV」で
// 発行されたURLをそれぞれ貼り付けてください。
// 手順は docs/superpowers/specs/2026-09-17-money-dashboard-design.md の2節、
// またはREADME.mdのセットアップ手順を参照。
window.MD_CONFIG = {
  CSV_EXPENSE: '',
  CSV_INCOME: ''
};
```

- [ ] **Step 2: Create `test/fixtures/sample-expense.csv`**

```
タイムスタンプ,金額,カテゴリ,メモ,日付（記入日以外の場合）
2026/09/01 12:00:00,3000,食費,スーパー,
2026/09/02 09:00:00,50000,生活必需・固定費,住宅ローン,
2026/09/03 20:00:00,1200,外食,ラーメン,
2026/08/15 18:00:00,20000,趣味・娯楽費,パチンコ,
2025/09/10 12:00:00,80000,自己投資,セミナー,
```

- [ ] **Step 3: Create `test/fixtures/sample-income.csv`**

```
タイムスタンプ,金額,カテゴリ,メモ,日付（記入日以外の場合）
2026/09/01 09:00:00,300000,CCI,給料,
2026/09/05 10:00:00,5000,ありさから,お小遣い,
2026/08/20 09:00:00,290000,CCI,給料,
2025/09/15 09:00:00,280000,CCI,給料,
```

- [ ] **Step 4: Create `dev.html`**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>支出・収入ダッシュボード (開発用/合成データ)</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<p style="padding:8px 16px;background:#fff3cd;font-size:12px;">
  これは合成データによる動作確認用ページです。test/fixtures/ の中身を読み込みます。
</p>
<div id="error-banner" class="error-banner" hidden></div>
<div id="empty-state" class="empty-state" hidden>記録がありません。</div>

<div id="app-main" hidden>
  <header id="period-filter" class="period-filter">
    <button type="button" class="active" data-tab="all">全期間</button>
    <button type="button" data-tab="year">年別</button>
    <button type="button" data-tab="month">月別</button>
  </header>

  <div id="range-picker" class="range-picker" hidden>
    <select id="year-select"></select>
    <select id="month-select" hidden></select>
  </div>

  <section id="summary-tiles" class="summary-tiles"></section>

  <section class="chart-section">
    <h2 id="balance-chart-title">年別収支</h2>
    <canvas id="balance-chart"></canvas>
  </section>

  <div class="charts-row">
    <section class="chart-section">
      <h2>支出カテゴリ別</h2>
      <canvas id="expense-category-chart"></canvas>
      <ul id="expense-category-list" class="category-list"></ul>
    </section>

    <section class="chart-section">
      <h2>収入カテゴリ別</h2>
      <canvas id="income-category-chart"></canvas>
      <ul id="income-category-list" class="category-list"></ul>
    </section>
  </div>

  <section class="record-list-section">
    <h2>記録一覧</h2>
    <div id="record-list" class="record-list"></div>
  </section>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
  window.MD_CONFIG = {
    CSV_EXPENSE: 'test/fixtures/sample-expense.csv',
    CSV_INCOME: 'test/fixtures/sample-income.csv'
  };
</script>
<script src="parse.js"></script>
<script src="aggregate.js"></script>
<script src="chart-data.js"></script>
<script src="render.js"></script>
<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Manually verify with a local server**

Run: `python -m http.server 8000` (from the repo root), then open `http://localhost:8000/dev.html` in a browser.

Expected: the "全期間" tab shows a 2-year (2025/2026) grouped bar chart, a positive green summary tile, and expense/income category breakdowns. Clicking "年別" shows a year dropdown; selecting 2026 shows a monthly (8月/9月) grouped bar chart. Clicking "月別" shows year+month dropdowns; selecting 2026/9月 shows a daily bar chart with 3 days of expense/income bars. `file://` will fail with a CORS fetch error — this is expected and documented in the README.

- [ ] **Step 6: Commit**

```bash
git add config.js dev.html test/fixtures/sample-expense.csv test/fixtures/sample-income.csv
git commit -m "Add config.js, dev.html, and sample fixtures for local verification"
```

---

### Task 10: `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```md
# 支出・収入ダッシュボード

Googleフォームで記録している「支出」「収入」を、スマホのブラウザで開くだけで
収支バランスが一目で分かる画面にするツールです。全期間・年別・月別で
収入と支出のバランスを見られます。

設計の詳細は `docs/superpowers/specs/2026-09-17-money-dashboard-design.md` を参照してください。

## セットアップ

1. 「支出（回答）」「収入（回答）」それぞれのGoogleスプレッドシートで
   `ファイル → 共有 → ウェブに公開` を開く
2. 公開対象を該当シート、形式を `カンマ区切り形式 (.csv)` にして公開
3. 発行されたURL2つを `config.js` の `CSV_EXPENSE` / `CSV_INCOME` に貼る
4. GitHubにこのリポジトリをpushし、Settings → Pages を有効化する
5. 発行されたPages URLをスマホのホーム画面に追加する

## 開発

- `node test/run.js` — ロジック部分（parse/aggregate/chart-data）のテストを実行
- `test/index.html` をブラウザで開いても同じテストが実行される
- `dev.html` をローカルサーバー経由で開くと、`test/fixtures/` の合成データで画面を確認できる
  （`python -m http.server` などで配信してください。`file://` で直接開くと fetch がCORSでブロックされます）

## ディレクトリ構成

- `index.html` / `style.css` — 画面
- `config.js` — CSVの公開URL（利用者が設定）
- `parse.js` — CSVパース・日付/金額の正規化（純粋関数）
- `aggregate.js` — 集計（純粋関数）
- `chart-data.js` — Chart.js設定オブジェクトの組み立て（純粋関数）
- `render.js` — DOM描画
- `app.js` — 起動・fetch・結線
- `test/` — テストコードとブラウザ向けテストランナー
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README"
```

---

### Task 11: Deploy to GitHub Pages

**Files:** none (repo-level operations only)

- [ ] **Step 1: Create the GitHub repository**

Run: `gh repo create money-dashboard --public --source=. --remote=origin`

- [ ] **Step 2: Push**

Run: `git push -u origin master`

- [ ] **Step 3: Enable GitHub Pages**

Run: `gh api repos/wwi195/money-dashboard/pages -X POST -f "source[branch]=master" -f "source[path]=/"`. If this errors because Pages is already configured differently, enable it manually via the repo's Settings → Pages instead.

- [ ] **Step 4: Publish both Google Sheets to the web and fill in `config.js`**

In each of "支出（回答）" and "収入（回答）", open `ファイル → 共有 → ウェブに公開`, publish the sheet as CSV, and paste the two resulting URLs into `config.js`'s `CSV_EXPENSE` / `CSV_INCOME`. This step requires the Google Sheets UI and cannot be automated — it must be done manually.

- [ ] **Step 5: Commit and push the filled-in config**

```bash
git add config.js
git commit -m "Configure published CSV URLs"
git push
```

- [ ] **Step 6: Verify the live Pages URL**

Open the Pages URL (`gh api repos/wwi195/money-dashboard/pages --jq .html_url`) on a phone browser and confirm the three tabs render real data.
