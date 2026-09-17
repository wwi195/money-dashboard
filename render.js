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
