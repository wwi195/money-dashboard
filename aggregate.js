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

  function dateRangeOf(records) {
    var valid = filterValidRecords(records);
    if (valid.length === 0) return null;
    var times = valid.map(function (r) { return r.date.date.getTime(); });
    return { start: new Date(Math.min.apply(null, times)), end: new Date(Math.max.apply(null, times)) };
  }

  function formatYmd(date) {
    return date.getFullYear() + '/' + pad(date.getMonth() + 1) + '/' + pad(date.getDate());
  }

  function distinctYears(records) {
    var years = {};
    filterValidRecords(records).forEach(function (r) { years[r.date.date.getFullYear()] = true; });
    return Object.keys(years).map(Number).sort(function (a, b) { return b - a; });
  }

  return {
    monthKey: monthKey,
    dayKey: dayKey,
    rangeForYear: rangeForYear,
    rangeForMonth: rangeForMonth,
    filterValidRecords: filterValidRecords,
    filterByRange: filterByRange,
    summarize: summarize,
    seriesByMonth: seriesByMonth,
    seriesByDay: seriesByDay,
    dateRangeOf: dateRangeOf,
    formatYmd: formatYmd,
    distinctYears: distinctYears
  };
});
