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
